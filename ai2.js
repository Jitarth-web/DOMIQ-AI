import apiClient from './api/index.js';

/**
 * ai.js
 * Upgraded Gemini Generative Design Assistant & Category-Based Layout Optimizer
 */

// 1. GLOBAL FURNITURE REGISTRY
const FURNITURE_REGISTRY = [
  {
    id: "bed_double",
    displayName: "Double Bed",
    category: "Bed",
    aliases: ["bed", "doublebed", "kingbed", "queenbed", "bed_double", "singlebed"],
    width: 1.8, depth: 2.0, height: 0.65, defaultRotation: 0,
    placementRules: ["against_longest_solid_wall", "never_center"]
  },
  {
    id: "nightstand",
    displayName: "Nightstand",
    category: "Nightstand",
    aliases: ["nightstand", "bedside", "bedsidetable"],
    width: 0.5, depth: 0.5, height: 0.5, defaultRotation: 0,
    placementRules: ["flank_bed"]
  },
  {
    id: "wardrobe",
    displayName: "Wardrobe",
    category: "Wardrobe",
    aliases: ["wardrobe", "closet", "cupboard"],
    width: 1.5, depth: 0.6, height: 2.2, defaultRotation: 0,
    placementRules: ["against_wall"]
  },
  {
    id: "desk",
    displayName: "Desk",
    category: "Desk",
    aliases: ["desk", "officedesk", "studydesk"],
    width: 1.4, depth: 0.7, height: 0.75, defaultRotation: 0,
    placementRules: ["near_window", "natural_light"]
  },
  {
    id: "office_chair",
    displayName: "Office Chair",
    category: "Chair",
    aliases: ["office_chair", "officechair", "chair", "armchair", "stool", "diningchair", "dining_chair"],
    width: 0.65, depth: 0.65, height: 0.9, defaultRotation: 0,
    placementRules: ["face_desk"]
  },
  {
    id: "sofa",
    displayName: "Sofa",
    category: "Sofa",
    aliases: ["sofa", "couch", "loveseat"],
    width: 2.0, depth: 0.9, height: 0.8, defaultRotation: 0,
    placementRules: ["face_tv", "against_wall"]
  },
  {
    id: "tv_stand",
    displayName: "TV Stand",
    category: "TV",
    aliases: ["tv", "television", "screen", "tvstand", "tv_stand", "decor_tv"],
    width: 1.6, depth: 0.4, height: 0.5, defaultRotation: 0,
    placementRules: ["feature_wall"]
  },
  {
    id: "table_coffee",
    displayName: "Coffee Table",
    category: "CoffeeTable",
    aliases: ["table_coffee", "coffeetable", "coffee_table"],
    width: 1.0, depth: 0.6, height: 0.45, defaultRotation: 0,
    placementRules: ["center_in_front_of_sofa"]
  },
  {
    id: "dining_table",
    displayName: "Dining Table",
    category: "DiningTable",
    aliases: ["diningtable", "dining_table", "table_dining"],
    width: 1.6, depth: 0.9, height: 0.75, defaultRotation: 0,
    placementRules: ["center_of_room"]
  },
  {
    id: "kitchen_island",
    displayName: "Kitchen Island",
    category: "KitchenIsland",
    aliases: ["kitchen_island", "cabinet", "kitchencabinet", "islandcounter"],
    width: 1.8, depth: 0.8, height: 0.95, defaultRotation: 0,
    placementRules: ["against_wall"]
  },
  {
    id: "plant",
    displayName: "Plant",
    category: "Plant",
    aliases: ["plant", "tree", "flower", "foliage"],
    width: 0.6, depth: 0.6, height: 1.5, defaultRotation: 0,
    placementRules: ["unused_corner"]
  },
  {
    id: "lamp_floor",
    displayName: "Lamp",
    category: "Lamp",
    aliases: ["lamp", "lamp_floor", "floorlamp", "readinglamp"],
    width: 0.4, depth: 0.4, height: 1.6, defaultRotation: 0,
    placementRules: ["unused_corner"]
  },
  {
    id: "bookshelf",
    displayName: "Bookshelf",
    category: "Bookshelf",
    aliases: ["bookshelf", "bookcase", "shelving"],
    width: 1.0, depth: 0.4, height: 1.8, defaultRotation: 0,
    placementRules: ["against_wall"]
  },
  {
    id: "wash_basin",
    displayName: "Wash Basin",
    category: "Sink",
    aliases: ["washbasin", "wash_basin", "sink", "basin"],
    width: 0.8, depth: 0.55, height: 0.85, defaultRotation: 0,
    placementRules: ["near_window"]
  },
  {
    id: "bath_tub",
    displayName: "Bath Tub",
    category: "Bathtub",
    aliases: ["bathtub", "bath_tub", "tub", "shower"],
    width: 1.7, depth: 0.8, height: 0.6, defaultRotation: 0,
    placementRules: ["against_wall"]
  }
];

const ai = {
  activeStyle: "modern",
  chatHistory: [],
  currentChatRecommendation: null,
  originalState: null,
  renderHistory: [],

  initialized: false,

  init: async function() {
    if (this.initialized) return;
    this.initialized = true;

    this.updateCostEstimates();
    console.log("Generative Gemini Chat Assistant active");
    
    // Dynamically load helper modules if not already loaded (to keep ai.js clean and modular)
    if (!window.aiExecutor) await this.loadScript("ai-executor.js");
    if (!window.aiValidator) await this.loadScript("ai-validator.js");
    if (!window.aiRefinement) await this.loadScript("ai-refinement.js");

    // Dynamic rendering hook: Highlight preview walls in 2D canvas planner
    setTimeout(() => {
      if (window.editor) {
        const originalDrawWalls = editor.drawWalls;
        editor.drawWalls = function() {
          originalDrawWalls.call(editor);

          // Render dashed cyan highlight for new or modified AI preview walls
          editor.walls.forEach(w => {
            if (w.isAiPreview) {
              const p1 = editor.worldToScreen(w.x1, w.y1);
              const p2 = editor.worldToScreen(w.x2, w.y2);
              
              editor.ctx.save();
              editor.ctx.strokeStyle = "#06b6d4";
              editor.ctx.lineWidth = Math.max(3, w.thickness * editor.zoom + 4);
              editor.ctx.setLineDash([4, 4]);
              editor.ctx.beginPath();
              editor.ctx.moveTo(p1.x, p1.y);
              editor.ctx.lineTo(p2.x, p2.y);
              editor.ctx.stroke();
              editor.ctx.restore();
            }
          });
        };
      }
    }, 600);
  },

  loadScript: function(src) {
    return new Promise((resolve) => {
      // Prevent duplicate scripts in DOM
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = (e) => {
        console.error(`Failed loading dynamic helper script: ${src}`, e);
        resolve();
      };
      document.head.appendChild(s);
    });
  },

  normalizeItemCategory: function(itemType) {
    const cleanType = (itemType || "").toLowerCase().replace(/_/g, "");
    for (let entry of FURNITURE_REGISTRY) {
      if (entry.aliases.some(alias => cleanType.includes(alias.replace(/_/g, "")))) {
        return entry.category;
      }
    }
    return "Unknown";
  },

  triggerAction: function(action) {
    if (action === "optimize_flow") {
      this.optimizeSpaceLayout();
      return;
    }
    if (action === "auto_furnish") {
      this.sendMessageWithText("Auto furnish this room according to standard layout.");
      return;
    }
    if (action === "estimate_costs") {
      app.selectStudioTabById("cost-estimator");
      this.updateCostEstimates();
      this.appendMessageHtml(
        "Opening the Cost Estimator. Current projected total is **₹" +
          Number(this.getProjectTotal()).toLocaleString('en-IN') + "**.",
        "assistant"
      );
    }
  },

  sendMessageWithText: function(text) {
    const input = document.getElementById("ai-chat-input");
    if (input) input.value = text;
    this.sendMessage();
  },

  serializeLiveState: function() {
    if (!window.editor) return {};
    
    const rooms = editor.detectRooms ? editor.detectRooms() : [];
    const activeRoom = editor.selectedRoom || rooms[0];
    let details = { width: 5.0, height: 4.0, area: 20.0, poly: [] };
    let roomWalls = [];
    let doors = [];
    let windows = [];
    let furniture = [];
    let roomType = "living_room";

    if (activeRoom && window.aiRoomDesigner && typeof aiRoomDesigner.analyzeRoom === "function") {
      details = aiRoomDesigner.analyzeRoom(activeRoom);
      roomWalls = typeof aiRoomDesigner.detectWalls === "function" ? aiRoomDesigner.detectWalls(activeRoom) : (editor.walls || []);
      const wallIds = new Set(roomWalls.map(w => w.id));
      doors = editor.items.filter(i => i.type === 'door' && i.wallId && wallIds.has(i.wallId));
      windows = editor.items.filter(i => i.type === 'window' && i.wallId && wallIds.has(i.wallId));
      furniture = editor.items.filter(i => i.type !== 'door' && i.type !== 'window' && i.wallId === undefined);
      
      const typeSelect = document.getElementById("make-room-type");
      if (typeSelect) {
        roomType = typeSelect.value;
      } else {
        if (details.area >= 20.0) roomType = "living_room";
        else if (details.area >= 12.0) roomType = "bedroom";
        else if (details.area >= 7.0) roomType = "kitchen";
        else if (details.area >= 4.5) roomType = "dining_room";
        else if (details.area < 4.5) roomType = "bathroom";
      }
    }

    return {
      // Serialize entire project state (all walls, doors, windows, furniture, rooms) for complete layout analysis
      walls: (editor.walls || []).map(w => ({ id: w.id, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, thickness: w.thickness, height: w.height })),
      roomPolygons: details.poly.map(p => ({ x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) })),
      doors: (editor.items || []).filter(i => i.type === 'door').map(d => ({ id: d.id, x: Number(d.x.toFixed(2)), y: Number(d.y.toFixed(2)), w: d.w, h: d.h, rotation: d.rotation, wallId: d.wallId })),
      windows: (editor.items || []).filter(i => i.type === 'window').map(w => ({ id: w.id, x: Number(w.x.toFixed(2)), y: Number(w.y.toFixed(2)), w: w.w, h: w.h, rotation: w.rotation, wallId: w.wallId })),
      furniture: (editor.items || []).filter(i => i.type !== 'door' && i.type !== 'window').map(f => ({
        id: f.id,
        type: f.type,
        category: this.normalizeItemCategory(f.type),
        x: Number(f.x.toFixed(2)),
        y: Number(f.y.toFixed(2)),
        w: f.w,
        h: f.h,
        depth: f.depth,
        rotation: f.rotation,
        color: f.color,
        material: f.material
      })),
      rooms: rooms.map((r, idx) => ({
        index: idx,
        type: r.area >= 20.0 ? "living_room" : (r.area >= 12.0 ? "bedroom" : (r.area >= 7.0 ? "kitchen" : "bathroom")),
        area: r.area,
        polygon: r.polygon
      })),
      materials: editor.settings.materials || { walls: "white_paint", floors: "oak_wood", doors: "oak" },
      lighting: editor.settings.lighting || { ambient: 0.7, daylight: true },
      dimensions: {
        width: Number(details.width.toFixed(2)),
        height: Number(details.height.toFixed(2)),
        area: Number(details.area.toFixed(2))
      },
      roomType: roomType,
      selectedStyle: this.activeStyle,
      budget: document.getElementById("make-room-budget") ? document.getElementById("make-room-budget").value : "medium",
      floor: editor.currentFloor || 1,
      selectedItem: editor.selectedItem ? { id: editor.selectedItem.id, type: editor.selectedItem.type } : null
    };
  },

  isSending: false,
  lastRequestId: 0,

  sendChatRequest: async function(payload) {
    try {
      const response = await apiClient.post('/api/ai/chat', payload);
      return response;
    } catch (err) {
      const isApiOrAuthError = (err.name === 'ApiError' || err.name === 'AuthenticationError' || err.status || err.statusCode);
      if (isApiOrAuthError) {
        // Structured backend error response - not a transport error
        return {
          success: false,
          replyText: `⚠ ${err.message || 'API Request failed'}`,
          message: err.message,
          code: err.details?.code || 'server_error',
          status: err.status || err.statusCode || 500,
          retryable: !!err.details?.retryable
        };
      }
      
      // Transport connection failures
      const transportErr = new Error(err.message || "Transport connection failed");
      transportErr.isTransport = true;
      throw transportErr;
    }
  },

  normalizeBackendResponse: function(response) {
    if (!response) {
      return {
        success: false,
        replyText: "I'm not sure how to respond.",
        actions: [],
        imageUrlRequested: false,
        imageUrl: null,
        type: "structural",
        extractedStyle: null,
        extractedRoomType: null,
        extractedCameraAngle: null,
        extractedCustomPrompt: null,
        lastImageContext: null,
        metadata: null,
        promptUsed: "",
        style: null,
        camera: null,
        costBreakdown: null,
        designReasoning: null,
        futureSuggestions: null,
        validationWarnings: null
      };
    }
    
    const success = response.success !== false;
    let replyText = "I'm not sure how to respond.";
    if (typeof response.replyText === "string" && response.replyText.trim()) {
      replyText = response.replyText;
    } else if (typeof response.message === "string" && response.message.trim()) {
      replyText = response.message;
    }
    
    return {
      success: success,
      replyText: replyText,
      actions: Array.isArray(response.actions) ? response.actions : [],
      imageUrlRequested: typeof response.imageUrlRequested === "boolean" ? response.imageUrlRequested : !!response.imageUrl,
      imageUrl: response.imageUrl || null,
      type: response.type || "structural",
      extractedStyle: response.extractedStyle || null,
      extractedRoomType: response.extractedRoomType || null,
      extractedCameraAngle: response.extractedCameraAngle || null,
      extractedCustomPrompt: response.extractedCustomPrompt || null,
      lastImageContext: response.lastImageContext || null,
      metadata: response.metadata || null,
      promptUsed: response.promptUsed || "",
      style: response.style || null,
      camera: response.camera || null,
      costBreakdown: response.costBreakdown || null,
      designReasoning: response.designReasoning || null,
      futureSuggestions: response.futureSuggestions || null,
      validationWarnings: response.validationWarnings || null
    };
  },

  normalizeActions: function(response) {
    if (!response) return [];
    const normalized = [];

    // Parse new format
    if (response.actions && Array.isArray(response.actions)) {
      response.actions.forEach(act => {
        if (act && act.action) {
          normalized.push({
            action: act.action,
            targetId: act.targetId || null,
            targetType: act.targetType || (act.action === "add" ? "furniture" : null),
            type: act.type || null,
            x: typeof act.x === "number" ? act.x : undefined,
            y: typeof act.y === "number" ? act.y : undefined,
            w: typeof act.w === "number" ? act.w : undefined,
            h: typeof act.h === "number" ? act.h : undefined,
            depth: typeof act.depth === "number" ? act.depth : undefined,
            rotation: typeof act.rotation === "number" ? act.rotation : undefined,
            color: act.color || undefined,
            material: act.material || undefined,
            value: act.value || undefined,
            reason: act.reason || undefined,
            x1: typeof act.x1 === "number" ? act.x1 : undefined,
            y1: typeof act.y1 === "number" ? act.y1 : undefined,
            x2: typeof act.x2 === "number" ? act.x2 : undefined,
            y2: typeof act.y2 === "number" ? act.y2 : undefined,
            thickness: typeof act.thickness === "number" ? act.thickness : undefined,
            height: typeof act.height === "number" ? act.height : undefined,
            newType: act.newType || undefined,
            name: act.name || undefined,
            ambient: typeof act.ambient === "number" ? act.ambient : undefined,
            daylight: typeof act.daylight === "boolean" ? act.daylight : undefined
          });
        }
      });
    }

    // Parse legacy formatting for backward compatibility
    if (response.furnitureToAdd && Array.isArray(response.furnitureToAdd)) {
      response.furnitureToAdd.forEach(f => {
        normalized.push({ action: "add", targetType: "furniture", type: f.type, x: f.x, y: f.y, rotation: f.rotation, color: f.color, material: f.material, reason: f.reason });
      });
    }
    if (response.furnitureToMove && Array.isArray(response.furnitureToMove)) {
      response.furnitureToMove.forEach(f => {
        normalized.push({ action: "move", targetId: f.targetId, x: f.x, y: f.y, rotation: f.rotation, reason: f.reason });
      });
    }
    if (response.furnitureToRemove && Array.isArray(response.furnitureToRemove)) {
      response.furnitureToRemove.forEach(f => {
        normalized.push({ action: "delete", targetId: f.targetId, reason: f.reason });
      });
    }
    if (response.wallsToAdd && Array.isArray(response.wallsToAdd)) {
      response.wallsToAdd.forEach(w => {
        normalized.push({ action: "add", targetType: "wall", x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, thickness: w.thickness, height: w.height });
      });
    }
    if (response.wallsToRemove && Array.isArray(response.wallsToRemove)) {
      response.wallsToRemove.forEach(w => {
        normalized.push({ action: "delete", targetId: w.targetId || w.id });
      });
    }
    if (response.materials) {
      Object.keys(response.materials).forEach(key => {
        normalized.push({ action: "change_material", targetType: "global", targetId: key, value: response.materials[key] });
      });
    }
    if (response.lighting) {
      normalized.push({ action: "change_lighting", ambient: response.lighting.ambient, daylight: response.lighting.daylight });
    }

    return normalized;
  },

  processChatResponse: function(response, liveState) {
    const normalized = this.normalizeBackendResponse(response);
    const allActions = this.normalizeActions(response);
    
    const hasRoom = liveState.roomPolygons && liveState.roomPolygons.length >= 3;
    const isWholeProject = allActions.some(act => act.targetType === "wall" || act.action === "add_floor" || act.action === "clear_room");

    if (hasRoom && !isWholeProject) {
      try {
        const snapDetails = {
          cx: (liveState.roomPolygons[0].x + (liveState.roomPolygons[2] ? liveState.roomPolygons[2].x : liveState.roomPolygons[0].x)) / 2,
          poly: liveState.roomPolygons
        };

        const snappedActions = allActions.filter(act => {
          if (act.action === "add" && act.targetType === "furniture") {
            if (window.aiRefinement && typeof aiRefinement.validateAndSnapRecommendation === 'function') {
              const snap = aiRefinement.validateAndSnapRecommendation({
                type: 'add',
                x: act.x,
                y: act.y,
                itemType: act.type,
                item: act
              }, editor.items.filter(i => i.type !== 'door' && i.type !== 'window'), editor.walls, editor.items.filter(i => i.type === 'door'), editor.items.filter(i => i.type === 'window'), { x: snapDetails.cx, y: 0 }, snapDetails.poly);
              
              if (snap.valid) {
                act.x = snap.x;
                act.y = snap.y;
                return true;
              }
              return false;
            }
          } else if (act.action === "move") {
            const item = editor.items.find(it => it.id === act.targetId);
            if (!item) return true;
            if (window.aiRefinement && typeof aiRefinement.validateAndSnapRecommendation === 'function') {
              const snap = aiRefinement.validateAndSnapRecommendation({
                type: 'move',
                x: act.x,
                y: act.y,
                targetId: act.targetId,
                item: item
              }, editor.items.filter(i => i.type !== 'door' && i.type !== 'window'), editor.walls, editor.items.filter(i => i.type === 'door'), editor.items.filter(i => i.type === 'window'), { x: snapDetails.cx, y: 0 }, snapDetails.poly);

              if (snap.valid) {
                act.x = snap.x;
                act.y = snap.y;
                return true;
              }
              return false;
            }
          }
          return true;
        });
        
        normalized.actions = snappedActions;
      } catch (snapErr) {
        console.warn("Snapping calculation failed, continuing with original actions:", snapErr);
        normalized.actions = allActions;
      }
    } else {
      normalized.actions = allActions;
    }

    return normalized;
  },

  renderAssistantResponse: function(result) {
    this.appendGeminiResponseBubble(result);
    this.updateCostEstimates();
  },

  sendMessage: async function() {
    if (this.isSending) {
      console.warn("AI Chat: Request is already active, ignoring duplicate send.");
      return;
    }

    const input = document.getElementById("ai-chat-input");
    const sendButton = document.getElementById("ai-chat-send");
    if (!input || !input.value.trim()) return;

    const userMsg = input.value.trim();
    input.value = "";

    this.isSending = true;
    if (input) input.disabled = true;
    if (sendButton) sendButton.disabled = true;

    this.lastRequestId++;
    const currentRequestId = this.lastRequestId;

    this.revertChatPreview();
    this.appendMessageHtml(userMsg, "user");

    const imageKeywords = ["generate image", "show me", "visualize", "render", "create a realistic image", "how would this look", "photorealistic version", "show me how i can improve"];
    const isImageReq = imageKeywords.some(k => userMsg.toLowerCase().includes(k));
    const loadingText = isImageReq ? "Generating photorealistic mockup..." : "Thinking...";

    const thinkingId = "think_" + Date.now();
    this.appendThinkingHtml(thinkingId, loadingText);

    const liveState = this.serializeLiveState();
    
    const requestPayload = { 
      userMessage: userMsg, 
      editorState: liveState, 
      chatHistory: this.chatHistory,
      lastImageContext: this.lastImageContext || null
    };

    try {
      const response = await this.sendChatRequest(requestPayload);

      if (currentRequestId !== this.lastRequestId) {
        console.warn(`Silently discarding stale AI response for request ${currentRequestId} (latest is ${this.lastRequestId}).`);
        return;
      }

      this.removeThinkingHtml(thinkingId);

      const result = this.processChatResponse(response, liveState);

      // Group developer metrics logs
      console.group("AI Chat");
      console.log("Request", requestPayload);
      console.log("HTTP", response.status || 200);
      console.log("Backend Response", response);
      console.log("Normalized Actions", result.actions);
      console.log("Appending", result.replyText);
      console.log("Messages", this.chatHistory);
      console.groupEnd();

      if (result.lastImageContext) {
        this.lastImageContext = result.lastImageContext;
      }

      this.currentChatRecommendation = result;
      this.originalState = {
        walls: JSON.parse(JSON.stringify(editor.walls)),
        items: JSON.parse(JSON.stringify(editor.items)),
        materials: JSON.parse(JSON.stringify(editor.settings.materials || { walls: "white_paint", floors: "oak_wood", doors: "oak" })),
        lighting: JSON.parse(JSON.stringify(editor.settings.lighting || { ambient: 0.7, daylight: true })),
        panX: editor.panX,
        panY: editor.panY,
        zoom: editor.zoom
      };

      this.renderAssistantResponse(result);
      return;

    } catch (err) {
      if (currentRequestId === this.lastRequestId) {
        this.removeThinkingHtml(thinkingId);
        
        if (err.isTransport) {
          console.error("Transport Failure", err);
          this.appendMessageHtml("⚠️ *Google Gemini API Error: " + err.message + ". Switched to local offline heuristics.*", "assistant");
          this.executeOfflineFallback(userMsg, err);
        } else {
          console.error("Processing Failure during AI response handling:", err);
        }
      }
    } finally {
      if (currentRequestId === this.lastRequestId) {
        this.isSending = false;
        if (input) input.disabled = false;
        if (sendButton) sendButton.disabled = false;
        if (input) input.focus();
      }
    }
  },

  appendMessageHtml: function(text, sender) {
    const log = document.getElementById("ai-chat-log");
    if (!log) return;

    if (!this.chatHistory) {
      this.chatHistory = [];
    }
    const lastMsg = this.chatHistory[this.chatHistory.length - 1];
    if (!lastMsg || lastMsg.role !== sender || lastMsg.content !== text) {
      this.chatHistory.push({ role: sender, content: text });
    }

    const div = document.createElement("div");
    div.className = "ai-message " + (sender === "user" ? "user" : "assistant");

    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");

    div.innerHTML = `<p>${html}</p>`;
    log.appendChild(div);
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  },

  appendThinkingHtml: function(id, text) {
    const log = document.getElementById("ai-chat-log");
    if (!log) return;

    const div = document.createElement("div");
    div.id = id;
    div.className = "ai-message assistant thinking";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.gap = "8px";

    div.innerHTML = `
      <div class="loader-spinner" style="width: 12px; height: 12px; border: 2px solid rgba(6,182,212,0.1); border-left-color: var(--accent-cyan); border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>${text}</span>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;
    log.appendChild(div);
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  },

  removeThinkingHtml: function(id) {
    const el = document.getElementById(id);
    if (el) {
      el.remove();
    }
  },

  appendGeminiResponseBubble: function(parsed) {
    const log = document.getElementById("ai-chat-log");
    if (!log) return;

    const div = document.createElement("div");
    div.className = "ai-message assistant";

    const replyText = parsed.replyText || "I'm not sure how to respond.";

    if (parsed.type === "image_generation") {
      const resolution = parsed.metadata?.width ? `${parsed.metadata.width}x${parsed.metadata.height}` : "1024x768";
      const provider = parsed.metadata?.provider || "Pollinations AI";
      
      if (!this.renderHistory) this.renderHistory = [];
      this.renderHistory.push({
        url: parsed.imageUrl,
        prompt: parsed.promptUsed,
        style: parsed.style || (editor.settings && editor.settings.materials ? editor.settings.materials.style : "modern"),
        camera: parsed.camera || "Corner view",
        metadata: parsed.metadata || {}
      });

      if (!this.chatHistory) {
        this.chatHistory = [];
      }
      this.chatHistory.push({ role: "assistant", content: replyText });

      div.innerHTML = `
        <p>${replyText}</p>
        <div style="margin-top: 8px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-color); background: #020408; position: relative; height: 180px;">
          <div class="ai-bubble-loading-container" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 5;">
            <div class="ai-loading-gradient-bg"></div>
            <div class="ai-loading-shimmer"></div>
            <div class="ai-loading-particles">
              <span class="particle p1"></span>
              <span class="particle p2"></span>
              <span class="particle p3"></span>
            </div>
            <div class="ai-loading-spinner-wrapper mini">
              <svg class="ai-spark-icon-rotating" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <div class="ai-spinner-ring"></div>
            </div>
            <span class="ai-loading-subtext" style="font-size: 0.65rem; margin-top: 6px; color: var(--text-muted); font-weight: 500;">Loading render...</span>
          </div>
          <img src="${parsed.imageUrl}" alt="AI Render" class="ai-fade-in-image" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer; opacity: 0; transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1); z-index: 6; position: relative;" onclick="window.open('${parsed.imageUrl}', '_blank')" onload="this.classList.add('loaded'); this.previousElementSibling.style.display = 'none';" onerror="this.classList.add('loaded'); this.previousElementSibling.querySelector('.ai-loading-subtext').textContent='Failed to load render'; this.previousElementSibling.querySelector('.ai-spinner-ring').style.display='none';">
          <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(15,23,42,0.85); color: var(--text-normal); font-size: 0.55rem; padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.08); z-index: 7;">
            ${resolution} | ${provider}
          </div>
        </div>
        <div style="margin-top: 6px; font-size: 0.68rem; color: var(--text-muted); text-align: left; background: rgba(255,255,255,0.02); padding: 8px; border-radius: var(--radius-sm); max-height: 80px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.04);">
          <strong>Prompt used:</strong> ${parsed.promptUsed}
        </div>
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <a href="${parsed.imageUrl}" target="_blank" download="render_${Date.now()}.png" class="btn btn-primary btn-glow" style="flex: 1; font-size: 0.65rem; text-decoration: none; display: flex; align-items: center; justify-content: center; color: #040508; padding: 4px 6px; height: 28px; line-height: 28px; border-radius: var(--radius-sm);">
            Download
          </a>
          <button class="suggestion-btn" onclick="ai.setDesignStyle('${parsed.style || 'modern'}', document.querySelector('.style-btn') || this)" style="flex: 1; font-size: 0.65rem; justify-content: center; padding: 4px 6px; height: 28px; border-radius: var(--radius-sm);">
            Apply Style
          </button>
          <button class="suggestion-btn" onclick="ai.sendMessageWithText('Generate another variation of this render')" style="flex: 1; font-size: 0.65rem; justify-content: center; padding: 4px 6px; height: 28px; border-radius: var(--radius-sm);">
            Another
          </button>
        </div>
      `;
      log.appendChild(div);
      log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
      return;
    }

    let itemsInfoHtml = "";
    const edits = [];
    
    if (parsed.imageUrl && parsed.type !== "image_generation") {
      const resolution = parsed.metadata?.width ? `${parsed.metadata.width}x${parsed.metadata.height}` : "1024x768";
      const provider = parsed.metadata?.provider || "Pollinations AI";
      itemsInfoHtml += `
        <div style="margin-top: 8px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-color); background: #020408; position: relative; height: 180px;">
          <div class="ai-bubble-loading-container" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 5;">
            <div class="ai-loading-gradient-bg"></div>
            <div class="ai-loading-shimmer"></div>
            <div class="ai-loading-particles">
              <span class="particle p1"></span>
              <span class="particle p2"></span>
              <span class="particle p3"></span>
            </div>
            <div class="ai-loading-spinner-wrapper mini">
              <svg class="ai-spark-icon-rotating" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <div class="ai-spinner-ring"></div>
            </div>
            <span class="ai-loading-subtext" style="font-size: 0.65rem; margin-top: 6px; color: var(--text-muted); font-weight: 500;">Loading render...</span>
          </div>
          <img src="${parsed.imageUrl}" alt="AI Render" class="ai-fade-in-image" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer; opacity: 0; transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1); z-index: 6; position: relative;" onclick="window.open('${parsed.imageUrl}', '_blank')" onload="this.classList.add('loaded'); this.previousElementSibling.style.display = 'none';" onerror="this.classList.add('loaded'); this.previousElementSibling.querySelector('.ai-loading-subtext').textContent='Failed to load render'; this.previousElementSibling.querySelector('.ai-spinner-ring').style.display='none';">
          <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(15,23,42,0.85); color: var(--text-normal); font-size: 0.55rem; padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.08); z-index: 7;">
            ${resolution} | ${provider}
          </div>
        </div>
      `;
    }

    // Populate edits list from normalized actions using clean headers
    const normActions = this.normalizeActions(parsed);
    normActions.forEach(act => {
      let actionName = act.action.charAt(0).toUpperCase() + act.action.slice(1);
      if (act.action === "delete") actionName = "Remove";
      
      let detail = "";
      if (act.action === "change_material") {
        actionName = "Update";
        detail = `Materials (${act.targetId || "global"}: ${act.value})`;
      } else if (act.action === "change_lighting") {
        actionName = "Update";
        detail = `Lighting (ambient: ${act.ambient})`;
      } else if (act.targetType === "furniture" || act.type) {
        const typeName = act.type || "";
        detail = `${typeName.replace(/_/g, ' ')}`;
      } else if (act.targetType === "wall") {
        detail = `wall segment`;
      } else if (act.targetId) {
        const item = window.editor ? (editor.items.find(i => i.id === act.targetId) || editor.walls.find(w => w.id === act.targetId)) : null;
        const label = item ? (item.type || "object") : "object";
        detail = `${label.replace(/_/g, ' ')}`;
      }

      let prefix = "⚙";
      if (act.action === "add" || act.action === "create") prefix = "+";
      else if (act.action === "delete" || act.action === "remove") prefix = "✖";
      else if (act.action === "move" || act.action === "rotate") prefix = "➔";
      else if (act.action.startsWith("change")) prefix = "🎨";
      
      edits.push(`${prefix} ${actionName} ${detail}`.trim());
    });

    // Warnings list
    let warningsHtml = "";
    if (parsed.validationWarnings && parsed.validationWarnings.length > 0) {
      warningsHtml = `
        <div class="warnings-box" style="margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); font-size: 0.72rem; color: #f87171;">
          <div style="font-weight: 700; margin-bottom: 2px;">Validation Warnings:</div>
          <ul style="margin: 0; padding-left: 14px; text-align: left;">
            ${parsed.validationWarnings.map(w => `<li>${w}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Future suggestions list
    let suggestionsHtml = "";
    if (parsed.futureSuggestions && parsed.futureSuggestions.length > 0) {
      suggestionsHtml = `
        <div class="suggestions-box" style="margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(6,182,212,0.04); border: 1px solid rgba(6,182,212,0.15); font-size: 0.72rem; color: var(--text-normal);">
          <div style="font-weight: 700; color: var(--accent-cyan); margin-bottom: 2px;">Architectural Suggestions:</div>
          <ul style="margin: 0; padding-left: 14px; text-align: left;">
            ${parsed.futureSuggestions.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Design Reasoning
    let reasoningHtml = "";
    if (parsed.designReasoning) {
      reasoningHtml = `
        <div class="reasoning-box" style="margin-top: 8px; font-size: 0.72rem; color: var(--text-muted); font-style: italic; text-align: left;">
          <strong>Design Reasoning:</strong> ${parsed.designReasoning}
        </div>
      `;
    }

    // Cost Breakdown
    let costHtml = "";
    if (parsed.costBreakdown && parsed.costBreakdown.length > 0) {
      const totalCost = parsed.costBreakdown.reduce((sum, item) => sum + (item.price || 0), 0);
      costHtml = `
        <div class="cost-box" style="margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); font-size: 0.72rem; color: #34d399;">
          <div style="font-weight: 700; margin-bottom: 4px;">Estimated Cost Breakdown:</div>
          <ul style="margin: 0; padding-left: 14px; text-align: left; list-style: none;">
            ${parsed.costBreakdown.map(c => `<li><span style="display:inline-block; width:120px;">${c.item}:</span> <strong>₹${c.price.toLocaleString('en-IN')}</strong></li>`).join('')}
          </ul>
          <div style="margin-top: 6px; border-top: 1px solid rgba(16,185,129,0.3); padding-top: 4px; font-weight: 700;">
            Total Expenses: ₹${totalCost.toLocaleString('en-IN')}
          </div>
        </div>
      `;
    }

    if (edits.length > 0 || parsed.imageUrl) {
      itemsInfoHtml += `
        <div class="chat-recommendation-summary" style="margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); font-size: 0.72rem;">
          <div style="font-weight: 700; color: var(--accent-cyan); margin-bottom: 4px; text-align: left;">Proposed Modifications:</div>
          <ul style="margin: 0; padding-left: 14px; color: var(--text-normal); display: flex; flex-direction: column; gap: 2px; text-align: left;">
            ${edits.map(e => `<li>${e}</li>`).join('')}
          </ul>
          ${warningsHtml}
          ${reasoningHtml}
          ${suggestionsHtml}
          ${costHtml}
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <button class="suggestion-btn apply" onclick="ai.previewChatChanges()" style="flex: 1; font-size: 0.65rem; justify-content: center; padding: 4px 6px;">Preview</button>
            <button class="suggestion-btn apply active" onclick="ai.applyChatChanges()" style="flex: 1; font-size: 0.65rem; justify-content: center; padding: 4px 6px; color: #040508;">Apply</button>
            <button class="suggestion-btn skip" onclick="ai.revertChatPreview()" style="flex: 1; font-size: 0.65rem; justify-content: center; padding: 4px 6px;">Cancel</button>
          </div>
        </div>
      `;
    } else {
      itemsInfoHtml = `
        ${warningsHtml}
        ${reasoningHtml}
        ${suggestionsHtml}
      `;
    }

    if (!this.chatHistory) {
      this.chatHistory = [];
    }
    this.chatHistory.push({ role: "assistant", content: replyText });

    div.innerHTML = `
      <p>${replyText}</p>
      ${itemsInfoHtml}
    `;

    log.appendChild(div);
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  },

  previewChatChanges: function() {
    if (!this.currentChatRecommendation || !this.originalState) return;

    this.revertChatPreviewOnly();

    const rec = this.currentChatRecommendation;
    if (window.aiExecutor) {
      aiExecutor.applyActions(rec, true); // true for isPreview
    }

    editor.draw();
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }

    editor.showToast("👀 Previewing chat alterations in 2D & 3D");
  },

  applyChatChanges: function() {
    if (!this.currentChatRecommendation || !this.originalState) return;

    editor.pushStateToUndo();
    this.revertChatPreviewOnly();

    const rec = this.currentChatRecommendation;
    if (window.aiExecutor) {
      aiExecutor.applyActions(rec, false); // false for isPreview
    }

    // Clear preview flags
    editor.items.forEach(it => delete it.isAiPreview);
    editor.walls.forEach(w => delete w.isAiPreview);

    projects.saveCurrentToStorage();
    editor.draw();
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }

    editor.selectedItem = null;
    editor.updateInspector();

    this.currentChatRecommendation = null;
    this.originalState = null;

    editor.showToast("✓ Chat recommendations committed");
  },

  revertChatPreviewOnly: function() {
    if (!this.originalState) return;

    editor.walls = JSON.parse(JSON.stringify(this.originalState.walls));
    editor.items = JSON.parse(JSON.stringify(this.originalState.items));
    editor.settings.materials = JSON.parse(JSON.stringify(this.originalState.materials));
    if (this.originalState.lighting) {
      editor.settings.lighting = JSON.parse(JSON.stringify(this.originalState.lighting));
    }
    
    editor.panX = this.originalState.panX;
    editor.panY = this.originalState.panY;
    editor.zoom = this.originalState.zoom;
  },

  revertChatPreview: function() {
    if (!this.originalState) return;

    this.revertChatPreviewOnly();

    editor.items.forEach(it => delete it.isAiPreview);
    editor.walls.forEach(w => delete w.isAiPreview);

    editor.draw();
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }

    this.currentChatRecommendation = null;
    this.originalState = null;
  },

  executeOfflineFallback: function(userMsg, error) {
    if (error && !error.isTransport) {
      console.warn("Skipping offline fallback: error is not a transport failure.");
      return;
    }
    const cmd = this.parseCommand(userMsg);
    const result = this.executeCommand(cmd);
    const reply = this.generateResponse(cmd, result);
    this.appendMessageHtml(reply, "assistant");
    this.updateCostEstimates();
  },

  generateResponse: function(cmd, result) {
    if (cmd.action === "estimate") {
      return result.message;
    }
    return result.message || "Action processed successfully.";
  },

  parseCommand: function(msg) {
    const m = msg.toLowerCase();
    
    if (m.includes("add floor") || m.includes("create floor") || m.includes("new floor") || m.includes("add another floor")) {
      return { action: "add_floor" };
    }
    if (m.includes("clear room") || m.includes("empty room") || m.includes("clear layout") || m.includes("delete all")) {
      return { action: "clear_room" };
    }
    if (m.includes("remove selected") || m.includes("delete selected")) {
      return { action: "remove_selected" };
    }
    if (m.includes("optimize") || m.includes("arrange") || m.includes("layout")) {
      return { action: "optimize" };
    }
    if (m.includes("cost") || m.includes("estimate") || m.includes("budget")) {
      return { action: "estimate" };
    }
    if (m.includes("window")) {
      return { action: "add", type: "window", quantity: 1 };
    }
    if (m.includes("door")) {
      return { action: "add", type: "door", quantity: 1 };
    }

    let quantity = 1;
    if (m.includes("two") || m.includes("2")) quantity = 2;

    const types = [
      "sofa", "chair", "table_coffee", "tv_stand", "bed_double", "wardrobe", "nightstand", 
      "dining_table", "kitchen_island", "plant", "staircase", "desk", "bookshelf", 
      "bath_tub", "wash_basin", "lamp_floor", "office_chair"
    ];
    
    for (let t of types) {
      if (m.includes(t)) {
        return { action: "add", type: t, quantity: quantity };
      }
    }
    return { action: "unknown" };
  },

  executeCommand: function(cmd) {
    if (!window.editor) return { success: false, message: "Editor offline" };
    
    switch (cmd.action) {
      case "add":
        return this.addFurniture(cmd.type, cmd.quantity);
      case "remove_selected":
        return this.removeSelected();
      case "clear_room":
        return this.clearRoom();
      case "optimize":
        return this.optimizeLayout();
      case "estimate":
        return this.estimateCost();
      case "add_floor":
        editor.addNewFloor();
        return { success: true, message: "Added floor" };
      default:
        return { success: false, message: "Unrecognized request. Type a standard furniture item or layout directive." };
    }
  },

  distanceToWall: function(pt, w) {
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) return Math.hypot(pt.x - w.x1, pt.y - w.y1);
    let t = ((pt.x - w.x1) * dx + (pt.y - w.y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(pt.x - (w.x1 + t * dx), pt.y - (w.y1 + t * dy));
  },

  findClearSpot: function(type, startPt) {
    const radius = 0.8;
    let bestPt = { x: startPt.x, y: startPt.y };
    let found = false;
    for (let ring = 0; ring < 6; ring++) {
      const step = ring * 0.4;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const testX = startPt.x + Math.sin(angle) * step;
        const testY = startPt.y + Math.cos(angle) * step;
        const snapped = editor.snapCoords({ x: testX, y: testY });
        let collide = false;
        
        for (let w of editor.walls) {
          if (this.distanceToWall(snapped, w) < (w.thickness / 2 + radius)) { collide = true; break; }
        }
        if (!collide) {
          for (let item of editor.items) {
            if (Math.hypot(snapped.x - item.x, snapped.y - item.y) < radius + 0.5) { collide = true; break; }
          }
        }
        if (!collide) { bestPt = snapped; found = true; break; }
      }
      if (found) break;
    }
    return bestPt;
  },

  addFurniture: function(type, quantity) {
    editor.pushStateToUndo();
    const presets = {
      sofa: { w: 2.0, h: 0.9, depth: 0.8, color: "#475569", material: "fabric" },
      chair: { w: 0.8, h: 0.8, depth: 0.85, color: "#f8fafc", material: "wood" },
      table_coffee: { w: 1.0, h: 0.6, depth: 0.45, color: "#78350f", material: "wood" },
      tv_stand: { w: 1.6, h: 0.4, depth: 0.5, color: "#1e293b", material: "metal" },
      bed_double: { w: 1.8, h: 2.0, depth: 0.65, color: "#cbd5e1", material: "fabric" },
      wardrobe: { w: 1.5, h: 0.6, depth: 2.2, color: "#1c1917", material: "wood" },
      nightstand: { w: 0.5, h: 0.5, depth: 0.5, color: "#27272a", material: "wood" },
      dining_table: { w: 1.6, h: 0.9, depth: 0.75, color: "#b45309", material: "wood" },
      kitchen_island: { w: 1.8, h: 0.8, depth: 0.95, color: "#f1f5f9", material: "marble" },
      plant: { w: 0.6, h: 0.6, depth: 1.5, color: "#10b981", material: "fabric" },
      desk: { w: 1.4, h: 0.7, depth: 0.75, color: "#a16207", material: "wood" },
      bookshelf: { w: 1.0, h: 0.4, depth: 1.8, color: "#78350f", material: "wood" },
      bath_tub: { w: 1.7, h: 0.8, depth: 0.6, color: "#ffffff", material: "marble" },
      wash_basin: { w: 0.8, h: 0.55, depth: 0.85, color: "#f8fafc", material: "wood" },
      lamp_floor: { w: 0.4, h: 0.4, depth: 1.6, color: "#eab308", material: "metal" },
      office_chair: { w: 0.65, h: 0.65, depth: 0.9, color: "#1e293b", material: "fabric" }
    };
    
    const specs = presets[type] || { w: 1.0, h: 1.0, depth: 0.8, color: "#ffffff", material: "wood" };
    const viewCenter = editor.screenToWorld(editor.canvas.width / 2, editor.canvas.height / 2);
    
    for (let i = 0; i < quantity; i++) {
      const spot = this.findClearSpot(type, viewCenter);
      editor.items.push({
        id: "f_" + Date.now() + "_" + i,
        type: type,
        x: spot.x,
        y: spot.y,
        w: specs.w,
        h: specs.h,
        depth: specs.depth,
        rotation: 0,
        color: specs.color,
        material: specs.material
      });
    }
    
    editor.draw();
    if (window.threeViewer) threeViewer.needsRebuild = true;
    projects.saveCurrentToStorage();
    this.updateCostEstimates();
    return { success: true, message: `Added ${type}.` };
  },

  removeSelected: function() {
    if (!editor.selectedItem) return { success: false, message: "Select object" };
    editor.pushStateToUndo();
    editor.deleteSelectedItem();
    return { success: true, message: "Removed selected" };
  },

  clearRoom: function() {
    editor.pushStateToUndo();
    editor.items = [];
    editor.walls = [];
    editor.selectedItem = null;
    editor.draw();
    if (window.threeViewer) threeViewer.needsRebuild = true;
    projects.saveCurrentToStorage();
    return { success: true, message: "Cleared room." };
  },

  optimizeSpaceLayout: function() {
    const result = this.optimizeLayout();
    this.appendMessageHtml(result.success ? `✓ ${result.message}` : `✗ ${result.message}`, "assistant");
  },

  // 4. RULE-BASED OPTIMIZER USING REGISTRY CATEGORIES
  optimizeLayout: function() {
    if (!window.editor || editor.items.length === 0) {
      return { success: false, message: "Please place some furniture items on the canvas first so I can arrange them." };
    }

    const rooms = editor.detectRooms ? editor.detectRooms() : [];
    if (rooms.length === 0) {
      return { success: false, message: "No room boundaries detected. Draw walls first." };
    }

    const activeRoom = editor.selectedRoom || rooms[0];
    const details = aiRoomDesigner.analyzeRoom(activeRoom);
    if (!details) return { success: false, message: "Could not analyze active room geometry." };

    const walls = aiRoomDesigner.detectWalls(activeRoom);
    const doors = aiRoomDesigner.detectDoors(activeRoom);
    const windows = aiRoomDesigner.detectWindows(activeRoom);

    // Filter items inside room
    const roomItems = editor.items.filter(item => {
      if (item.type === 'door' || item.type === 'window') return false;
      return editor.isPointInPolygon({ x: item.x, y: item.y }, details.poly);
    });

    if (roomItems.length === 0) {
      return { success: false, message: "No furniture found inside the active room to optimize." };
    }

    // A. Detect Categories
    const detectedCategories = new Set();
    roomItems.forEach(item => {
      const cat = this.normalizeItemCategory(item.type);
      detectedCategories.add(cat);
    });

    // B. Detect Room Type
    let roomType = "living_room";
    if (detectedCategories.has("Bed")) {
      roomType = "bedroom";
    } else if (detectedCategories.has("Sofa")) {
      roomType = "living_room";
    } else if (detectedCategories.has("KitchenCabinet") || detectedCategories.has("KitchenIsland")) {
      roomType = "kitchen";
    } else if (detectedCategories.has("Desk")) {
      roomType = "office";
    } else if (detectedCategories.has("Toilet") || detectedCategories.has("Bathtub") || detectedCategories.has("Shower")) {
      roomType = "bathroom";
    }

    // Scoring heuristics
    const calculateOptimizationScore = (itemsList) => {
      let score = 100;
      let collisions = 0;
      let blockedDoors = 0;
      let blockedWindows = 0;

      for (let i = 0; i < itemsList.length; i++) {
        const itemA = itemsList[i];
        const catA = this.normalizeItemCategory(itemA.type);
        
        // Collisions
        for (let j = i + 1; j < itemsList.length; j++) {
          const itemB = itemsList[j];
          const dist = Math.hypot(itemA.x - itemB.x, itemA.y - itemB.y);
          if (dist < 0.7) {
            collisions++;
            score -= 15;
          }
        }

        // Door Blockages
        doors.forEach(d => {
          const dist = Math.hypot(itemA.x - d.x, itemA.y - d.y);
          if (dist < 0.9) {
            blockedDoors++;
            score -= 25;
          }
        });

        // Window Blockages for tall items
        windows.forEach(w => {
          const dist = Math.hypot(itemA.x - w.x, itemA.y - w.y);
          const registryEntry = FURNITURE_REGISTRY.find(e => e.category === catA);
          const height = registryEntry ? registryEntry.height : 0.8;
          if (dist < 0.6 && height > 1.2) {
            blockedWindows++;
            score -= 15;
          }
        });

        // Floating bed check
        if (catA === "Bed") {
          let closeToWall = false;
          walls.forEach(wall => {
            const dist = this.distanceToWall(itemA, wall);
            if (dist < 0.5) closeToWall = true;
          });
          if (!closeToWall) {
            score -= 20;
          }
        }
      }

      return {
        score: Math.max(0, score),
        collisions,
        blockedDoors,
        blockedWindows
      };
    };

    const scoreBefore = calculateOptimizationScore(roomItems);

    // Save initial coordinates to compare
    const beforeState = JSON.stringify(editor.items.map(it => ({ id: it.id, x: it.x, y: it.y, rotation: it.rotation })));

    // C. Longest Wall Focal Alignment Calculations
    const longestWall = aiRoomDesigner.findLongestSolidWall(walls, doors, windows);
    let wallNormal = { x: 0, y: 1 };
    
    if (longestWall) {
      const dx = longestWall.x2 - longestWall.x1;
      const dy = longestWall.y2 - longestWall.y1;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      const midx = (longestWall.x1 + longestWall.x2) / 2;
      const midy = (longestWall.y1 + longestWall.y2) / 2;
      const testInside = editor.isPointInPolygon({ x: midx + nx * 0.3, y: midy + ny * 0.3 }, details.poly);
      wallNormal = testInside ? { x: nx, y: ny } : { x: -nx, y: -ny };
    }

    const getFocalCoord = (offsetDist) => {
      if (!longestWall) return { x: details.cx, y: details.cy };
      const midx = (longestWall.x1 + longestWall.x2) / 2;
      const midy = (longestWall.y1 + longestWall.y2) / 2;
      return {
        x: midx + wallNormal.x * offsetDist,
        y: midy + wallNormal.y * offsetDist
      };
    };

    // D. Filter Items By Category
    const beds = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'Bed');
    const nightstands = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'Nightstand');
    const desks = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'Desk');
    const chairs = roomItems.filter(i => ['Chair', 'DiningChair'].includes(this.normalizeItemCategory(i.type)));
    const wardrobes = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'Wardrobe');
    const bookshelves = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'Bookshelf');
    const sofas = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'Sofa');
    const tvs = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'TV');
    const coffee = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'CoffeeTable');
    const plants = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'Plant');
    const lamps = roomItems.filter(i => this.normalizeItemCategory(i.type) === 'Lamp');
    const tables = roomItems.filter(i => ['DiningTable', 'KitchenIsland', 'KitchenCabinet'].includes(this.normalizeItemCategory(i.type)));

    // Apply Positioning Solver
    // 1. Bedroom Layout Solver
    if (beds.length > 0) {
      const bed = beds[0];
      const pt = getFocalCoord(bed.h / 2 + 0.15);
      bed.x = pt.x;
      bed.y = pt.y;
      bed.rotation = Math.round(Math.atan2(-wallNormal.y, -wallNormal.x) * (180 / Math.PI));

      nightstands.forEach((ns, idx) => {
        const side = idx === 0 ? -1 : 1;
        const angleRad = (bed.rotation + 90) * (Math.PI / 180);
        ns.x = bed.x + Math.cos(angleRad) * (1.15 * side);
        ns.y = bed.y - Math.sin(angleRad) * (1.15 * side);
        ns.rotation = bed.rotation;
      });
    }

    // 2. Living Room Layout Solver
    if (sofas.length > 0) {
      const sofa = sofas[0];
      if (tvs.length > 0) {
        const tv = tvs[0];
        const ptTv = getFocalCoord(tv.h / 2 + 0.15);
        tv.x = ptTv.x;
        tv.y = ptTv.y;
        tv.rotation = Math.round(Math.atan2(-wallNormal.y, -wallNormal.x) * (180 / Math.PI));

        const ptSofa = getFocalCoord(details.height - sofa.h / 2 - 0.55);
        sofa.x = ptSofa.x;
        sofa.y = ptSofa.y;
        sofa.rotation = Math.round(Math.atan2(wallNormal.y, wallNormal.x) * (180 / Math.PI));
      } else {
        const pt = getFocalCoord(sofa.h / 2 + 0.15);
        sofa.x = pt.x;
        sofa.y = pt.y;
        sofa.rotation = Math.round(Math.atan2(-wallNormal.y, -wallNormal.x) * (180 / Math.PI));
      }

      if (coffee.length > 0) {
        const angleRad = sofa.rotation * (Math.PI / 180);
        coffee[0].x = sofa.x + Math.sin(angleRad) * 0.95;
        coffee[0].y = sofa.y + Math.cos(angleRad) * 0.95;
        coffee[0].rotation = sofa.rotation;
      }
    }

    // 3. Desk Workstation Layout Solver
    if (desks.length > 0) {
      const desk = desks[0];
      if (windows.length > 0) {
        const win = windows[0];
        desk.x = win.x + (details.cx - win.x) * 0.35;
        desk.y = win.y + (details.cy - win.y) * 0.35;
        desk.rotation = win.rotation;
      } else {
        desk.x = details.cx - 1.25;
        desk.y = details.cy;
        desk.rotation = 90;
      }

      if (chairs.length > 0) {
        const chair = chairs[0];
        const angleRad = desk.rotation * (Math.PI / 180);
        chair.x = desk.x - Math.sin(angleRad) * 0.65;
        chair.y = desk.y - Math.cos(angleRad) * 0.65;
        chair.rotation = desk.rotation;
      }
    }

    // 4. Cabinet flush lines
    const storageItems = [...wardrobes, ...bookshelves];
    storageItems.forEach((item, idx) => {
      const nonFocalWalls = walls.filter(w => !longestWall || w.id !== longestWall.id);
      const targetWall = nonFocalWalls.length > 0 ? nonFocalWalls[idx % nonFocalWalls.length] : walls[0];
      if (targetWall) {
        const midx = (targetWall.x1 + targetWall.x2) / 2;
        const midy = (targetWall.y1 + targetWall.y2) / 2;
        item.x = midx;
        item.y = midy;
        const dx = targetWall.x2 - targetWall.x1;
        const dy = targetWall.y2 - targetWall.y1;
        item.rotation = Math.round(Math.atan2(dy, dx) * (180 / Math.PI)) + 90;
      }
    });

    // 5. Centered tables / countertops
    if (tables.length > 0) {
      const tbl = tables[0];
      tbl.x = details.cx;
      tbl.y = details.cy;
      tbl.rotation = 0;

      const diningChairs = chairs.filter(c => c !== (desks.length > 0 ? chairs[0] : null));
      diningChairs.forEach((chair, idx) => {
        const side = idx % 2 === 0 ? -1 : 1;
        if (idx < 2) {
          chair.x = tbl.x + 0.85 * side;
          chair.y = tbl.y;
          chair.rotation = tbl.rotation + 90 * side;
        } else {
          chair.x = tbl.x;
          chair.y = tbl.y + 0.85 * (idx === 2 ? -1 : 1);
          chair.rotation = tbl.rotation + (idx === 2 ? 180 : 0);
        }
      });
    }

    // 6. Plants / Lamps in corners
    const cornerItems = [...plants, ...lamps];
    cornerItems.forEach((item, idx) => {
      const corners = [
        { x: details.minX + 0.65, y: details.minY + 0.65 },
        { x: details.maxX - 0.65, y: details.minY + 0.65 },
        { x: details.maxX - 0.65, y: details.maxY - 0.65 },
        { x: details.minX - 0.65, y: details.maxY - 0.65 }
      ];
      const targetCorner = corners[idx % 4];
      item.x = targetCorner.x;
      item.y = targetCorner.y;
      item.rotation = 0;
    });

    // Collision Repulsion and Snapping Audits
    roomItems.forEach(item => {
      const snap = aiRefinement.validateAndSnapRecommendation({
        type: 'move',
        x: item.x,
        y: item.y,
        targetId: item.id,
        item: item
      }, editor.items.filter(it => it.id !== item.id && it.type !== 'door' && it.type !== 'window'), walls, doors, windows, { x: details.cx, y: details.cy }, details.poly);

      if (snap.valid) {
        item.x = snap.x;
        item.y = snap.y;
      }
    });

    // Snap to grid coordinates
    roomItems.forEach(item => {
      const snapped = editor.snapCoords({ x: item.x, y: item.y });
      item.x = snapped.x;
      item.y = snapped.y;
    });

    const scoreAfter = calculateOptimizationScore(roomItems);

    // Count moved items
    const afterState = JSON.stringify(editor.items.map(it => ({ id: it.id, x: it.x, y: it.y, rotation: it.rotation })));
    const changed = beforeState !== afterState;

    let movedItemsCount = 0;
    const beforeObj = JSON.parse(beforeState);
    const afterObj = JSON.parse(afterState);
    
    beforeObj.forEach((bItem, idx) => {
      const aItem = afterObj[idx];
      if (aItem && (bItem.x !== aItem.x || bItem.y !== aItem.y || bItem.rotation !== aItem.rotation)) {
        movedItemsCount++;
      }
    });

    // E. Console Logs
    console.log("Detected Categories:", Array.from(detectedCategories).join(", "));
    console.log("Detected Room Type:", roomType);
    console.log("Optimization Score Before:", scoreBefore.score);
    console.log("Optimization Score After:", scoreAfter.score);
    console.log("Furniture Moved:", movedItemsCount);
    console.log("Collisions Removed:", Math.max(0, scoreBefore.collisions - scoreAfter.collisions));
    console.log("Clearance Improved:", Math.max(0, (scoreBefore.blockedDoors + scoreBefore.blockedWindows) - (scoreAfter.blockedDoors + scoreAfter.blockedWindows)));

    if (changed && movedItemsCount > 0) {
      editor.pushStateToUndo();
      projects.saveCurrentToStorage();
      editor.draw();
      if (window.threeViewer) {
        threeViewer.needsRebuild = true;
      }
      return { success: true, message: `Layout Optimized. Moved ${movedItemsCount} items.` };
    } else {
      return { success: false, message: "No improvements were necessary." };
    }
  },

  generateLocalCostBreakdownReport: function() {
    let wLen = 0;
    editor.walls.forEach(w => wLen += Math.hypot(w.x2 - w.x1, w.y2 - w.y1));
    const wallArea = wLen * 2.8;
    const rooms = editor.detectRooms ? editor.detectRooms() : [];
    let floorArea = 0;
    rooms.forEach(r => floorArea += r.area);
    if (floorArea === 0) {
      floorArea = 20; // default/fallback
    }

    let costPerSqMeterWall = 6000;
    let costPerSqMeterFloor = 2500;
    
    if (this.activeStyle === "luxury") {
      costPerSqMeterWall = 12000;
      costPerSqMeterFloor = 5500;
    } else if (this.activeStyle === "minimalist") {
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
    if (this.activeStyle === "luxury") multiplier = 2.2;
    if (this.activeStyle === "minimalist") multiplier = 0.85;

    // Categorize
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
    editor.items.forEach(item => {
      counts[item.type] = (counts[item.type] || 0) + 1;
    });

    const padLabel = (label, targetLen = 30) => {
      const dots = targetLen - label.length;
      return label + " " + ".".repeat(Math.max(1, dots)) + " ";
    };

    let totalMedium = 0;

    Object.keys(counts).forEach(type => {
      if (type === "door" || type === "window") return; // counted separately
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
    });

    // Add walls, floors, doors, windows if not in items list
    if (wallCostTotal > 0) {
      categories["Walls"].push({ label: "Paint & Wall Finishings", cost: wallCostTotal });
      totalMedium += wallCostTotal;
    }
    if (floorCostTotal > 0) {
      categories["Flooring"].push({ label: `${this.activeStyle.replace(/\b\w/g, c => c.toUpperCase())} Flooring`, cost: floorCostTotal });
      totalMedium += floorCostTotal;
    }
    if (ceilingCostTotal > 0) {
      categories["Lighting"].push({ label: "Ceiling & False Ceiling", cost: ceilingCostTotal });
      totalMedium += ceilingCostTotal;
    }

    // Windows / Doors
    const doorCount = editor.items.filter(i => i.type === 'door').length;
    const windowCount = editor.items.filter(i => i.type === 'window').length;
    if (doorCount > 0) {
      categories["Doors"].push({ label: `Main & Room Doors (${doorCount})`, cost: doorCount * 18000 });
      totalMedium += doorCount * 18000;
    }
    if (windowCount > 0) {
      categories["Windows"].push({ label: `Glass Windows (${windowCount})`, cost: windowCount * 25000 });
      totalMedium += windowCount * 25000;
      // Add curtains
      categories["Decoration"].push({ label: `Curtains`, cost: windowCount * 9000 });
      totalMedium += windowCount * 9000;
    }

    let report = "";
    Object.keys(categories).forEach(cat => {
      if (categories[cat].length > 0) {
        report += `**${cat}**\n`;
        categories[cat].forEach(item => {
          report += `• ${padLabel(item.label)} ₹${item.cost.toLocaleString('en-IN')}\n`;
        });
        report += `\n`;
      }
    });

    const lowEstimate = Math.round(totalMedium * 0.7);
    const premiumEstimate = Math.round(totalMedium * 1.8);

    report += `------------------------------------\n\n`;
    report += `**Estimated Total**\n`;
    report += `**₹${totalMedium.toLocaleString('en-IN')}**\n\n`;
    report += `Low Budget Estimate: **₹${lowEstimate.toLocaleString('en-IN')}**\n`;
    report += `Medium Estimate: **₹${totalMedium.toLocaleString('en-IN')}**\n`;
    report += `Premium Estimate: **₹${premiumEstimate.toLocaleString('en-IN')}**\n\n`;
    report += `*Note: Values are estimated and may vary depending on brand, city, labour, taxes, and material quality.*`;

    return report;
  },

  estimateCost: function() {
    this.updateCostEstimates();
    const report = this.generateLocalCostBreakdownReport();
    return { success: true, message: report };
  },

  updateCostEstimates: function() {
    const container = document.getElementById("cost-estimator-container");
    if (!container || !window.editor) return;
    
    let totalWallLen = 0;
    editor.walls.forEach(w => totalWallLen += Math.hypot(w.x2 - w.x1, w.y2 - w.y1));
    const rooms = editor.detectRooms();
    let totalFloorArea = 0;
    rooms.forEach(r => totalFloorArea += r.area);
    
    let costPerSqMeterWall = 6000;
    let costPerSqMeterFloor = 2500;
    
    if (this.activeStyle === "luxury") {
      costPerSqMeterWall = 12000;
      costPerSqMeterFloor = 5500;
    } else if (this.activeStyle === "minimalist") {
      costPerSqMeterWall = 5000;
      costPerSqMeterFloor = 2000;
    }
    
    const wallArea = totalWallLen * 2.8;
    const wallCostTotal = Math.round(wallArea * costPerSqMeterWall);
    const floorCostTotal = Math.round(totalFloorArea * costPerSqMeterFloor);
    
    const itemPrices = {
      door: 15000,
      window: 25000,
      sofa: 65000,
      chair: 12000,
      table_coffee: 18000,
      tv_stand: 22000,
      bed_double: 75000,
      wardrobe: 50000,
      nightstand: 8500,
      dining_table: 45000,
      kitchen_island: 95000,
      plant: 4500,
      desk: 35000,
      bookshelf: 28000,
      bath_tub: 85000,
      wash_basin: 24000,
      lamp_floor: 14500,
      office_chair: 18500
    };
    
    let multiplier = 1.0;
    if (this.activeStyle === "luxury") multiplier = 2.2;
    if (this.activeStyle === "minimalist") multiplier = 0.85;
    
    let itemsTotal = 0;
    let itemsRowsHtml = "";
    const catalogCount = {};
    editor.items.forEach(item => catalogCount[item.type] = (catalogCount[item.type] || 0) + 1);
    
    Object.keys(catalogCount).forEach(type => {
      const count = catalogCount[type];
      const basePrice = itemPrices[type] || 15000;
      const finalUnitPrice = Math.round(basePrice * multiplier);
      const rowTotal = finalUnitPrice * count;
      itemsTotal += rowTotal;
      
      itemsRowsHtml += `
        <tr>
          <td>${type.toUpperCase().replace('_', ' ')}</td>
          <td>${count}</td>
          <td class="text-right">₹${finalUnitPrice.toLocaleString('en-IN')}</td>
          <td class="text-right">₹${rowTotal.toLocaleString('en-IN')}</td>
        </tr>
      `;
    });
    
    const projectTotal = wallCostTotal + floorCostTotal + itemsTotal;
    
    container.innerHTML = `
      <div class="estimator-summary-card glass">
        <p class="text-xs text-muted" style="text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Total Projected Cost (${this.activeStyle.toUpperCase()} style)</p>
        <div class="est-val" style="margin: 4px 0 8px;">₹${projectTotal.toLocaleString('en-IN')}</div>
      </div>
      <div class="inspector-group">
        <h4>Detailed Bill of Materials</h4>
        <table class="estimator-table">
          <thead>
            <tr>
              <th>Material / Item Description</th>
              <th>Qty / Area</th>
              <th class="text-right">Unit Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Structural Wall Framing (2.8m height)</td>
              <td>${wallArea.toFixed(1)} m²</td>
              <td class="text-right">₹${costPerSqMeterWall.toLocaleString('en-IN')} / m²</td>
              <td class="text-right">₹${wallCostTotal.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td>Floor Finish Materials</td>
              <td>${totalFloorArea.toFixed(1)} m²</td>
              <td class="text-right">₹${costPerSqMeterFloor.toLocaleString('en-IN')} / m²</td>
              <td class="text-right">₹${floorCostTotal.toLocaleString('en-IN')}</td>
            </tr>
            ${itemsRowsHtml || '<tr><td colspan="4" style="color: var(--text-muted); text-align: center; padding: 20px;">No furniture placed. Drag items to canvas to calculate.</td></tr>'}
            <tr style="font-weight: 700; border-top: 2px solid var(--border-color); color: var(--text-white);">
              <td colspan="2">Net Project Quote</td>
              <td colspan="2" class="text-right" style="color: var(--accent-cyan);">₹${projectTotal.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  getProjectTotal: function() {
    let wLen = 0;
    editor.walls.forEach(w => wLen += Math.hypot(w.x2 - w.x1, w.y2 - w.y1));
    const wallArea = wLen * 2.8;
    const rooms = editor.detectRooms();
    let floorArea = 0;
    rooms.forEach(r => floorArea += r.area);
    
    let multiplier = 1.0;
    if (this.activeStyle === "luxury") multiplier = 2.2;
    if (this.activeStyle === "minimalist") multiplier = 0.85;
    
    const itemPrices = {
      door: 15000,
      window: 25000,
      sofa: 65000,
      chair: 12000,
      table_coffee: 18000,
      tv_stand: 22000,
      bed_double: 75000,
      wardrobe: 50000,
      nightstand: 8500,
      dining_table: 45000,
      kitchen_island: 95000,
      plant: 4500,
      desk: 35000,
      bookshelf: 28000,
      bath_tub: 85000,
      wash_basin: 24000,
      lamp_floor: 14500,
      office_chair: 18500
    };
    
    let itemsTotal = 0;
    editor.items.forEach(item => {
      const base = itemPrices[item.type] || 15000;
      itemsTotal += Math.round(base * multiplier);
    });
    
    let costPerSqMeterWall = 6000;
    let costPerSqMeterFloor = 2500;
    
    if (this.activeStyle === "luxury") {
      costPerSqMeterWall = 12000;
      costPerSqMeterFloor = 5500;
    } else if (this.activeStyle === "minimalist") {
      costPerSqMeterWall = 5000;
      costPerSqMeterFloor = 2000;
    }
    
    return Math.round(wallArea * costPerSqMeterWall + floorArea * costPerSqMeterFloor + itemsTotal);
  },

  setDesignStyle: function(styleName, btnElement) {
    this.activeStyle = styleName;
    const section = btnElement.parentElement;
    if (section) {
      section.querySelectorAll(".style-btn").forEach(b => b.classList.remove("active"));
    }
    if (btnElement) {
      btnElement.classList.add("active");
    }
    
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials(styleName);
      threeViewer.needsRebuild = true;
    }
    
    this.updateCostEstimates();
    this.addSystemMessage("Style set to " + styleName);
  },

  abortImageGeneration: function() {
    if (this.currentGenerationController) {
      console.log("[AI FRONTEND] User clicked Cancel. Aborting generation request...");
      this.currentGenerationController.abort();
      this.currentGenerationController = null;
    }
    if (this.generationTimeoutId) {
      clearTimeout(this.generationTimeoutId);
      this.generationTimeoutId = null;
    }
    const modal = document.getElementById("video-demo-modal");
    if (modal) {
      const body = modal.querySelector(".modal-body-content");
      if (body) {
        body.innerHTML = `
          <div style="padding: 30px; text-align: center; color: var(--text-muted);">
            <p style="font-weight: 600; margin-bottom: 8px; color: var(--text-normal);">Generation Cancelled</p>
            <p style="font-size: 0.75rem;">The photorealistic image generation process was aborted.</p>
            <button class="btn btn-primary" onclick="ai.generateRenderingMockup()" style="margin-top: 16px;">Start New Render</button>
          </div>
        `;
      }
    }
  },

  preloadImageWithRetry: function(url, maxRetries = 3) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const tryLoad = (currentUrl) => {
        attempts++;
        console.log(`[AI FRONTEND] Preloading image (Attempt ${attempts}/${maxRetries + 1}):`, currentUrl);
        const img = new Image();
        
        // Removed crossOrigin='anonymous' to prevent Cloudflare Turnstile from blocking it as an API bot request
        
        img.onload = () => {
          console.log("✓ Native image load successful");
          resolve(currentUrl);
        };
        img.onerror = () => {
          if (attempts <= maxRetries) {
            console.warn(`[AI FRONTEND] Image preload failed. Retrying (Attempt ${attempts + 1})...`);
            const retryUrl = currentUrl.includes("?") 
              ? `${currentUrl}&retry=${Date.now()}` 
              : `${currentUrl}?retry=${Date.now()}`;
            setTimeout(() => tryLoad(retryUrl), 2000);
          } else {
            // We cannot read the exact HTTP error code from a native Image onerror, 
            // but we know it failed after max retries.
            reject(new Error("Pollinations API rejected the image request (Likely Cloudflare Turnstile or Rate Limit). Please try again in a few moments."));
          }
        };
        img.src = currentUrl;
      };

      tryLoad(url);
    });
  },

  triggerImageDownload: async function(url) {
    try {
      if (window.editor) editor.showToast("⏳ Preparing image download...");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `domiq_ai_render_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      if (window.editor) editor.showToast("✓ Image downloaded successfully!");
    } catch (err) {
      console.warn("Direct blob download failed, opening in new tab:", err);
      window.open(url, "_blank");
    }
  },

  generateRenderingMockup: async function() {
    console.log("✓ Button clicked: Generate Photorealistic Mockup");
    const modal = document.getElementById("video-demo-modal");
    if (!modal) return;

    const cameraAngle = document.getElementById("render-camera") ? document.getElementById("render-camera").value : "Corner view";
    const roomType = document.getElementById("render-room-type") ? document.getElementById("render-room-type").value : "Living Room";
    const customPrompt = document.getElementById("render-custom-prompt") ? document.getElementById("render-custom-prompt").value.trim() : "";
    
    const header = modal.querySelector(".modal-header h3");
    const body = modal.querySelector(".modal-body-content");
    
    header.textContent = "Photorealistic AI Render";

    const updateProgress = (statusText) => {
      console.log(`[PIPELINE STAGE] ${statusText}`);
      
      let historyHtml = "";
      if (this.renderHistory && this.renderHistory.length > 0) {
        historyHtml = `
          <div style="margin-top: 12px; opacity: 0.5; pointer-events: none;">
            <h5 style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; text-align: left;">Render History (${this.renderHistory.length})</h5>
            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">
              ${this.renderHistory.map((r, idx) => `
                <img src="${r.url}" alt="Render ${idx + 1}" 
                     style="width: 64px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 2px solid transparent;">
              `).join('')}
            </div>
          </div>
        `;
      }

      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- Preview Container (height: 280px) with Loading State -->
          <div class="ai-loading-container" aria-busy="true">
            <div class="ai-loading-gradient-bg"></div>
            <div class="ai-loading-shimmer"></div>
            <div class="ai-loading-scanline"></div>
            <div class="ai-loading-glow"></div>
            
            <div class="ai-loading-particles">
              <span class="particle p1"></span>
              <span class="particle p2"></span>
              <span class="particle p3"></span>
              <span class="particle p4"></span>
              <span class="particle p5"></span>
              <span class="particle p6"></span>
            </div>

            <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; gap: 12px;">
              <div class="ai-loading-spinner-wrapper">
                <svg class="ai-spark-icon-rotating" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <div class="ai-spinner-ring"></div>
              </div>
              <div style="text-align: center; display: flex; flex-direction: column; gap: 4px;">
                <span class="ai-loading-status-text">${statusText}</span>
                <span class="ai-loading-subtext">Please wait while AI creates your image</span>
              </div>
            </div>
          </div>

          <div style="text-align: left;">
            <h4 style="font-size: 0.95rem; color: var(--accent-cyan); margin-bottom: 4px; text-transform: capitalize;">${cameraAngle} View Setup</h4>
            <p style="font-size: 0.75rem; color: var(--text-normal); line-height: 1.4; max-height: 80px; overflow-y: auto; background: rgba(255,255,255,0.02); padding: 8px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.04);">
              <strong>Status:</strong> Performing high-fidelity synthesis for the ${roomType.toLowerCase()} blueprint using local CAD dimensions.
            </p>
          </div>

          ${historyHtml}

          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button class="btn btn-secondary" onclick="ai.abortImageGeneration()" style="flex: 1; font-size: 0.75rem;">Cancel</button>
            <button class="btn btn-primary btn-glow" disabled style="flex: 1; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; opacity: 0.4; cursor: not-allowed;">
              Download Image
            </button>
          </div>
        </div>
      `;
    };

    updateProgress("Preparing prompt...");
    modal.classList.add("active");

    // Initialize AbortController and Request Timeout (60 seconds)
    if (this.currentGenerationController) {
      this.currentGenerationController.abort();
    }
    this.currentGenerationController = new AbortController();
    const signal = this.currentGenerationController.signal;

    const TIMEOUT_MS = 60000;
    this.generationTimeoutId = setTimeout(() => {
      console.error("[AI FRONTEND ERROR] Generation timed out after 60 seconds.");
      if (this.currentGenerationController) {
        this.currentGenerationController.abort();
      }
    }, TIMEOUT_MS);

    try {
      const liveState = this.serializeLiveState();
      console.log("✓ Prompt created & CAD state serialized");

      updateProgress("Generating image...");
      console.log("✓ Request sent to backend /api/ai/generate-image");

      const result = await apiClient.post('/api/ai/generate-image', {
        editorState: liveState,
        cameraAngle: cameraAngle,
        roomType: roomType,
        customPrompt: customPrompt,
        projectId: projects.activeProject ? projects.activeProject.id : null
      }, { signal });

      updateProgress("Receiving response...");
      console.log("✓ AI provider responded & Image URL received:", result.url);

      if (!result || !result.url) {
        throw new Error("❌ Backend returned invalid response: missing image URL.");
      }

      updateProgress("Rendering image...");
      await this.preloadImageWithRetry(result.url, 3);
      console.log("✓ Image loaded in browser successfully");

      // Clear timeout upon success
      if (this.generationTimeoutId) {
        clearTimeout(this.generationTimeoutId);
        this.generationTimeoutId = null;
      }
      this.currentGenerationController = null;

      // Add to render history
      if (!this.renderHistory) this.renderHistory = [];
      this.renderHistory.push(result);

      // Auto-save project upon successful rendering
      if (window.projects && typeof projects.saveCurrentToStorage === "function") {
        if (projects.activeProject) {
          if (!projects.activeProject.renderings) projects.activeProject.renderings = [];
          projects.activeProject.renderings.push(result);
        }
        projects.saveCurrentToStorage();
        console.log("✓ Project saved successfully with new rendering.");
      }

      this.showRenderDetails(result);

    } catch (err) {
      if (this.generationTimeoutId) {
        clearTimeout(this.generationTimeoutId);
        this.generationTimeoutId = null;
      }
      this.currentGenerationController = null;

      if (err.name === "AbortError") {
        console.log("[AI FRONTEND] Fetch request aborted.");
        return;
      }

      console.error("AI Image Generation failed:", err);
      body.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #f87171;">
          <p style="font-weight: 700; margin-bottom: 12px; font-size: 0.95rem; color: #ef4444; word-break: break-word;">${err.message}</p>
          <div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px;">
            <button class="btn btn-primary" onclick="ai.generateRenderingMockup()">Try Again</button>
            <button class="btn btn-secondary" onclick="app.closeVideoDemo()">Close</button>
          </div>
        </div>
      `;
    }
  },

  showRenderDetails: function(render) {
    const modal = document.getElementById("video-demo-modal");
    if (!modal) return;

    const body = modal.querySelector(".modal-body-content");
    
    let historyHtml = "";
    if (this.renderHistory && this.renderHistory.length > 1) {
      historyHtml = `
        <div style="margin-top: 12px;">
          <h5 style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; text-align: left;">Render History (${this.renderHistory.length})</h5>
          <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">
            ${this.renderHistory.map((r, idx) => `
              <img src="${r.url}" alt="Render ${idx + 1}" 
                   onclick="ai.showRenderDetails(ai.renderHistory[${idx}])" 
                   style="width: 64px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); cursor: pointer; border: 2px solid ${r.url === render.url ? 'var(--accent-cyan)' : 'transparent'}; opacity: ${r.url === render.url ? 1.0 : 0.6}; transition: all 0.2s;"
                   onmouseover="this.style.opacity=1" onmouseout="if(this.style.borderColor!=='var(--accent-cyan)') this.style.opacity=0.6">
            `).join('')}
          </div>
        </div>
      `;
    }

    const providerText = render.metadata?.provider || "Pollinations AI";
    const resolution = `${render.metadata?.width || 1024}x${render.metadata?.height || 768}`;

    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="position: relative; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-color); height: 280px; background: #020408;">
          <div class="ai-bubble-loading-container" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 5;">
            <div class="ai-loading-gradient-bg"></div>
            <div class="ai-loading-shimmer"></div>
            <div class="ai-loading-particles">
              <span class="particle p1"></span>
              <span class="particle p2"></span>
              <span class="particle p3"></span>
              <span class="particle p4"></span>
              <span class="particle p5"></span>
              <span class="particle p6"></span>
            </div>
            <div class="ai-loading-spinner-wrapper">
              <svg class="ai-spark-icon-rotating" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <div class="ai-spinner-ring"></div>
            </div>
            <span class="ai-loading-subtext" style="font-size: 0.72rem; margin-top: 6px; color: var(--text-muted); font-weight: 500;">Loading render...</span>
          </div>
          <img src="${render.url}" alt="AI Mockup Render" class="ai-fade-in-image" style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1); z-index: 6; position: relative;" onload="this.classList.add('loaded'); this.previousElementSibling.style.display = 'none';">
          <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(15,23,42,0.85); color: var(--text-normal); font-size: 0.6rem; padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.08); z-index: 7;">
            ${resolution} | ${providerText}
          </div>
        </div>
        
        <div style="text-align: left;">
          <h4 style="font-size: 0.95rem; color: var(--accent-cyan); margin-bottom: 4px; text-transform: capitalize;">${render.style} Style Preserved</h4>
          <p style="font-size: 0.75rem; color: var(--text-normal); line-height: 1.4; max-height: 80px; overflow-y: auto; background: rgba(255,255,255,0.02); padding: 8px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.04);">
            <strong>Prompt:</strong> ${render.prompt}
          </p>
        </div>
        
        ${historyHtml}

        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button class="btn btn-secondary" onclick="app.closeVideoDemo()" style="flex: 1; font-size: 0.75rem;">Save Rendering</button>
          <button class="btn btn-primary btn-glow" onclick="ai.triggerImageDownload('${render.url}')" style="flex: 1; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; color: #040508; border: none; cursor: pointer;">
            Download Image
          </button>
    `;
  },

  addSystemMessage: function(txt) {
    const notify = document.querySelector(".notification-indicator");
    if (notify) notify.style.display = "block";
  }
};

window.ai = ai;
window.ai.init();
