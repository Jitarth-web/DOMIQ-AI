/**
 * serializer.js
 * Serializes and cleans up the editor state to minimize token usage for Gemini prompts,
 * automatically compiling full CAD-like semantic metadata and relationships.
 */

function round(val, decimals = 2) {
  if (typeof val !== 'number') return val;
  return Number(val.toFixed(decimals));
}

// Helper: check if a point is inside a polygon boundary
function isPointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y))
        && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Helper: calculate distance from point to segment
function pointToSegmentDistance(p, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return Math.hypot(p.x - x1, p.y - y1);
  let t = ((p.x - x1) * dx + (p.y - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy));
}

// Helper: check if a wall segment lies along a room polygon boundary
function isWallOnRoomBoundary(w, roomPoly) {
  const mx = (w.x1 + w.x2) / 2;
  const my = (w.y1 + w.y2) / 2;
  for (let i = 0; i < roomPoly.length; i++) {
    const p1 = roomPoly[i];
    const p2 = roomPoly[(i + 1) % roomPoly.length];
    if (pointToSegmentDistance({ x: mx, y: my }, p1.x, p1.y, p2.x, p2.y) < 0.15) {
      return true;
    }
  }
  return false;
}

// Helper: calculate perimeter of a polygon
function getPerimeter(poly) {
  let perim = 0;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    perim += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }
  return perim;
}

// Helper: calculate centroid of a polygon
function getCentroid(poly) {
  let sumX = 0, sumY = 0;
  poly.forEach(p => { sumX += p.x; sumY += p.y; });
  return { x: sumX / poly.length, y: sumY / poly.length };
}

function classifyIntent(msg) {
  const text = (msg || "").toLowerCase().trim();

  // 1. Cost estimation
  const pricingPhrases = [
    /\b(estimate|estimation|calculate|calculator|breakdown|total|approximate|project|construction|furniture|material|boq|quotation)\s+(cost|price|budget|boq|quotation|estimate|estimation)\b/i,
    /\bhow\s+much\b.*\b(cost|price|this|layout|budget|estimation|quotation)\b/i,
    /\b(boq|quotation|cost\s+breakdown|budget\s+breakdown)\b/i,
    /\bwhat\s+is\s+the\s+(cost|price|budget|estimation|quotation)\b/i,
    /^(cost|price|estimate|budget|boq|quotation|how much|how much\?)$/i
  ];
  if (pricingPhrases.some(regex => regex.test(text))) {
    return "COST_ESTIMATION";
  }

  // 2. Greetings / Conversation / General Questions
  const greetingKeywords = [
    /^hi$/i, /^hello$/i, /^hey$/i, /^yo$/i, /^greetings$/i, /^hola$/i, /^good\s+(morning|afternoon|evening)$/i,
    "what can you do", "who are you", "help me", "how do i", "how does this work", "tell me about yourself",
    "what are your features", "explain your capability"
  ];
  if (greetingKeywords.some(k => typeof k === 'string' ? text.includes(k) : k.test(text))) {
    return "NO_CAD";
  }

  // 3. Wall editing keywords (high priority check)
  const wallKeywords = [
    "wall", "walls", "split", "merge", "partition", "demolish"
  ];
  if (wallKeywords.some(k => text.includes(k))) {
    return "WALL_EDITING";
  }

  // 4. Material/color/flooring keywords
  const materialKeywords = [
    "material", "flooring", "paint", "finish", "color", "texture", "wallpaper", "tiles", "oak", "wood", "marble", "carpet"
  ];
  if (materialKeywords.some(k => text.includes(k))) {
    return "MATERIAL_REQUEST";
  }

  // 5. Furniture modification keywords
  const furnitureKeywords = [
    "furniture", "sofa", "chair", "table", "bed", "wardrobe", "desk", "bookshelf", "bathtub", "sink", "lamp",
    "move", "add", "place", "delete", "remove", "rotate", "resize", "scale", "duplicate", "replace", "swap", "item", "object"
  ];
  if (furnitureKeywords.some(k => text.includes(k))) {
    return "FURNITURE_MODIFICATION";
  }

  // 6. Rendering / Image request
  const imageKeywords = [
    "generate image", "show me", "visualize", "render", 
    "create a realistic image", "how would this look", 
    "photorealistic version", "show me how i can improve",
    "mockup", "snapshot", "picture", "photo"
  ];
  if (imageKeywords.some(k => text.includes(k))) {
    return "RENDERING_REQUEST";
  }

  return "CHAT";
}

function sanitizeObject(obj, visited = new WeakSet()) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") {
    if (typeof obj === "function" || typeof obj === "symbol") {
      return undefined;
    }
    return obj;
  }

  if (visited.has(obj)) {
    return null;
  }
  visited.add(obj);

  if (Array.isArray(obj)) {
    const arrCopy = [];
    for (const item of obj) {
      const val = sanitizeObject(item, visited);
      if (val !== undefined) {
        arrCopy.push(val);
      }
    }
    visited.delete(obj);
    return arrCopy;
  }

  const copy = {};
  for (const key of Object.keys(obj)) {
    const val = sanitizeObject(obj[key], visited);
    if (val !== undefined) {
      copy[key] = val;
    }
  }
  visited.delete(obj);
  return copy;
}

function serialize(rawEditorState, userMessage = "") {
  if (!rawEditorState || typeof rawEditorState !== "object") {
    return {};
  }

  // Deep clone to avoid mutating input objects or retaining references
  const editorState = sanitizeObject(rawEditorState);

  const intent = classifyIntent(userMessage);

  // 1. Process Rooms first to use them for spatial mappings
  const rawRooms = editorState.rooms || [];
  const rooms = rawRooms.map((r, idx) => {
    const id = r.id || `room_${idx}`;
    const name = r.name || (r.area >= 20.0 ? "Living Room" : (r.area >= 12.0 ? "Bedroom" : (r.area >= 7.0 ? "Kitchen" : "Bathroom")));
    const centroid = r.polygon && r.polygon.length > 0 ? getCentroid(r.polygon) : { x: 0, y: 0 };
    return {
      id: id,
      name: name,
      type: r.type || (r.area >= 20.0 ? "living_room" : (r.area >= 12.0 ? "bedroom" : (r.area >= 7.0 ? "kitchen" : "bathroom"))),
      area: round(r.area || 0),
      perimeter: round(r.polygon ? getPerimeter(r.polygon) : 0),
      centroid: { x: round(centroid.x), y: round(centroid.y) },
      polygon: (r.polygon || []).map(p => ({ x: round(p.x), y: round(p.y) })),
      boundingWalls: [],
      doors: [],
      windows: [],
      furnitureIds: []
    };
  });

  // 2. Map walls and enrich with semantic metadata
  const rawWalls = editorState.walls || [];
  const walls = rawWalls.map(w => {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    const angle = Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * (180 / Math.PI);
    
    // Determine adjacent rooms
    const adjacentRoomIds = [];
    rooms.forEach(r => {
      if (isWallOnRoomBoundary(w, r.polygon)) {
        adjacentRoomIds.push(r.id);
        r.boundingWalls.push(w.id);
      }
    });

    const isExterior = adjacentRoomIds.length <= 1;
    const isLoadBearing = isExterior || (w.thickness || 0.2) >= 0.20;

    return {
      id: w.id,
      x1: round(w.x1),
      y1: round(w.y1),
      x2: round(w.x2),
      y2: round(w.y2),
      thickness: round(w.thickness || 0.2),
      height: round(w.height || 2.8),
      length: round(len),
      angle: Math.round(angle),
      adjacentRooms: adjacentRoomIds,
      isExterior: isExterior,
      isLoadBearing: isLoadBearing,
      doors: [],
      windows: []
    };
  });

  // 3. Map items and resolve positions to rooms
  const rawItems = editorState.furniture || editorState.items || [];
  const rawDoors = editorState.doors || rawItems.filter(i => i.type === "door");
  const rawWindows = editorState.windows || rawItems.filter(i => i.type === "window");
  const rawFurniture = editorState.furniture || rawItems.filter(i => i.type !== "door" && i.type !== "window");

  const furniture = rawFurniture.map(f => {
    // Find room containment
    let roomContainment = null;
    rooms.forEach(r => {
      if (isPointInPolygon({ x: f.x, y: f.y }, r.polygon)) {
        roomContainment = r;
        r.furnitureIds.push(f.id);
      }
    });

    return {
      id: f.id,
      type: f.type,
      x: round(f.x),
      y: round(f.y),
      w: round(f.w),
      h: round(f.h),
      depth: round(f.depth || 0.8),
      rotation: round(f.rotation || 0),
      color: f.color || "#cbd5e1",
      material: f.material || "wood",
      room: roomContainment ? roomContainment.id : "outside",
      roomName: roomContainment ? roomContainment.name : "outside",
      roomType: roomContainment ? roomContainment.type : "outside",
      wallAttachment: f.wallId || null
    };
  });

  const doors = rawDoors.map(d => {
    const wall = walls.find(w => w.id === d.wallId);
    if (wall) wall.doors.push(d.id);
    
    // Map back to rooms associated with the wall
    let connectsRooms = [];
    if (wall) {
      connectsRooms = wall.adjacentRooms;
      connectsRooms.forEach(roomId => {
        const room = rooms.find(r => r.id === roomId);
        if (room && !room.doors.includes(d.id)) room.doors.push(d.id);
      });
    }

    return {
      id: d.id,
      type: "door",
      x: round(d.x),
      y: round(d.y),
      w: round(d.w || 0.9),
      h: round(d.h || 2.1),
      rotation: round(d.rotation || 0),
      wallId: d.wallId || null,
      connectsRooms: connectsRooms
    };
  });

  const windows = rawWindows.map(win => {
    const wall = walls.find(w => w.id === win.wallId);
    if (wall) wall.windows.push(win.id);

    let adjacentRooms = [];
    if (wall) {
      adjacentRooms = wall.adjacentRooms;
      adjacentRooms.forEach(roomId => {
        const room = rooms.find(r => r.id === roomId);
        if (room && !room.windows.includes(win.id)) room.windows.push(win.id);
      });
    }

    return {
      id: win.id,
      type: "window",
      x: round(win.x),
      y: round(win.y),
      w: round(win.w || 1.5),
      h: round(win.h || 1.2),
      rotation: round(win.rotation || 0),
      wallId: win.wallId || null,
      belongsToRooms: adjacentRooms
    };
  });

  // 4. Intent-Aware Serialization
  if (intent === "NO_CAD") {
    return {
      intent,
      selectedStyle: editorState.selectedStyle || "modern",
      budget: editorState.budget || "medium"
    };
  }

  // Helper to strip duplicate room relations and keep rooms basic
  const basicRooms = rooms.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    area: r.area,
    centroid: r.centroid
  }));

  if (intent === "FURNITURE_MODIFICATION") {
    return {
      intent,
      furniture: furniture,
      rooms: basicRooms,
      dimensions: editorState.dimensions ? {
        width: round(editorState.dimensions.width),
        height: round(editorState.dimensions.height),
        area: round(editorState.dimensions.area)
      } : null,
      selectedStyle: editorState.selectedStyle || "modern",
      budget: editorState.budget || "medium"
    };
  }

  if (intent === "WALL_EDITING") {
    return {
      intent,
      walls: walls,
      rooms: basicRooms,
      doors: doors,
      windows: windows,
      dimensions: editorState.dimensions ? {
        width: round(editorState.dimensions.width),
        height: round(editorState.dimensions.height),
        area: round(editorState.dimensions.area)
      } : null,
      selectedStyle: editorState.selectedStyle || "modern",
      budget: editorState.budget || "medium"
    };
  }

  if (intent === "MATERIAL_REQUEST") {
    return {
      intent,
      rooms: basicRooms,
      materials: editorState.materials || { walls: "white_paint", floors: "oak_wood", doors: "oak" },
      selectedStyle: editorState.selectedStyle || "modern",
      budget: editorState.budget || "medium",
      furnitureSummary: furniture.map(f => ({ id: f.id, type: f.type, material: f.material, color: f.color }))
    };
  }

  if (intent === "RENDERING_REQUEST") {
    return {
      intent,
      rooms: basicRooms,
      materials: editorState.materials || { walls: "white_paint", floors: "oak_wood", doors: "oak" },
      lighting: editorState.lighting || { ambient: 0.7, daylight: true },
      selectedStyle: editorState.selectedStyle || "modern",
      budget: editorState.budget || "medium",
      furnitureSummary: furniture.map(f => ({ id: f.id, type: f.type, color: f.color, material: f.material }))
    };
  }

  if (intent === "COST_ESTIMATION") {
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

    const furnitureCounts = {};
    furniture.forEach(f => {
      furnitureCounts[f.type] = (furnitureCounts[f.type] || 0) + 1;
    });

    return {
      intent,
      wallArea: round(wallArea),
      floorArea: round(floorArea),
      furnitureCounts: furnitureCounts,
      doorCount: doors.length,
      windowCount: windows.length,
      materials: editorState.materials || { walls: "white_paint", floors: "oak_wood", doors: "oak" },
      selectedStyle: editorState.selectedStyle || "modern",
      budget: editorState.budget || "medium"
    };
  }

  // Fallback / default: return complete but cleaned scene context (no circular duplicates on rooms)
  return {
    intent,
    walls: walls,
    rooms: basicRooms,
    doors: doors,
    windows: windows,
    furniture: furniture,
    materials: editorState.materials || { walls: "white_paint", floors: "oak_wood", doors: "oak" },
    lighting: editorState.lighting || { ambient: 0.7, daylight: true },
    dimensions: editorState.dimensions ? {
      width: round(editorState.dimensions.width),
      height: round(editorState.dimensions.height),
      area: round(editorState.dimensions.area)
    } : null,
    selectedStyle: editorState.selectedStyle || "modern",
    budget: editorState.budget || "medium",
    currentFloor: editorState.floor || 1
  };
}

module.exports = {
  classifyIntent,
  serialize
};
