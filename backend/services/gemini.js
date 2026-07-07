/**
 * gemini.js
 * Google Gemini service agent using OpenRouter / direct APIs for DomIQ AI.
 * Exposes facade endpoints refine, analyzeBlueprint, and chat.
 */

const { executeAIRequest } = require("./ai/orchestrator");
const { serialize } = require("./serializer");

async function refine(systemPrompt, projectState) {
  const userPrompt = `Here is the current project state: ${JSON.stringify(projectState)}`;

  try {
    const response = await executeAIRequest({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    console.log("\n========== RAW AI REFINE RESPONSE ==========\n");
    console.log(content);
    console.log("\n============================================\n");

    let cleaned = content.trim();
    cleaned = cleaned
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.error("AI Refine Facade Error:", error);
    throw error;
  }
}

async function analyzeBlueprint(base64Image, designOptions) {
  const { style, budget, roomType, colorTheme } = designOptions;

  const systemPrompt = `You are an expert architectural blueprint parsing AI.
Analyze the uploaded floor plan/blueprint image and extract structural and layout properties.
Your response must be a valid JSON object ONLY. Do not write any markdown formatting block (like \`\`\`json) around it or any prefix/suffix explanation text.

Return exactly the following JSON structure:
{
  "roomType": "${roomType || 'living_room'}",
  "dimensions": { "width": 6.0, "length": 5.0, "height": 2.8 },
  "walls": [
    { "id": "w1", "x1": -3.0, "y1": -2.5, "x2": 3.0, "y2": -2.5 },
    { "id": "w2", "x1": 3.0, "y1": -2.5, "x2": 3.0, "y2": 2.5 },
    { "id": "w3", "x1": 3.0, "y1": 2.5, "x2": -3.0, "y2": 2.5 },
    { "id": "w4", "x1": -3.0, "y1": 2.5, "x2": -3.0, "y2": -2.5 }
  ],
  "doors": [
    { "id": "d1", "x": 0, "y": -2.5, "type": "standard", "rotation": 0, "width": 0.9 }
  ],
  "windows": [
    { "id": "win1", "x": 3.0, "y": 0, "type": "standard", "rotation": 90, "width": 1.2 }
  ],
  "furniture": [
    { "id": "f1", "type": "sofa", "x": 0, "y": 1.0, "rotation": 0, "width": 2.0, "depth": 0.9, "height": 0.85 }
  ],
  "materials": {
    "walls": "white_paint",
    "floors": "oak_wood",
    "doors": "oak"
  },
  "lighting": {
    "type": "warm",
    "fixtures": ["ceiling_spotlights"]
  },
  "colorTheme": "${colorTheme || 'warm_neutral'}",
  "style": "${style || 'modern'}",
  "budget": "${budget || 'medium'}",
  "costEstimation": [
    { "category": "Furniture", "details": "${style || 'modern'} sofa, coffee table, and side table", "price": 45000 },
    { "category": "Materials", "details": "Oak wood floorboards and white latex paint", "price": 30000 }
  ]
}

Note:
- All coordinates (x1, y1, x2, y2, x, y) should be centered around (0,0) based on the dimensions. E.g., if width is 6 and length is 5, x ranges from -3.0 to 3.0 and y ranges from -2.5 to 2.5.
- Make sure walls form a closed loop representing the room boundaries.
- Furniture coordinates should place them nicely inside the room walls, avoiding collisions.
- Match the style option "${style || 'modern'}" and budget level "${budget || 'medium'}".`;

  try {
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await executeAIRequest({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Here is the blueprint image. Analyze it and extract the structured room model in the requested JSON format."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${cleanBase64}`
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    console.log("\n========== RAW AI BLUEPRINT RESPONSE ==========\n");
    console.log(content);
    console.log("\n===============================================\n");

    let cleaned = content.trim();
    cleaned = cleaned
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.error("AI Blueprint Facade Error:", error);
    throw error;
  }
}

async function chat(userMessage, editorState, chatHistory, lastImageContext) {
  console.log("=== [DEBUG] Incoming user message:", JSON.stringify(userMessage));
  const isCostQuery = isGenuineCostQuery(userMessage);
  console.log("=== [DEBUG] Intent isCostQuery detected:", isCostQuery);

  let isImageCostQuery = false;
  if (isCostQuery) {
    if (/(bathroom|kitchen|bedroom|living|office|dining|render|image|design)/i.test(userMessage)) {
      isImageCostQuery = true;
    } else if (/(layout|project|construction|material|boq)/i.test(userMessage)) {
      isImageCostQuery = false;
    } else if (lastImageContext) {
      // "Estimate this" or similar general queries when image is present
      isImageCostQuery = true;
    }
  }

  // If it is a simple cost query, we can compute programmatically directly to avoid latency/costs
  if (isCostQuery && !/(delete|move|add|replace|rotate|create|paint|change)/i.test(userMessage)) {
    if (isImageCostQuery) {
      console.log("=== [DEBUG] Entering direct programmatic IMAGE cost estimator branch");
      const costInfo = calculateImageCost(lastImageContext);
      const res = {
        replyText: costInfo.report,
        type: "structural",
        costBreakdown: costInfo.breakdown,
        imageUrlRequested: false,
        actions: [],
        lastImageContext: lastImageContext
      };
      console.log("=== [DEBUG] Direct cost response returned (Image):", JSON.stringify(res));
      return res;
    } else {
      console.log("=== [DEBUG] Entering direct programmatic LAYOUT cost estimator branch");
      const costInfo = calculateLayoutCost(editorState);
      const res = {
        replyText: costInfo.report,
        type: "structural",
        costBreakdown: costInfo.breakdown,
        imageUrlRequested: false,
        actions: [],
        lastImageContext: lastImageContext
      };
      console.log("=== [DEBUG] Direct cost response returned (Layout):", JSON.stringify(res));
      return res;
    }
  }

  const systemPrompt = `You are a Generative AI Design Assistant for DomIQ AI Home Studio.
The user will send you a prompt and the current JSON state of their room design.
Analyze the prompt and state, and output a valid JSON ONLY.
Do NOT output any markdown (no \`\`\`json blocks).

Important Instructions:
1. OBJECT IDENTIFICATION & SAFETY:
- Before performing any action, you must inspect the current editor state (\`editorState\`).
- Identify the target objects by their \`id\` (e.g., \`f_1720000\`), \`type\`, position, rotation, etc.
- Always use the unique \`id\` of an object for targets (e.g. in \`targetId\` field of actions) to avoid any ambiguity.
- If multiple matching candidate objects exist (e.g., the user says "delete dining chair" but there are multiple dining chairs, or "move window" but there are three windows), you MUST ask a clarification question in \`replyText\` listing the candidates (with their current positions/details) instead of executing the action. Do NOT return any modifying actions in the \`actions\` array in this case.
- Never guess randomly. Never delete the wrong category or perform multiple unrelated actions. If an object cannot be found, explain politely.

2. COMMAND EXECUTION:
You must translate natural language instructions into a list of structural or furniture changes in the \`actions\` array.
Supported action types in the \`actions\` array:
- \`add\`: Create new walls, furniture, doors, or windows.
  - targetType: "furniture", "door", "window", or "wall"
  - type: (for furniture: e.g., "sofa", "chair", "table_coffee", "tv_stand", "bed_double", "wardrobe", "nightstand", "dining_table", "kitchen_island", "plant", "desk", "bookshelf", "bath_tub", "wash_basin", "lamp_floor", "office_chair")
  - x, y: position in meters
  - w, h, depth: dimensions
  - rotation: rotation in degrees
  - color: hex color
  - material: material name
  - (For walls, provide x1, y1, x2, y2, thickness, height)
- \`delete\`: Remove targetId.
  - targetId: ID of the object/wall to delete.
- \`move\`: Change position.
  - targetId: ID of target.
  - x, y: new position (or x1, y1, x2, y2 for walls).
- \`rotate\`: Change rotation.
  - targetId: ID of target.
  - rotation: rotation value in degrees.
- \`resize\` / \`scale\`: Change dimensions.
  - targetId: ID of target.
  - w, h, depth: new dimensions.
- \`duplicate\`: Clone target.
  - targetId: ID of target to clone.
- \`replace\`: Swap object type/details.
  - targetId: ID of target.
  - newType: new item type (e.g. "sectional" or "sofa").
  - w, h, depth
- \`rename\`: Change item name.
  - targetId: ID of target.
  - name: new name.
- \`lock\` / \`unlock\`: Set locking status.
  - targetId: ID of target.
- \`hide\` / \`show\`: Set visibility status.
  - targetId: ID of target.
- \`change_material\` / \`change_color\` / \`change_texture\` / \`change_finish\`: Update finishes.
  - targetType: "global" or "individual"
  - targetId: "walls", "floors", "doors", "ceiling", or specific object ID.
  - value: name of material/texture/finish or hex color.
- \`change_lighting\`: Update light parameters.
  - ambient: ambient light intensity (e.g., 0.5 - 1.2)
  - daylight: boolean
- \`split_wall\`: Split a wall segment.
  - targetId: wall ID.
- \`merge_walls\`: Remove two connected collinear walls.
  - targetId1, targetId2: wall IDs to merge.

3. COST ESTIMATION:
- If the user asks for a cost estimate, budget, BOQ, or quotation, do NOT generate it via AI reasoning. Simply output:
  - replyText: "[COST_ESTIMATE_MARKER]"
  And the backend code will intercept this marker and substitute the highly accurate programmatic breakdown.

4. IMAGE GENERATION & FOLLOW-UP REGENERATION:
- If the user explicitly asks for an image, render, visualization, or mockup (e.g., "generate an image", "create a kitchen image", "show me a luxury bathroom", "visualize this room"), OR if they ask for follow-up modifications/additions referencing the last generated image (e.g., "Add a wash basin", "Replace bathtub", "Replace marble with wood", "Change flooring", "Change wall color" when an image was already generated previously and is present in the temporary memory context), you MUST set:
  - imageUrlRequested: true
  - type: "furnish"
  - extractedStyle: The style requested (must be one of: "modern", "scandinavian", "minimalist", "japanese", "industrial", "luxury". Fallback to style in Last Generated Image Context if not explicitly changed).
  - extractedRoomType: The room type requested (must be one of: "living room", "kitchen", "bathroom", "bedroom", "office", "dining room". Fallback to room type in Last Generated Image Context if not explicitly changed).
  - extractedCameraAngle: The camera angle if mentioned (must be one of: "Corner view", "Top view", "Front view", "Side view". Default is "Corner view").
  - extractedCustomPrompt: A new compiled detailed prompt describing the desired final room, combining the previous design context (from Last Generated Image Context) with the user's latest request. It must describe the room itself, not the action of editing. For example, if the previous room was a Japandi Bathroom and the user says "add a wash basin", output a prompt like "A photorealistic Japandi bathroom featuring a floating wash basin, wooden vanity, warm indirect lighting, natural stone walls and minimalist premium accessories."
- If the user is having a normal conversation (e.g., "Hi", "Move the sofa", "Estimate cost", "Paint walls white", "Suggest furniture"), you MUST set:
  - imageUrlRequested: false
  - Do NOT extract image parameters.

5. RESPONSE SCHEMA:
Return exactly a valid JSON object matching the following structure:
{
  "replyText": "Explain what you did or ask a clarification question.",
  "type": "structural" | "furnish",
  "actions": [
     { "action": "move", "targetId": "f_1", "x": 1.2, "y": -0.5 }
  ],
  "imageUrlRequested": false,
  "extractedStyle": "modern" | "scandinavian" | "minimalist" | "japanese" | "industrial" | "luxury" | null,
  "extractedRoomType": "living room" | "kitchen" | "bathroom" | "bedroom" | "office" | "dining room" | null,
  "extractedCameraAngle": "Corner view" | "Top view" | "Front view" | "Side view" | null,
  "extractedCustomPrompt": "description..."
}`;

  const messages = [];
  messages.push({ role: "system", content: systemPrompt });

  let serializedState = null;
  let serializationFailed = false;

  try {
    serializedState = serialize(editorState, userMessage);
  } catch (err) {
    console.error("[SERIALIZER FAILURE] Serializer failed, gracefully degrading to minimal prompt:", err);
    serializationFailed = true;
  }

  if (serializationFailed) {
    // Minimal prompt containing system prompt and latest user message only
    let latestUserContent = `User Prompt: ${userMessage}`;
    if (lastImageContext) {
      latestUserContent += `\n\nLast Generated Image Context (Temporary Memory): ${JSON.stringify(lastImageContext)}`;
    }
    messages.push({ role: "user", content: latestUserContent });
  } else {
    // Deterministic prompt construction order:
    // 2. Serialized editor state
    messages.push({ role: "system", content: `Current Editor State:\n${JSON.stringify(serializedState)}` });

    // 3. Conversation history
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      const historyToInclude = chatHistory.slice(0, -1);
      for (const msg of historyToInclude) {
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content
        });
      }
    }

    // 4. Latest user message
    let latestUserContent = `User Prompt: ${userMessage}`;
    if (lastImageContext) {
      latestUserContent += `\n\nLast Generated Image Context (Temporary Memory): ${JSON.stringify(lastImageContext)}`;
    }
    messages.push({ role: "user", content: latestUserContent });
  }

  console.log("=== [DEBUG] AI Request messages:", JSON.stringify(messages));

  try {
    const response = await executeAIRequest({
      messages: messages,
      temperature: 0.4,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    console.log("=== [DEBUG] RAW AI CHAT RESPONSE:", content);

    let cleaned = content.trim();
    cleaned = cleaned
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    const result = JSON.parse(cleaned);

    // Handle cost marker substitution or cost request appending
    const aiRequestedCost = result.replyText && result.replyText.includes("[COST_ESTIMATE_MARKER]");
    console.log("=== [DEBUG] AI requested cost estimate marker:", aiRequestedCost);
    if (isCostQuery || aiRequestedCost) {
      console.log("=== [DEBUG] Substituting or appending cost breakdown report");
      const costInfo = isImageCostQuery ? calculateImageCost(lastImageContext) : calculateLayoutCost(editorState);
      if (aiRequestedCost) {
        result.replyText = result.replyText.replace("[COST_ESTIMATE_MARKER]", costInfo.report);
      } else {
        result.replyText = (result.replyText ? result.replyText + "\n\n" : "") + costInfo.report;
      }
      result.costBreakdown = costInfo.breakdown;
    }

    console.log("=== [DEBUG] Final response returned to frontend:", JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("AI Chat Facade Error:", error);
    throw error;
  }
}

function generateFallbackLayout(roomType, style, budget) {
  console.log("[GEMINI SERVICE] Returning fallback layout for:", roomType);
  const costMap = { low: 75000, medium: 180000, premium: 350000 };
  return {
    roomType: roomType,
    dimensions: { width: 5.0, length: 4.0, height: 2.8 },
    walls: [
      { id: "w1", x1: -2.5, y1: -2.0, x2: 2.5, y2: -2.0 },
      { id: "w2", x1: 2.5, y1: -2.0, x2: 2.5, y2: 2.0 },
      { id: "w3", x1: 2.5, y1: 2.0, x2: -2.5, y2: 2.0 },
      { id: "w4", x1: -2.5, y1: 2.0, x2: -2.5, y2: -2.0 }
    ],
    doors: [
      { id: "d1", x: 0.0, y: -2.0, wallId: "w1", w: 0.9 }
    ],
    windows: [
      { id: "win1", x: -2.5, y: 0.0, wallId: "w4", w: 1.2 }
    ],
    furniture: [
      { id: "f1", type: "sofa", name: "Sofa", x: 0.0, y: 1.0, rotation: 0, w: 1.8, h: 0.9 },
      { id: "f2", type: "table", name: "Coffee Table", x: 0.0, y: -0.2, rotation: 0, w: 1.0, h: 0.6 }
    ],
    materials: {
      walls: "white_plaster",
      floors: "oak_wood",
      ceiling: "matte_white"
    },
    costEstimation: [
      { category: "Furniture", details: `${style.toUpperCase()} styling furniture set`, price: costMap[budget] * 0.6 },
      { category: "Materials", details: "Premium floorboards and matching wall paints", price: costMap[budget] * 0.4 }
    ]
  };
}

function calculateLayoutCost(editorState) {
  if (!editorState) return { report: "", breakdown: [], total: 0 };

  const walls = editorState.walls || [];
  const furniture = editorState.furniture || [];
  const doors = editorState.doors || [];
  const windows = editorState.windows || [];
  const rooms = editorState.rooms || [];
  const materials = editorState.materials || { walls: "white_paint", floors: "oak_wood", doors: "oak" };

  let wLen = 0;
  walls.forEach(w => {
    wLen += Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  });
  const wallArea = wLen * (editorState.dimensions?.height || 2.8);

  let floorArea = 0;
  rooms.forEach(r => {
    floorArea += (r.area || 0);
  });
  if (floorArea === 0) {
    floorArea = editorState.dimensions?.area || 20.0;
  }

  const style = editorState.selectedStyle || "modern";
  let costPerSqMeterWall = 6000;
  let costPerSqMeterFloor = 2500;
  
  if (style === "luxury") {
    costPerSqMeterWall = 12000;
    costPerSqMeterFloor = 5500;
  } else if (style === "minimalist") {
    costPerSqMeterWall = 5000;
    costPerSqMeterFloor = 2000;
  }

  const wallCostTotal = Math.round(wallArea * costPerSqMeterWall);
  const floorCostTotal = Math.round(floorArea * costPerSqMeterFloor);
  const ceilingCostTotal = Math.round(floorArea * 600); // ceiling rate 600/m2

  const itemPrices = {
    door: 15000,
    window: 25000,
    sofa: 45000,
    chair: 12000,
    table_coffee: 12000,
    tv_stand: 28000,
    bed_double: 65000,
    wardrobe: 50000,
    nightstand: 8500,
    dining_table: 35000,
    kitchen_island: 70000,
    plant: 8000,
    desk: 22000,
    bookshelf: 18000,
    bath_tub: 60000,
    wash_basin: 15000,
    lamp_floor: 8000,
    office_chair: 12000
  };

  let multiplier = 1.0;
  if (style === "luxury") multiplier = 2.2;
  if (style === "minimalist") multiplier = 0.85;

  const categories = {
    "Furniture": [],
    "Kitchen": [],
    "Lighting": [],
    "Flooring": [],
    "Walls": [],
    "Doors": [],
    "Windows": [],
    "Bathroom": [],
    "Decoration": []
  };

  const counts = {};
  const costBreakdown = [];
  let totalMedium = 0;

  furniture.forEach(item => {
    if (item.type === "door" || item.type === "window") return;
    counts[item.type] = (counts[item.type] || 0) + 1;
  });

  const padLabel = (label, targetLen = 30) => {
    const dots = targetLen - label.length;
    return label + " " + ".".repeat(Math.max(1, dots)) + " ";
  };

  Object.keys(counts).forEach(type => {
    const count = counts[type];
    const base = itemPrices[type] || 15000;
    const rate = Math.round(base * multiplier);
    const rowCost = rate * count;
    const name = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const label = `${name} (${count})`;

    let cat = "Furniture";
    if (["kitchen_island", "cabinet", "kitchen_cabinet", "cabinets"].includes(type)) cat = "Kitchen";
    else if (["lamp_floor", "lamp", "ceiling_light"].includes(type)) cat = "Lighting";
    else if (["plant", "rug", "curtains", "decor_tv"].includes(type)) cat = "Decoration";
    else if (["wash_basin", "bath_tub", "toilet", "mirror"].includes(type)) cat = "Bathroom";

    categories[cat].push({ label, cost: rowCost });
    totalMedium += rowCost;
    costBreakdown.push({ item: label, price: rowCost });
  });

  if (wallCostTotal > 0) {
    const label = `Paint`;
    categories["Walls"].push({ label, cost: wallCostTotal });
    totalMedium += wallCostTotal;
    costBreakdown.push({ item: label, price: wallCostTotal });
  }
  if (floorCostTotal > 0) {
    const label = `${materials.floors && materials.floors.includes("marble") ? "Marble" : (style === "luxury" ? "Marble" : "Wood")} Flooring`;
    categories["Flooring"].push({ label, cost: floorCostTotal });
    totalMedium += floorCostTotal;
    costBreakdown.push({ item: label, price: floorCostTotal });
  }
  if (ceilingCostTotal > 0) {
    const label = `Ceiling & False Ceiling`;
    categories["Lighting"].push({ label, cost: ceilingCostTotal });
    totalMedium += ceilingCostTotal;
    costBreakdown.push({ item: label, price: ceilingCostTotal });
  }

  const doorCount = doors.length || furniture.filter(i => i.type === 'door').length;
  const windowCount = windows.length || furniture.filter(i => i.type === 'window').length;
  if (doorCount > 0) {
    const label = `Main Door`;
    const cost = doorCount * 18000;
    categories["Doors"].push({ label, cost });
    totalMedium += cost;
    costBreakdown.push({ item: label, price: cost });
  }
  if (windowCount > 0) {
    const winLabel = `Glass Windows`;
    const winCost = windowCount * 25000;
    categories["Windows"].push({ label: winLabel, cost: winCost });
    totalMedium += winCost;
    costBreakdown.push({ item: winLabel, price: winCost });

    const curtainLabel = `Curtains`;
    const curtainCost = windowCount * 9000;
    categories["Decoration"].push({ label: curtainLabel, cost: curtainCost });
    totalMedium += curtainCost;
    costBreakdown.push({ item: curtainLabel, price: curtainCost });
  }

  let report = "";
  Object.keys(categories).forEach(cat => {
    if (categories[cat].length > 0) {
      report += `${cat}\n`;
      categories[cat].forEach(item => {
        report += `• ${padLabel(item.label)} ₹${item.cost.toLocaleString('en-IN')}\n`;
      });
      report += `\n`;
    }
  });

  const lowEstimate = Math.round(totalMedium * 0.7);
  const premiumEstimate = Math.round(totalMedium * 1.8);

  report += `------------------------------------\n\n`;
  report += `Estimated Total\n`;
  report += `₹${totalMedium.toLocaleString('en-IN')}\n\n`;
  report += `Low Budget Estimate: ₹${lowEstimate.toLocaleString('en-IN')}\n`;
  report += `Medium Estimate: ₹${totalMedium.toLocaleString('en-IN')}\n`;
  report += `Premium Estimate: ₹${premiumEstimate.toLocaleString('en-IN')}\n\n`;
  report += `Values are estimated and may vary depending on brand, city, labour, taxes and material quality.`;

  return { report, breakdown: costBreakdown, total: totalMedium };
}

function isGenuineCostQuery(userMessage) {
  if (!userMessage) return false;
  const msg = userMessage.toLowerCase().trim();

  // Standard pricing and cost terms
  const pricingPhrases = [
    /\b(estimate|estimation|calculate|calculator|breakdown|total|approximate|project|construction|furniture|material|boq|quotation)\s+(cost|price|budget|boq|quotation|estimate|estimation)\b/i,
    /\bhow\s+much\b.*\b(cost|price|this|layout|budget|estimation|quotation)\b/i,
    /\b(boq|quotation|cost\s+breakdown|budget\s+breakdown)\b/i,
    /\bwhat\s+is\s+the\s+(cost|price|budget|estimation|quotation)\b/i,
    /^(cost|price|estimate|budget|boq|quotation|how much|how much\?)$/i
  ];

  const isMatch = pricingPhrases.some(regex => regex.test(msg));
  if (!isMatch) return false;

  // Exclude if they are trying to perform structural modifications alongside it (e.g. "Add a chair and estimate cost")
  // In those cases, we want the request to go to the LLM first so the LLM can generate the structural actions.
  const hasModificationVerb = /(delete|move|add|replace|rotate|create|paint|change|suggest|design|furnish|style|place|show|render|view|generate)/i.test(msg);
  if (hasModificationVerb) {
    return false;
  }

  return true;
}

function calculateImageCost(context) {
  if (!context) return { report: "No generated image found in context to estimate.", breakdown: [], total: 0 };

  const room = (context.roomType || "living room").toLowerCase();
  const style = (context.style || "modern").toLowerCase();

  let multiplier = 1.0;
  if (style === "luxury") multiplier = 2.2;
  if (style === "minimalist" || style === "minimal") multiplier = 0.85;
  if (style === "scandinavian") multiplier = 1.1;
  if (style === "japanese") multiplier = 1.35;

  const categories = {
    "Furniture": [],
    "Flooring & Walls": [],
    "Lighting": [],
    "Fixtures & Plumbing": [],
    "Labour & Installation": []
  };

  let total = 0;
  const breakdown = [];

  const addLine = (cat, label, baseCost) => {
    const cost = Math.round(baseCost * multiplier);
    categories[cat].push({ label, cost });
    total += cost;
    breakdown.push({ item: label, price: cost });
  };

  if (room.includes("kitchen")) {
    addLine("Furniture", "Premium Kitchen Cabinets", 180000);
    addLine("Furniture", "Kitchen Island / Countertop", 70000);
    addLine("Fixtures & Plumbing", "Sink & Luxury Faucet", 25000);
    addLine("Fixtures & Plumbing", "Integrated Appliances Setup", 150000);
    addLine("Flooring & Walls", "Backsplash & Wall Tiling", 45000);
    addLine("Flooring & Walls", "Wood or Tile Flooring", 60000);
    addLine("Lighting", "Ambient & LED Task Lighting", 35000);
    addLine("Labour & Installation", "Kitchen Fitting & Plumbing Labour", 50000);
  } else if (room.includes("bathroom") || room.includes("bath")) {
    addLine("Fixtures & Plumbing", "Luxury Bathtub", 75000);
    addLine("Fixtures & Plumbing", "Floating Wash Basin & Vanity", 35000);
    addLine("Fixtures & Plumbing", "Premium Toilet & Cistern", 25000);
    addLine("Fixtures & Plumbing", "Glass Shower Partition", 30000);
    addLine("Flooring & Walls", "Waterproof Wall Tiles", 55000);
    addLine("Flooring & Walls", "Anti-skid Floor Tiles", 30000);
    addLine("Lighting", "Mirror LED & Spotlights", 20000);
    addLine("Labour & Installation", "Plumbing & Tiling Labour", 40000);
  } else if (room.includes("bedroom")) {
    addLine("Furniture", "King Size Premium Bed Frame", 65000);
    addLine("Furniture", "Orthopedic Mattress", 30000);
    addLine("Furniture", "Custom Sliding Wardrobe", 120000);
    addLine("Furniture", "Matching Side Tables (2)", 15000);
    addLine("Flooring & Walls", "Hardwood Flooring", 70000);
    addLine("Flooring & Walls", "Premium Wall Paint / Wallpaper", 35000);
    addLine("Lighting", "False Ceiling & Ambient Warm Light", 45000);
    addLine("Labour & Installation", "Carpentry & Finishing Labour", 35000);
  } else if (room.includes("office") || room.includes("study")) {
    addLine("Furniture", "Ergonomic Office Chair", 25000);
    addLine("Furniture", "Executive Walnut Desk", 45000);
    addLine("Furniture", "Bookshelf / Filing Cabinets", 40000);
    addLine("Flooring & Walls", "Flooring Finish", 40000);
    addLine("Flooring & Walls", "Wall Paint & Acoustics", 30000);
    addLine("Lighting", "Smart Desk Lamp & Overhead Lights", 15000);
    addLine("Labour & Installation", "Installation Labour", 15000);
  } else if (room.includes("dining")) {
    addLine("Furniture", "Premium Dining Table", 55000);
    addLine("Furniture", "Designer Dining Chairs (6)", 60000);
    addLine("Furniture", "Sideboard / Buffet Cabinet", 35000);
    addLine("Flooring & Walls", "Flooring & Paint", 50000);
    addLine("Lighting", "Pendant Chandelier over Table", 30000);
    addLine("Labour & Installation", "Labour & Setup", 15000);
  } else {
    // Living room / General room
    addLine("Furniture", "Premium Sectional Sofa", 110000);
    addLine("Furniture", "Designer Coffee Table", 20000);
    addLine("Furniture", "TV Entertainment Unit", 45000);
    addLine("Flooring & Walls", "Flooring Finish", 60000);
    addLine("Flooring & Walls", "Wall Paint / Texture", 40000);
    addLine("Lighting", "False Ceiling & Chandelier", 50000);
    addLine("Labour & Installation", "General Labour & Fitting", 30000);
  }

  const padLabel = (label, targetLen = 30) => {
    const dots = targetLen - label.length;
    return label + " " + ".".repeat(Math.max(1, dots)) + " ";
  };

  let report = `### Estimated Budget for Generated ${room.charAt(0).toUpperCase() + room.slice(1)} (${style.charAt(0).toUpperCase() + style.slice(1)} Style)\n\n`;
  Object.keys(categories).forEach(cat => {
    if (categories[cat].length > 0) {
      report += `${cat}\n`;
      categories[cat].forEach(item => {
        report += `• ${padLabel(item.label)} ₹${item.cost.toLocaleString('en-IN')}\n`;
      });
      report += `\n`;
    }
  });

  const lowEstimate = Math.round(total * 0.7);
  const premiumEstimate = Math.round(total * 1.8);

  report += `------------------------------------\n\n`;
  report += `Estimated Total\n`;
  report += `₹${total.toLocaleString('en-IN')}\n\n`;
  report += `Low Budget Estimate: ₹${lowEstimate.toLocaleString('en-IN')}\n`;
  report += `Medium Estimate: ₹${total.toLocaleString('en-IN')}\n`;
  report += `Premium Estimate: ₹${premiumEstimate.toLocaleString('en-IN')}\n\n`;
  report += `Values are estimated specifically for the generated ${room} design and may vary depending on material selections, brand preferences, city, labour, and taxes.`;

  return { report, breakdown, total };
}

module.exports = {
  refine,
  analyzeBlueprint,
  chat,
  generateFallbackLayout
};
