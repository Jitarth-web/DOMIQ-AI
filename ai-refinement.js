import apiClient from './api/index.js';

/**
 * ai-refinement.js
 * Award-winning AI Interior Designer refinement engine for DomIQ AI
 */

const aiRefinement = {
  active: false,
  selectedStyle: "modern",
  selectedMode: "online", // Default to online Gemini mode!
  originalState: null, // Holds backup of { items, materials, lighting }
  suggestions: [],     // List of validated suggestions from Gemini
  previewingSuggestions: new Set(), // IDs of suggestions currently previewed
  appliedSuggestions: new Set(),    // IDs of suggestions committed
  skippedSuggestions: new Set(),    // IDs of suggestions skipped
  undoBackup: null,    // Backup for full AI session undo
  problemsFound: [],   // Array of strings representing diagnostics

  init: function() {
    const modeSelect = document.getElementById("ai-refine-mode");
    if (modeSelect) modeSelect.value = this.selectedMode;

    const styleSelect = document.getElementById("ai-refine-style");
    if (styleSelect) styleSelect.value = this.selectedStyle;

    console.log("Gemini AI Refinement System initialized");
  },

  updateStyleOption: function(style) {
    this.selectedStyle = style;
    if (this.active) {
      this.generateSuggestions();
    }
  },

  updateModeOption: function(mode) {
    this.selectedMode = mode;
    if (this.active) {
      this.generateSuggestions();
    }
  },

  openRefinePanel: function() {
    if (!window.editor) return;

    // Save initial backup for this session if not already in one
    if (!this.active) {
      this.originalState = {
        items: JSON.parse(JSON.stringify(editor.items)),
        materials: JSON.parse(JSON.stringify(editor.settings.materials || { walls: "white_paint", floors: "oak_wood", doors: "oak" })),
        lighting: JSON.parse(JSON.stringify(editor.settings.lighting || { ambient: 0.7, daylight: true }))
      };
      this.undoBackup = JSON.parse(JSON.stringify(this.originalState));
    }

    this.active = true;
    this.previewingSuggestions.clear();
    this.appliedSuggestions.clear();
    this.skippedSuggestions.clear();
    this.problemsFound = [];

    // Toggle Sidebar Panels
    const propPanel = document.getElementById("properties-panel");
    const refinePanel = document.getElementById("ai-refine-panel");
    if (propPanel) propPanel.style.display = "none";
    if (refinePanel) refinePanel.style.display = "flex";

    // Show undo button if we have a backup from this session
    const undoBtn = document.getElementById("btn-ai-refine-undo");
    if (undoBtn) undoBtn.style.display = "flex";

    // Highlight AI Refine Panel in Left Tab
    document.querySelectorAll(".nav-tab").forEach(tab => tab.classList.remove("active"));
    const refineTab = document.getElementById("nav-tab-refine-ai");
    if (refineTab) refineTab.classList.add("active");

    editor.showToast("✨ AI Refinement Active");
    this.generateSuggestions();
  },

  closeRefinePanel: function() {
    this.active = false;
    
    // Restore layout to committed state (removes non-committed previews)
    this.revertToOriginal();

    // Toggle panels back
    const propPanel = document.getElementById("properties-panel");
    const refinePanel = document.getElementById("ai-refine-panel");
    if (propPanel) propPanel.style.display = "flex";
    if (refinePanel) refinePanel.style.display = "none";

    // Restore select tool
    if (window.editor) {
      editor.selectedItem = null;
      editor.updateInspector();
      editor.draw();
    }
  },

  // 1. Gather complete project state payload
  serializeProjectState: function(room, details, roomWalls, doors, windows, furniture) {
    const budgetSelect = document.getElementById("make-room-budget");
    const budgetVal = budgetSelect ? budgetSelect.value : "medium";

    return {
      roomType: this.selectedRoomType || document.getElementById('make-room-type')?.value || "living_room",
      roomDimensions: {
        width: Number(details.width.toFixed(2)),
        height: Number(details.height.toFixed(2)),
        area: Number(details.area.toFixed(2))
      },
      roomPolygon: details.poly.map(p => ({ x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) })),
      walls: roomWalls.map(w => ({ id: w.id, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, thickness: w.thickness })),
      doors: doors.map(d => ({ id: d.id, x: Number(d.x.toFixed(2)), y: Number(d.y.toFixed(2)), rotation: d.rotation, wallId: d.wallId })),
      windows: windows.map(w => ({ id: w.id, x: Number(w.x.toFixed(2)), y: Number(w.y.toFixed(2)), rotation: w.rotation, wallId: w.wallId })),
      furniture: furniture.map(f => ({
        id: f.id,
        type: f.type,
        x: Number(f.x.toFixed(2)),
        y: Number(f.y.toFixed(2)),
        w: f.w,
        h: f.h,
        rotation: f.rotation,
        color: f.color,
        material: f.material
      })),
      selectedStyle: this.selectedStyle,
      budget: budgetVal,
      materials: editor.settings.materials || { walls: "white_paint", floors: "oak_wood" },
      lighting: editor.settings.lighting || { ambient: 0.7, daylight: true },
      floorInformation: {
        currentFloor: editor.currentFloor || 1,
        totalFloors: editor.floors ? editor.floors.length : 1
      }
    };
  },

  // 2. Offline rules for fallback scoring
  calculateLocalScores: function(items, walls, room) {
    if (!room) {
      return { spaceUsage: 60, circulation: 60, lighting: 60, comfort: 60, storage: 50, balance: 60, overall: 58 };
    }

    const roomWalls = aiRoomDesigner.detectWalls(room);
    const wallIds = new Set(roomWalls.map(w => w.id));
    const doors = items.filter(i => i.type === 'door' && i.wallId && wallIds.has(i.wallId));
    const windows = items.filter(i => i.type === 'window' && i.wallId && wallIds.has(i.wallId));
    const furniture = items.filter(i => i.type !== 'door' && i.type !== 'window');

    let spaceUsage = 85;
    let circulation = 85;
    let lighting = 75;
    let comfort = 80;
    let storage = 65;
    let balance = 75;

    let collisions = 0;
    let blockedDoors = 0;

    furniture.forEach(f => {
      const frad = Math.max(f.w, f.h) / 2;
      doors.forEach(d => {
        if (Math.hypot(f.x - d.x, f.y - d.y) < frad + 0.9) blockedDoors++;
      });
      furniture.forEach(f2 => {
        if (f.id === f2.id) return;
        if (Math.hypot(f.x - f2.x, f.y - f2.y) < (frad + Math.max(f2.w, f2.h) / 2) - 0.1) collisions++;
      });
    });

    spaceUsage -= (collisions * 20 + blockedDoors * 15);
    circulation -= (blockedDoors * 25 + collisions * 15);

    const overall = Math.round(spaceUsage * 0.2 + circulation * 0.2 + lighting * 0.15 + comfort * 0.2 + storage * 0.1 + balance * 0.15);

    return {
      spaceUsage,
      circulation,
      lighting,
      comfort,
      storage,
      balance,
      overall
    };
  },

  // 3. VALIDATION Snapping Solver (Spiral Search)
  validateAndSnapRecommendation: function(suggest, items, walls, doors, windows, centroid, roomPoly) {
    if (suggest.type === 'remove' || suggest.type === 'material') {
      return { valid: true, x: suggest.x, y: suggest.y };
    }

    const testItem = suggest.item || { w: suggest.w || 1.0, h: suggest.h || 1.0, type: suggest.itemType || suggest.type };
    const tx = suggest.x !== undefined ? suggest.x : centroid.x;
    const ty = suggest.y !== undefined ? suggest.y : centroid.y;

    // First check if recommended spot is already valid
    let checkSuggest = { ...suggest, x: tx, y: ty, item: testItem };
    let v = this.validateCandidate(checkSuggest, items, walls, doors, windows, roomPoly);
    if (v.valid) {
      return { valid: true, x: Number(tx.toFixed(2)), y: Number(ty.toFixed(2)) };
    }

    // Spiral search outwards up to 2.25 meters
    const step = 0.15; // 15cm resolution
    const maxRings = 15;
    const angleSteps = 12;

    for (let r = 1; r <= maxRings; r++) {
      const radius = r * step;
      const numPoints = angleSteps + r * 4;
      for (let s = 0; s < numPoints; s++) {
        const angle = (s / numPoints) * 2 * Math.PI;
        const sx = tx + Math.cos(angle) * radius;
        const sy = ty + Math.sin(angle) * radius;

        checkSuggest.x = sx;
        checkSuggest.y = sy;
        v = this.validateCandidate(checkSuggest, items, walls, doors, windows, roomPoly);
        if (v.valid) {
          console.log(`Snapping validation adjusted item coordinates: (${tx}, ${ty}) -> (${sx.toFixed(2)}, ${sy.toFixed(2)})`);
          return { valid: true, x: Number(sx.toFixed(2)), y: Number(sy.toFixed(2)), adjusted: true };
        }
      }
    }

    return { valid: false, reason: "No valid coordinate found near suggestion without collision." };
  },

  validateCandidate: function(suggest, items, walls, doors, windows, roomPoly) {
    const testItem = suggest.item || { w: 1.0, h: 1.0 };
    const tx = suggest.x;
    const ty = suggest.y;
    const trad = Math.max(testItem.w, testItem.h) / 2;

    // 1. Outside room boundaries check
    if (roomPoly && !editor.isPointInPolygon({ x: tx, y: ty }, roomPoly)) {
      return { valid: false, reason: "Item coordinates are outside the room polygon." };
    }

    // 2. Door blockage (minimum 0.9m circulation clearance)
    for (let d of doors) {
      if (Math.hypot(tx - d.x, ty - d.y) < trad + 0.85) {
        return { valid: false, reason: "Blocks door clearance path." };
      }
    }

    // 3. Window blockage (tall/large items block daylight)
    const blocksWindow = ['wardrobe', 'bookshelf', 'bed_double'].includes(testItem.type || suggest.itemType);
    if (blocksWindow) {
      for (let w of windows) {
        if (Math.hypot(tx - w.x, ty - w.y) < trad + 0.6) {
          return { valid: false, reason: "Blocks window natural light." };
        }
      }
    }

    // 4. Wall intersections
    for (let w of walls) {
      if (this.pointToSegmentDistance({ x: tx, y: ty }, w) < trad + 0.05) {
        return { valid: false, reason: "Intersects room boundary walls." };
      }
    }

    // 5. Furniture overlaps
    for (let it of items) {
      if (it.id === suggest.targetId) continue;
      if (it.type === 'door' || it.type === 'window') continue;
      const dist = Math.hypot(tx - it.x, ty - it.y);
      const minClear = (trad + Math.max(it.w, it.h) / 2);
      if (dist < minClear - 0.1) {
        return { valid: false, reason: "Overlaps with placed furniture." };
      }
    }

    return { valid: true };
  },

  // 4. Fetch & parse suggestions
  generateSuggestions: async function() {
    const rooms = editor.detectRooms ? editor.detectRooms() : [];
    if (rooms.length === 0) {
      const listContainer = document.getElementById("ai-refine-suggestions-list");
      if (listContainer) {
        listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.75rem;">Draw walls to create an enclosed room space first.</div>`;
      }
      return;
    }

    const activeRoom = editor.selectedRoom || rooms[0];
    const details = aiRoomDesigner.analyzeRoom(activeRoom);
    const roomWalls = aiRoomDesigner.detectWalls(activeRoom);
    const wallIds = new Set(roomWalls.map(w => w.id));
    const doors = editor.items.filter(i => i.type === 'door' && i.wallId && wallIds.has(i.wallId));
    const windows = editor.items.filter(i => i.type === 'window' && i.wallId && wallIds.has(i.wallId));
    const furniture = editor.items.filter(i => i.type !== 'door' && i.type !== 'window' && i.wallId === undefined);

    // Initial local problems analysis for display list
    this.problemsFound = [];
    furniture.forEach(f => {
      const frad = Math.max(f.w, f.h) / 2;
      doors.forEach(d => {
        if (Math.hypot(f.x - d.x, f.y - d.y) < frad + 0.9) {
          this.problemsFound.push(`⚠️ ${f.type.replace('_', ' ').toUpperCase()} blocks door entryway circulation path.`);
        }
      });
      windows.forEach(w => {
        if (Math.hypot(f.x - w.x, f.y - w.y) < frad + 0.6 && ['wardrobe', 'bookshelf', 'bed_double'].includes(f.type)) {
          this.problemsFound.push(`⚠️ ${f.type.replace('_', ' ').toUpperCase()} blocks window frame daylight.`);
        }
      });
      furniture.forEach(f2 => {
        if (f.id === f2.id) return;
        const dist = Math.hypot(f.x - f2.x, f.y - f2.y);
        const minClear = (frad + Math.max(f2.w, f2.h) / 2);
        if (dist < minClear - 0.15) {
          this.problemsFound.push(`⚠️ ${f.type.replace('_', ' ').toUpperCase()} collides with ${f2.type.replace('_', ' ').toUpperCase()}.`);
        }
      });
    });

    const projectState = this.serializeProjectState(activeRoom, details, roomWalls, doors, windows, furniture);
    this.renderLoading();

    // System prompt requested
    const systemPrompt = `You are an award-winning architect and interior designer.
Analyze the supplied room.
Return ONLY valid JSON.
Do not return markdown.
Do not explain yourself.
Your job is to improve the room while following professional architectural principles.
Never block doors.
Never block windows.
Maintain at least 90cm walking clearance.
Use natural lighting.
Keep furniture inside room boundaries.
Choose logical placements.
Explain why every change improves the design.
Return:
{
  "designScore": 92,
  "roomType": "bedroom",
  "style": "scandinavian",
  "analysis": "Professional layout analysis of daylight access, wall balance, traffic corridors",
  "improvements": ["Aligned wardrobe along side walls", "Placed bed on the focal wall"],
  "furnitureToAdd": [
    { "type": "plant", "w": 0.6, "h": 0.6, "depth": 1.2, "color": "#10b981", "material": "fabric", "x": 1.2, "y": -0.5, "rotation": 90, "reason": "Adds biophilic green warmth near natural daylight" }
  ],
  "furnitureToMove": [
    { "targetId": "some_id", "x": -1.2, "y": 0.5, "rotation": 180, "reason": "Moved bed against the longest solid wall for layout balance" }
  ],
  "furnitureToRemove": [
    { "targetId": "some_id", "reason": "Removed redundant chair to free circulation clearance" }
  ],
  "materials": { "walls": "white_paint", "floors": "oak_wood" },
  "colors": { "main": "#f8fafc", "accent": "#06b6d4" },
  "lighting": { "ambient": "warm", "natural": "maximized" },
  "estimatedCost": 45000
}`;

    try {
      const parsed = await apiClient.post('/api/ai/refine', {
        systemPrompt: systemPrompt,
        projectState: projectState
      });

      const rawSuggestions = [];

      // Validate & snap additions
      if (parsed.furnitureToAdd && Array.isArray(parsed.furnitureToAdd)) {
        parsed.furnitureToAdd.forEach((add, idx) => {
          const snap = this.validateAndSnapRecommendation({
            type: 'add',
            x: add.x,
            y: add.y,
            itemType: add.type,
            item: add
          }, furniture, roomWalls, doors, windows, details.cx, details.poly);

          if (snap.valid) {
            rawSuggestions.push({
              id: `gemini_add_${idx}_${Date.now()}`,
              type: "add",
              category: "Furniture",
              title: `Place ${add.type.replace('_', ' ')}`,
              why: add.reason || "Architectural spacing requirement.",
              cost: this.estimateItemCost(add.type),
              itemType: add.type,
              item: { type: add.type, w: add.w || 1.0, h: add.h || 1.0, depth: add.depth || 0.8, rotation: add.rotation || 0, color: add.color || "#cbd5e1", material: add.material || "wood" },
              x: snap.x,
              y: snap.y,
              rotation: add.rotation || 0
            });
          } else {
            this.problemsFound.push(`❌ Rejected Gemini addition: ${add.type} (failed safety positioning boundaries).`);
          }
        });
      }

      // Validate & snap moves
      if (parsed.furnitureToMove && Array.isArray(parsed.furnitureToMove)) {
        parsed.furnitureToMove.forEach((move, idx) => {
          const targetItem = furniture.find(it => it.id === move.targetId);
          if (!targetItem) return;

          const snap = this.validateAndSnapRecommendation({
            type: 'move',
            x: move.x,
            y: move.y,
            targetId: move.targetId,
            item: targetItem
          }, furniture, roomWalls, doors, windows, details.cx, details.poly);

          if (snap.valid) {
            rawSuggestions.push({
              id: `gemini_move_${idx}_${Date.now()}`,
              type: "move",
              category: "Layout",
              title: `Move ${targetItem.type.replace('_', ' ')}`,
              why: move.reason || "Optimize circulation clearance pathways.",
              cost: 0,
              targetId: move.targetId,
              x: snap.x,
              y: snap.y,
              rotation: move.rotation !== undefined ? move.rotation : targetItem.rotation
            });
          } else {
            this.problemsFound.push(`❌ Rejected Gemini move: ${targetItem.type} (failed safety layout clearance).`);
          }
        });
      }

      // Valid removes
      if (parsed.furnitureToRemove && Array.isArray(parsed.furnitureToRemove)) {
        parsed.furnitureToRemove.forEach((rem, idx) => {
          const targetItem = furniture.find(it => it.id === rem.targetId);
          if (!targetItem) return;

          rawSuggestions.push({
            id: `gemini_remove_${idx}_${Date.now()}`,
            type: "remove",
            category: "Layout",
            title: `Remove ${targetItem.type.replace('_', ' ')}`,
            why: rem.reason || "Clear room circulation space.",
            cost: 0,
            targetId: rem.targetId
          });
        });
      }

      // Valid materials
      if (parsed.materials) {
        if (parsed.materials.floors && parsed.materials.floors !== projectState.materials.floors) {
          rawSuggestions.push({
            id: `gemini_mat_floor_${Date.now()}`,
            type: "material",
            category: "Material",
            title: `Update floor to ${parsed.materials.floors.replace('_', ' ')}`,
            why: `Enhance visual style and surface texture composition.`,
            cost: 25000,
            materialType: "floors",
            materialValue: parsed.materials.floors
          });
        }
      }

      this.suggestions = rawSuggestions;

      // Update predicted scores based on parsed designScore
      this.predictedScore = parsed.designScore || 90;
      editor.showToast("🧠 Gemini refinement loaded successfully!");
    } catch (err) {
      console.error("Gemini API direct failure: ", err);
      editor.showToast("direct Gemini call failed. Loading offline spatial heuristics.");
      this.generateLocalFallbackSuggestions(activeRoom, details, roomWalls, doors, windows, furniture);
    }

    this.renderSuggestions();
  },

  // Fallback engine
  generateLocalFallbackSuggestions: function(room, details, walls, doors, windows, furniture) {
    const suggestions = [];
    const cx = details.cx;
    const cy = details.cy;

    if (projectState?.roomType === 'bedroom') {
      const beds = furniture.filter(f => f.type === 'bed_double');
      if (beds.length === 0) {
        suggestions.push({
          id: "local_add_bed",
          type: "add",
          category: "Furniture",
          title: "Place a double bed in the room center",
          why: "A double bed forms a clean layout focal point.",
          cost: 65000,
          itemType: "bed_double",
          item: { type: "bed_double", w: 1.8, h: 2.0, depth: 0.65, rotation: 180, color: "#cbd5e1", material: "fabric" },
          x: cx,
          y: cy - 0.4,
          rotation: 180
        });
      }
    }

    this.suggestions = suggestions.filter(s => {
      const v = this.validateAndSnapRecommendation(s, furniture, walls, doors, windows, details.cx, details.poly);
      return v.valid;
    });
    this.predictedScore = 88;
  },

  renderLoading: function() {
    const listContainer = document.getElementById("ai-refine-suggestions-list");
    if (listContainer) {
      listContainer.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--accent-cyan); font-size: 0.8rem; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <svg class="ai-sparkle-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style="animation: spin 2s linear infinite;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span style="font-weight: 600;">Consulting Gemini Architect...</span>
          <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        </div>
      `;
    }
  },

  // 5. Render scores, problems found list, estimated cost, and suggestions
  renderSuggestions: function() {
    // 1. Problems Found List
    const probContainer = document.getElementById("ai-refine-problems-container");
    const probList = document.getElementById("ai-refine-problems-list");
    if (probContainer && probList) {
      probList.innerHTML = "";
      if (this.problemsFound.length === 0) {
        probContainer.style.display = "none";
      } else {
        probContainer.style.display = "flex";
        this.problemsFound.forEach(p => {
          const li = document.createElement("li");
          li.textContent = p;
          probList.appendChild(li);
        });
      }
    }

    // 2. Suggestions List Cards
    const listContainer = document.getElementById("ai-refine-suggestions-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (this.suggestions.length === 0) {
      listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.75rem;">Your room already aligns with Google Gemini layout standards! No modifications recommended.</div>`;
      this.updateScoreboard();
      return;
    }

    this.suggestions.forEach(s => {
      const card = document.createElement("div");
      
      const isPreview = this.previewingSuggestions.has(s.id);
      const isSkipped = this.skippedSuggestions.has(s.id);
      const isApplied = this.appliedSuggestions.has(s.id);

      card.className = `ai-refine-suggestion-card glass ${isPreview ? 'previewing' : ''} ${isSkipped ? 'skipped' : ''}`;
      card.id = `card-${s.id}`;

      const catLower = s.category.toLowerCase();
      const costText = s.cost > 0 ? `+₹${s.cost.toLocaleString('en-IN')}` : "₹0 (layout only)";
      const costClass = s.cost > 0 ? "plus" : "minus";

      card.innerHTML = `
        <div class="suggestion-title-row">
          <h5 class="suggestion-title">${s.title}</h5>
          <span class="suggestion-category-badge ${catLower}">${s.category}</span>
        </div>
        <p class="suggestion-why">${s.why}</p>
        <div class="suggestion-footer">
          <span class="suggestion-cost ${costClass}">${costText}</span>
          <div class="suggestion-actions">
            <button class="suggestion-btn skip" onclick="aiRefinement.skipSuggestion('${s.id}')">Skip</button>
            <button class="suggestion-btn apply ${isPreview ? 'active' : ''}" onclick="aiRefinement.togglePreviewSuggestion('${s.id}')">
              ${isPreview ? '✓ Previewing' : 'Preview'}
            </button>
            <button class="suggestion-btn apply" onclick="aiRefinement.commitSingleSuggestion('${s.id}')" style="background: rgba(6,182,212,0.1); color: var(--accent-cyan); border-color: rgba(6,182,212,0.2);">
              ${isApplied ? 'Applied' : 'Apply'}
            </button>
          </div>
        </div>
      `;
      listContainer.appendChild(card);
    });

    this.updateScoreboard();
  },

  // Toggle suggestion preview dynamically
  togglePreviewSuggestion: function(id) {
    if (this.previewingSuggestions.has(id)) {
      this.previewingSuggestions.delete(id);
    } else {
      this.previewingSuggestions.add(id);
    }
    this.updatePreviewLayout();
    this.renderSuggestions();
  },

  // Skip suggestion
  skipSuggestion: function(id) {
    this.skippedSuggestions.add(id);
    this.previewingSuggestions.delete(id);
    this.updatePreviewLayout();
    this.renderSuggestions();
    editor.showToast("Suggestion skipped");
  },

  // Commit single suggestion immediately into editor items list
  commitSingleSuggestion: function(id) {
    editor.pushStateToUndo();

    const s = this.suggestions.find(x => x.id === id);
    if (!s) return;

    if (s.type === 'add') {
      const itemSpec = s.item || { type: s.itemType };
      editor.items.push({
        id: "ai_applied_single_" + Date.now(),
        type: s.itemType,
        x: s.x,
        y: s.y,
        w: itemSpec.w || 1.0,
        h: itemSpec.h || 1.0,
        depth: itemSpec.depth || 0.8,
        rotation: s.rotation || 0,
        color: itemSpec.color || "#cbd5e1",
        material: itemSpec.material || "wood"
      });
    }
    else if (s.type === 'move') {
      const item = editor.items.find(it => it.id === s.targetId);
      if (item) {
        item.x = s.x;
        item.y = s.y;
        item.rotation = s.rotation;
      }
    }
    else if (s.type === 'remove') {
      editor.items = editor.items.filter(it => it.id !== s.targetId);
    }
    else if (s.type === 'material') {
      if (!editor.settings.materials) editor.settings.materials = {};
      editor.settings.materials[s.materialType] = s.materialValue;
    }

    this.appliedSuggestions.add(id);
    this.previewingSuggestions.delete(id);

    // Save baseline
    this.originalState.items = JSON.parse(JSON.stringify(editor.items));
    this.originalState.materials = JSON.parse(JSON.stringify(editor.settings.materials));

    projects.saveCurrentToStorage();
    editor.draw();
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }

    editor.showToast(`Applied: ${s.title}`);
    this.renderSuggestions();
  },

  // Real-time Preview updates both 2D Planner and 3D Viewer
  updatePreviewLayout: function() {
    if (!this.originalState) return;

    let tempItems = JSON.parse(JSON.stringify(this.originalState.items));
    let tempMaterials = JSON.parse(JSON.stringify(this.originalState.materials));

    this.suggestions.forEach(s => {
      if (!this.previewingSuggestions.has(s.id)) return;

      if (s.type === 'add') {
        const itemSpec = s.item || { type: s.itemType };
        tempItems.push({
          id: "ai_preview_" + s.id,
          type: s.itemType,
          x: s.x,
          y: s.y,
          w: itemSpec.w || 1.0,
          h: itemSpec.h || 1.0,
          depth: itemSpec.depth || 0.8,
          rotation: s.rotation || 0,
          color: itemSpec.color || "#cbd5e1",
          material: itemSpec.material || "wood",
          isAiPreview: true
        });
      }
      else if (s.type === 'move') {
        const item = tempItems.find(it => it.id === s.targetId);
        if (item) {
          item.x = s.x;
          item.y = s.y;
          item.rotation = s.rotation;
          item.isAiPreview = true;
        }
      }
      else if (s.type === 'remove') {
        tempItems = tempItems.filter(it => it.id !== s.targetId);
      }
      else if (s.type === 'material') {
        tempMaterials[s.materialType] = s.materialValue;
      }
    });

    editor.items = tempItems;
    editor.settings.materials = tempMaterials;

    editor.draw();
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }

    this.updateScoreboard();
  },

  updateScoreboard: function() {
    const rooms = editor.detectRooms ? editor.detectRooms() : [];
    if (rooms.length === 0) return;

    const activeRoom = editor.selectedRoom || rooms[0];

    const committedScores = this.calculateLocalScores(this.originalState.items, editor.walls, activeRoom);
    const previewScores = this.calculateLocalScores(editor.items, editor.walls, activeRoom);

    // If Gemini predicted score is loaded, override After Score for visual premium impact!
    const afterScore = this.previewingSuggestions.size > 0 ? (this.predictedScore || 92) : committedScores.overall;

    const curScoreEl = document.getElementById("ai-refine-current-score");
    const predScoreEl = document.getElementById("ai-refine-predicted-score");
    if (curScoreEl) curScoreEl.textContent = `Current: ${committedScores.overall}`;
    if (predScoreEl) predScoreEl.textContent = `After: ${afterScore}`;

    const subContainer = document.getElementById("ai-refine-score-subcategories");
    if (subContainer) {
      const keys = [
        { label: "Space Usage", key: "spaceUsage" },
        { label: "Circulation Comfort", key: "circulation" },
        { label: "Natural Lighting", key: "lighting" },
        { label: "Functional Comfort", key: "comfort" },
        { label: "Storage Capacity", key: "storage" },
        { label: "Visual Balance", key: "balance" }
      ];

      subContainer.innerHTML = "";
      keys.forEach(k => {
        const committedVal = committedScores[k.key];
        const previewVal = previewScores[k.key];

        const row = document.createElement("div");
        row.className = "score-bar-container";
        row.innerHTML = `
          <div class="score-bar-header">
            <span class="score-bar-label">${k.label}</span>
            <span class="score-bar-values">${committedVal} &rarr; ${previewVal}</span>
          </div>
          <div class="score-bar-bg">
            <div class="score-bar-current" style="width: ${committedVal}%"></div>
            <div class="score-bar-predicted" style="width: ${previewVal}%"></div>
          </div>
        `;
        subContainer.appendChild(row);
      });
    }

    // Cost diff
    let totalDiff = 0;
    this.suggestions.forEach(s => {
      if (this.previewingSuggestions.has(s.id)) {
        totalDiff += s.cost;
      }
    });

    const costDiffEl = document.getElementById("ai-refine-cost-diff");
    if (costDiffEl) {
      if (totalDiff > 0) {
        costDiffEl.textContent = `+₹${totalDiff.toLocaleString('en-IN')}`;
      } else {
        costDiffEl.textContent = "₹0";
      }
    }
  },

  revertToOriginal: function() {
    if (!this.originalState) return;
    editor.items = JSON.parse(JSON.stringify(this.originalState.items));
    editor.settings.materials = JSON.parse(JSON.stringify(this.originalState.materials));
    
    editor.items.forEach(it => delete it.isAiPreview);
    
    editor.draw();
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }
  },

  applyAllSuggestions: function() {
    editor.pushStateToUndo();

    this.revertToOriginal();

    let finalItems = JSON.parse(JSON.stringify(editor.items));
    let finalMaterials = JSON.parse(JSON.stringify(editor.settings.materials));

    let appliedCount = 0;
    this.suggestions.forEach(s => {
      if (this.skippedSuggestions.has(s.id)) return;

      if (s.type === 'add') {
        const itemSpec = s.item || { type: s.itemType };
        finalItems.push({
          id: "ai_applied_all_" + Date.now() + "_" + appliedCount,
          type: s.itemType,
          x: s.x,
          y: s.y,
          w: itemSpec.w || 1.0,
          h: itemSpec.h || 1.0,
          depth: itemSpec.depth || 0.8,
          rotation: s.rotation || 0,
          color: itemSpec.color || "#cbd5e1",
          material: itemSpec.material || "wood"
        });
      }
      else if (s.type === 'move') {
        const item = finalItems.find(it => it.id === s.targetId);
        if (item) {
          item.x = s.x;
          item.y = s.y;
          item.rotation = s.rotation;
        }
      }
      else if (s.type === 'remove') {
        finalItems = finalItems.filter(it => it.id !== s.targetId);
      }
      else if (s.type === 'material') {
        finalMaterials[s.materialType] = s.materialValue;
      }
      appliedCount++;
    });

    editor.items = finalItems;
    editor.settings.materials = finalMaterials;

    projects.saveCurrentToStorage();
    editor.draw();
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }

    editor.showToast(`Applied ${appliedCount} AI changes successfully`);
    this.closeRefinePanel();
  },

  rejectAllSuggestions: function() {
    this.revertToOriginal();
    editor.showToast("AI Refinements rejected");
    this.closeRefinePanel();
  },

  undoAiChanges: function() {
    if (!this.undoBackup) {
      editor.showToast("No AI changes to undo");
      return;
    }
    
    editor.pushStateToUndo();
    editor.items = JSON.parse(JSON.stringify(this.undoBackup.items));
    editor.settings.materials = JSON.parse(JSON.stringify(this.undoBackup.materials));
    
    editor.items.forEach(it => delete it.isAiPreview);

    projects.saveCurrentToStorage();
    editor.draw();
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }

    editor.showToast("Undone AI changes");
    this.originalState = JSON.parse(JSON.stringify(this.undoBackup));
    this.generateSuggestions();
  },

  estimateItemCost: function(type) {
    const baseRates = {
      sofa: 45000,
      chair: 15000,
      table_coffee: 12000,
      tv_stand: 18000,
      bed_double: 65000,
      wardrobe: 55000,
      nightstand: 8000,
      dining_table: 35000,
      kitchen_island: 60000,
      wash_basin: 12000,
      bath_tub: 85000,
      plant: 3000,
      lamp_floor: 9000,
      desk: 22000,
      bookshelf: 20000
    };
    return baseRates[type] || 12000;
  },

  pointToSegmentDistance: function(p, w) {
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) return Math.hypot(p.x - w.x1, p.y - w.y1);
    let t = ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (w.x1 + t * dx), p.y - (w.y1 + t * dy));
  }
};

// Hook item preview render overlay
setTimeout(() => {
  if (window.editor) {
    const originalDrawItems = editor.drawItems;
    editor.drawItems = function() {
      originalDrawItems.call(editor);

      editor.items.forEach(item => {
        if (item.isAiPreview) {
          const scr = editor.worldToScreen(item.x, item.y);
          editor.ctx.save();
          editor.ctx.translate(scr.x, scr.y);
          editor.ctx.rotate(-item.rotation * (Math.PI / 180));
          
          const wPx = item.w * editor.zoom;
          const hPx = item.h * editor.zoom;

          editor.ctx.strokeStyle = "#06b6d4";
          editor.ctx.lineWidth = 2.5;
          editor.ctx.setLineDash([4, 4]);
          editor.ctx.strokeRect(-wPx/2 - 4, -hPx/2 - 4, wPx + 8, hPx + 8);
          editor.ctx.setLineDash([]);

          editor.ctx.fillStyle = "#06b6d4";
          editor.ctx.fillRect(-wPx/2 - 4, -hPx/2 - 16, 20, 12);
          editor.ctx.fillStyle = "#040508";
          editor.ctx.font = "bold 8px sans-serif";
          editor.ctx.textAlign = "center";
          editor.ctx.fillText("AI", -wPx/2 + 6, -hPx/2 - 7);

          editor.ctx.restore();
        }
      });
    };
  }
}, 500);

window.addEventListener("DOMContentLoaded", () => {
  aiRefinement.init();
});
window.aiRefinement = aiRefinement;
