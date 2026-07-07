/**
 * ai.js
 * Express router for AI endpoints with authentication & ownership tracking.
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const aiService = require("../services/gemini");
const imageGenerator = require("../services/imageGenerator");
const authMiddleware = require("../middleware/authMiddleware");
const db = require("../config/db");

// Require auth for all AI operations
router.use(authMiddleware);

// POST /api/ai/refine
router.post("/refine", async (req, res) => {
  const { systemPrompt, projectState } = req.body;

  if (!systemPrompt || !projectState) {
    return res.status(400).json({ error: "System prompt and project state are required." });
  }

  try {
    const result = await aiService.refine(systemPrompt, projectState);
    res.json(result);
  } catch (error) {
    console.error("Refine Endpoint Error:", error);
    res.status(error.status || 500).json(error.toJSON ? error.toJSON() : error);
  }
});

// POST /api/ai/generate-image
router.post("/generate-image", async (req, res) => {
  const { editorState, cameraAngle, roomType, projectId, customPrompt } = req.body;
  const startTime = Date.now();

  console.log("\n--- [BACKEND: AUTHENTICATED GENERATE IMAGE REQUEST] ---");
  console.log("User ID:", req.user.id);
  console.log("Project ID:", projectId || "N/A");

  if (!editorState) {
    return res.status(400).json({ error: "Editor state is required." });
  }

  const controller = new AbortController();
  const onSocketClose = () => {
    if (!res.writableEnded) {
      console.log("[BACKEND] Client socket closed. Aborting image generation...");
      controller.abort();
    }
  };

  if (res.socket) {
    res.socket.once("close", onSocketClose);
  }

  try {
    const cleanState = require("../services/serializer").serialize(editorState);
    const layoutObj = editorState.layoutDescription || cleanState;
    let generatedPrompt = imageGenerator.buildPromptFromLayout(layoutObj);
    if (customPrompt) {
      generatedPrompt += " User Instructions: " + customPrompt;
    }

    let resolvedRoomType = roomType;
    if (!resolvedRoomType || resolvedRoomType === "Auto") {
      if (layoutObj && layoutObj.rooms && layoutObj.rooms.length > 0) {
        resolvedRoomType = layoutObj.rooms[0].name || layoutObj.rooms[0].type || "Living Room";
      } else {
        resolvedRoomType = "Living Room";
      }
    }

    const result = await imageGenerator.generateImage({
      prompt: generatedPrompt,
      style: editorState.selectedStyle || "modern",
      camera: cameraAngle || "Corner view",
      roomType: resolvedRoomType,
      customPrompt: customPrompt
    }, controller.signal);

    if (res.socket) {
      res.socket.removeListener("close", onSocketClose);
    }

    const duration = Date.now() - startTime;
    const generationId = crypto.randomUUID();

    // Store AI Generation metadata
    await db.asyncRun(
      'INSERT INTO ai_generations (id, user_id, project_id, prompt, model, style, camera_angle, room_type, generation_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [generationId, req.user.id, projectId || null, generatedPrompt, 'Imagen-3/SDXL', editorState.selectedStyle || 'modern', cameraAngle || 'Corner view', resolvedRoomType, duration]
    );

    // Store Render asset if URL present
    if (result && result.url) {
      const renderId = crypto.randomUUID();
      await db.asyncRun(
        'INSERT INTO renders (id, user_id, project_id, generation_id, image_path, image_url, thumbnail_url, prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [renderId, req.user.id, projectId || null, generationId, result.url, result.url, result.url, generatedPrompt]
      );
      result.renderId = renderId;
    }

    res.json({
      ...result,
      generationId: generationId
    });
  } catch (error) {
    if (res.socket) {
      res.socket.removeListener("close", onSocketClose);
    }

    console.error("[BACKEND ERROR] Image Generation Failed:", error.message);
    if (res.headersSent) return;

    if (error.name === "AbortError" || controller.signal.aborted) {
      return res.status(499).json({ error: "Client Closed Request" });
    }

    res.status(500).json({
      error: "Failed to generate design image.",
      message: error.message
    });
  }
});

// POST /api/ai/analyze-blueprint
router.post("/analyze-blueprint", async (req, res) => {
  const { blueprintImage, style, budget, roomType, colorTheme, projectId } = req.body;

  if (!blueprintImage) {
    return res.status(400).json({ error: "Blueprint image is required." });
  }

  try {
    const result = await aiService.analyzeBlueprint(blueprintImage, { style, budget, roomType, colorTheme });

    // Save blueprint metadata
    const blueprintId = crypto.randomUUID();
    await db.asyncRun(
      'INSERT INTO uploaded_blueprints (id, user_id, project_id, file_path, image_url) VALUES (?, ?, ?, ?, ?)',
      [blueprintId, req.user.id, projectId || null, 'inline_base64', 'base64_data']
    );

    res.json({
      ...result,
      blueprintId: blueprintId
    });
  } catch (error) {
    console.error("Blueprint Analysis Endpoint Error:", error);
    res.status(error.status || 500).json(error.toJSON ? error.toJSON() : error);
  }
});

// POST /api/ai/chat
router.post("/chat", async (req, res) => {
  const { userMessage, editorState, chatHistory, lastImageContext } = req.body;
  if (!userMessage) {
    return res.status(400).json({ error: "userMessage is required." });
  }

  try {
    const result = await aiService.chat(userMessage, editorState, chatHistory, lastImageContext);
    
    // If result explicitly requests a visualization/image render
    if (result.imageUrlRequested) {
      try {
        const layoutObj = result.editorState || editorState;
        const basePrompt = imageGenerator.buildPromptFromLayout(layoutObj);
        
        // Extract parameters resolved from the user message by the LLM
        const extractedStyle = result.extractedStyle || editorState.selectedStyle || "modern";
        const extractedRoom = result.extractedRoomType || editorState.roomType || "Living Room";
        const extractedCamera = result.extractedCameraAngle || "Corner view";
        const customPrompt = result.extractedCustomPrompt || userMessage;

        // Ensure room type is capitalized nicely
        const resolvedRoomType = extractedRoom.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

        console.log(`\n--- [BACKEND] Reusing existing image generation for Chat:`);
        console.log(`- Style: ${extractedStyle}`);
        console.log(`- Room Type: ${resolvedRoomType}`);
        console.log(`- Camera: ${extractedCamera}`);
        console.log(`- Custom Prompt: ${customPrompt}\n`);

        // Generate image using the existing image generator pipeline
        const imageResult = await imageGenerator.generateImage({
          prompt: basePrompt,
          style: extractedStyle,
          camera: extractedCamera,
          roomType: resolvedRoomType,
          customPrompt: customPrompt
        });
        
        if (imageResult && imageResult.url) {
          result.imageUrl = imageResult.url;
          result.type = "structural_and_image"; // Combine structural edits with image response

          // Populate new lastImageContext metadata
          result.lastImageContext = {
            roomType: extractedRoom,
            style: extractedStyle,
            camera: extractedCamera,
            customPrompt: customPrompt,
            prompt: basePrompt
          };
        }
      } catch (err) {
        console.error("Image generation inside chat failed:", err);
      }
    }

    // Preserve existing image context if not overwritten
    if (!result.lastImageContext && lastImageContext) {
      result.lastImageContext = lastImageContext;
    }
    
    res.json(result);
  } catch (error) {
    console.error("Chat Endpoint Error:", error);
    res.status(error.status || 500).json(error.toJSON ? error.toJSON() : error);
  }
});

module.exports = router;
