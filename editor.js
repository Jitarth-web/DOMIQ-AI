/* ==========================================================================
   DOM IQ AI - 2D CANVASES AND PROFESSIONAL CAD-LIKE EDITOR
   ========================================================================== */

const editor = {
  canvas: null,
  ctx: null,
  walls: [],
  items: [],
  settings: {
    units: "meters",
    wallHeight: 2.8,
    wallThickness: 0.2, // meters
    gridSnap: 0.1 // meters (10cm)
  },
  
  // Navigation / Viewport state
  panX: 0,
  panY: 0,
  zoom: 35, // pixels per meter (starts around 35px = 1m)
  zoomMin: 5,
  zoomMax: 150,
  
  // Interactive Tools state
  activeTool: "select", // select, wall, door, window, measure
  selectedItem: null,
  isPanning: false,
  startPanX: 0,
  startPanY: 0,
  spacePressed: false,
  copiedItem: null,
  
  // Draw wall state
  isDrawingWall: false,
  wallStartPoint: null,
  tempWallEndPoint: null,

  // Draw room state (rectangle → 4 walls)
  isDrawingRoom: false,
  roomStartPoint: null,
  tempRoomEndPoint: null,

  _resizeObserver: null,
  
  // Selection/Drag state
  draggedItem: null,
  dragOffset: { x: 0, y: 0 },
  
  // Measurement state
  measureStart: null,
  measureEnd: null,
  
  // Undo/Redo queues
  undoStack: [],
  redoStack: [],

  init: function() {
    this.canvas = document.getElementById("floor-planner-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");

    this.setupResizeObserver();
    this.resizeCanvas();
    if (this.canvas.width > 0) {
      this.resetViewport();
    }

    // Bind window events
    window.addEventListener("resize", () => this.resizeCanvas());

    // Canvas interaction events
    this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));
    this.canvas.addEventListener("wheel", (e) => this.handleWheel(e), { passive: false });
    
    // Keyboard events
    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
    window.addEventListener("keyup", (e) => this.handleKeyUp(e));

    // Initialize default floors
    if (!this.floors || this.floors.length === 0) {
      this.floors = [
        {
          id: "floor_ground",
          name: "Ground Floor",
          walls: this.walls,
          items: this.items,
          camera: { panX: 0, panY: 0, zoom: 40 },
          undoStack: [],
          redoStack: [],
          settings: { wallHeight: this.settings.wallHeight }
        }
      ];
      this.currentFloorId = "floor_ground";
    }
    this.updateFloorManagerUI();
    
    // Initial Render
    this.draw();
  },

  loadProjectData: function(project) {
    this.walls = project.walls || [];
    this.items = project.items || [];

    const rawThickness = Number(project.settings?.wallThickness ?? 20);
    const rawSnap = Number(project.settings?.gridSnap ?? 10);

    this.settings = {
      units: project.settings?.units || "meters",
      wallHeight: Number(project.settings?.wallHeight || 2.8),
      wallThickness: rawThickness > 3 ? rawThickness / 100 : rawThickness,
      gridSnap: rawSnap > 1 ? rawSnap / 100 : rawSnap,
      materials: project.settings?.materials || { walls: "white_paint", floors: "oak_wood", doors: "oak" }
    };

    if (project.floors && project.floors.length > 0) {
      this.floors = project.floors;
      this.currentFloorId = project.currentFloorId || this.floors[0].id;
    } else {
      this.floors = [
        {
          id: "floor_ground",
          name: "Ground Floor",
          walls: this.walls,
          items: this.items,
          camera: { panX: 0, panY: 0, zoom: 40 },
          undoStack: [],
          redoStack: [],
          settings: { wallHeight: this.settings.wallHeight }
        }
      ];
      this.currentFloorId = "floor_ground";
    }

    // Set active floor values
    const activeFloor = this.floors.find(f => f.id === this.currentFloorId) || this.floors[0];
    this.currentFloorId = activeFloor.id;
    this.walls = activeFloor.walls || [];
    this.items = activeFloor.items || [];
    this.undoStack = activeFloor.undoStack || [];
    this.redoStack = activeFloor.redoStack || [];
    
    // Set up stable metadata and IDs for all CAD elements
    this.roomRegistry = project.roomRegistry || project.settings?.roomRegistry || [];
    this.ensureAllIds();

    if (activeFloor.camera) {
      this.panX = activeFloor.camera.panX || 0;
      this.panY = activeFloor.camera.panY || 0;
      this.zoom = activeFloor.camera.zoom || 40;
    }
    
    this.updateFloorManagerUI();
    
    // Update settings inputs
    const setUnits = document.getElementById("setting-units");
    if (setUnits) setUnits.value = this.settings.units;
    const setHeight = document.getElementById("setting-wall-height");
    if (setHeight) setHeight.value = this.settings.wallHeight;
    const setThickness = document.getElementById("setting-wall-thickness");
    if (setThickness) setThickness.value = this.settings.wallThickness * 100;
    const setSnap = document.getElementById("setting-snap");
    if (setSnap) setSnap.value = this.settings.gridSnap * 100;
    
    // Update materials dropdowns
    const matWalls = document.getElementById("material-walls");
    if (matWalls) matWalls.value = this.settings.materials.walls;
    const matFloors = document.getElementById("material-floors");
    if (matFloors) matFloors.value = this.settings.materials.floors;
    const matDoors = document.getElementById("material-doors");
    if (matDoors) matDoors.value = this.settings.materials.doors;
    
    this.selectedItem = null;
    this.updateInspector();
    if (this.canvas.width > 0) {
      this.resetViewport();
    } else {
      this.draw();
    }
  },

  ensureAllIds: function() {
    if (!this.walls) this.walls = [];
    if (!this.items) this.items = [];
    
    // 1. Ensure walls have unique IDs
    this.walls.forEach(w => {
      if (!w.id) {
        w.id = "w_" + Math.random().toString(36).substr(2, 9);
      }
    });

    // 2. Ensure items have unique IDs
    this.items.forEach(it => {
      if (!it.id) {
        const prefix = (it.type === "door" ? "d_" : (it.type === "window" ? "win_" : "f_"));
        it.id = prefix + Math.random().toString(36).substr(2, 9);
      }
    });

    // 3. Detect and map room IDs
    const rooms = this.detectRooms ? this.detectRooms() : [];
  },

  assignRoomIds: function(rooms) {
    if (!this.roomRegistry) {
      this.roomRegistry = [];
    }
    
    rooms.forEach(r => {
      let sumX = 0, sumY = 0;
      r.polygon.forEach(p => { sumX += p.x; sumY += p.y; });
      const cx = sumX / r.polygon.length;
      const cy = sumY / r.polygon.length;
      
      let matched = this.roomRegistry.find(reg => Math.hypot(reg.cx - cx, reg.cy - cy) < 1.2);
      if (matched) {
        r.id = matched.id;
        r.type = matched.type || r.type;
        r.name = matched.name || r.name;
        matched.cx = cx;
        matched.cy = cy;
        matched.polygon = r.polygon;
        matched.area = r.area;
      } else {
        r.id = "room_" + Math.random().toString(36).substr(2, 5);
        let roomName = "Hallway";
        let roomType = "hallway";
        if (r.area >= 20.0) { roomName = "Living Room"; roomType = "living_room"; }
        else if (r.area >= 12.0) { roomName = "Bedroom"; roomType = "bedroom"; }
        else if (r.area >= 7.0) { roomName = "Kitchen"; roomType = "kitchen"; }
        else if (r.area >= 4.5) { roomName = "Dining Room"; roomType = "dining_room"; }
        else if (r.area < 4.5) { roomName = "Bathroom"; roomType = "bathroom"; }
        
        r.name = roomName;
        r.type = roomType;
        
        this.roomRegistry.push({
          id: r.id,
          cx: cx,
          cy: cy,
          name: roomName,
          type: roomType,
          polygon: r.polygon,
          area: r.area
        });
      }
    });

    const currentIds = new Set(rooms.map(r => r.id));
    this.roomRegistry = this.roomRegistry.filter(reg => currentIds.has(reg.id));
  },

  setupResizeObserver: function() {
    if (!window.ResizeObserver || !this.canvas) return;

    const container = this.canvas.parentElement;
    const workspace = document.querySelector(".studio-center-workspace");
    const studioPage = document.getElementById("studio-page");

    this._resizeObserver = new ResizeObserver(() => {
      if (studioPage && !studioPage.classList.contains("active")) return;
      this.resizeCanvas();
    });

    if (container) this._resizeObserver.observe(container);
    if (workspace) this._resizeObserver.observe(workspace);
    if (studioPage) this._resizeObserver.observe(studioPage);
  },

  getContainerSize: function() {
    const parent = this.canvas?.parentElement;
    if (!parent) return { width: 0, height: 0 };

    let width = parent.clientWidth;
    let height = parent.clientHeight;
    if (width > 0 && height > 0) return { width, height };

    const rect = parent.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { width: Math.floor(rect.width), height: Math.floor(rect.height) };
    }

    let el = parent.parentElement;
    while (el) {
      const ancestorRect = el.getBoundingClientRect();
      if (ancestorRect.width > 0 && ancestorRect.height > 0) {
        return {
          width: Math.floor(ancestorRect.width),
          height: Math.floor(ancestorRect.height)
        };
      }
      el = el.parentElement;
    }

    return { width: 0, height: 0 };
  },

  resizeCanvas: function() {
    if (!this.canvas) return;

    const { width, height } = this.getContainerSize();
    if (width === 0 || height === 0) return;

    const sizeChanged = this.canvas.width !== width || this.canvas.height !== height;
    this.canvas.width = width;
    this.canvas.height = height;

    if (sizeChanged && this.panX === 0 && this.panY === 0) {
      this.panX = width / 2;
      this.panY = height / 2;
    }

    this.draw();
  },

  resetViewport: function() {
    if (!this.canvas || this.canvas.width === 0 || this.canvas.height === 0) return;
    this.panX = this.canvas.width / 2;
    this.panY = this.canvas.height / 2;
    this.zoom = 35;
    this.updateZoomIndicator();
    this.draw();
  },

  updateZoomIndicator: function() {
    const pct = Math.round((this.zoom / 35) * 100) + "%";
    const zi = document.getElementById("zoom-indicator");
    if (zi) zi.textContent = pct;
    const ziOverlay = document.getElementById("zoom-indicator-overlay");
    if (ziOverlay) ziOverlay.textContent = pct;
  },

  // Coordinate Conversion
  screenToWorld: function(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: -(sy - this.panY) / this.zoom
    };
  },

  worldToScreen: function(wx, wy) {
    return {
      x: wx * this.zoom + this.panX,
      y: -wy * this.zoom + this.panY
    };
  },

  snapToGrid: function(val) {
    if (this.settings.gridSnap === 0) return val;
    return Math.round(val / this.settings.gridSnap) * this.settings.gridSnap;
  },

  snapCoords: function(pt) {
    return {
      x: this.snapToGrid(pt.x),
      y: this.snapToGrid(pt.y)
    };
  },

  // Undo/Redo Engine
  pushStateToUndo: function() {
    const stateStr = JSON.stringify({
      walls: this.walls,
      items: this.items,
      roomRegistry: this.roomRegistry || []
    });
    this.undoStack.push(stateStr);
    this.redoStack = []; // Clear redo stack on new action
  },

  undo: function() {
    if (this.undoStack.length === 0) return;
    const current = JSON.stringify({
      walls: this.walls,
      items: this.items,
      roomRegistry: this.roomRegistry || []
    });
    this.redoStack.push(current);
    
    const prevState = JSON.parse(this.undoStack.pop());
    this.walls = prevState.walls;
    this.items = prevState.items;
    this.roomRegistry = prevState.roomRegistry || [];
    this.selectedItem = null;
    this.updateInspector();
    this.draw();
    
    if (window.threeViewer) threeViewer.needsRebuild = true;
  },

  redo: function() {
    if (this.redoStack.length === 0) return;
    const current = JSON.stringify({
      walls: this.walls,
      items: this.items,
      roomRegistry: this.roomRegistry || []
    });
    this.undoStack.push(current);
    
    const nextState = JSON.parse(this.redoStack.pop());
    this.walls = nextState.walls;
    this.items = nextState.items;
    this.roomRegistry = nextState.roomRegistry || [];
    this.selectedItem = null;
    this.updateInspector();
    this.draw();
    
    if (window.threeViewer) threeViewer.needsRebuild = true;
  },

  // Tools Controller
  selectTool: function(toolName) {
    this.activeTool = toolName;
    this.isDrawingWall = false;
    this.isDrawingRoom = false;
    this.measureStart = null;
    this.measureEnd = null;
    
    // Clear styles
    document.querySelectorAll(".toolbar-tool").forEach(b => b.classList.remove("active"));
    const btn = document.getElementById("tool-" + toolName);
    if (btn) btn.classList.add("active");
    
    this.draw();
  },

  toggleGridSnap: function() {
    const btn = document.getElementById("grid-toggle-btn");
    if (this.settings.gridSnap > 0) {
      this.tempStoredSnap = this.settings.gridSnap;
      this.settings.gridSnap = 0;
      if (btn) {
        btn.style.color = "var(--text-muted)";
        btn.title = "Enable grid snap";
      }
    } else {
      this.settings.gridSnap = this.tempStoredSnap || 0.1;
      if (btn) {
        btn.style.color = "#06b6d4";
        btn.title = "Disable grid snap";
      }
    }
    this.draw();
  },

  zoomIn: function() {
    this.zoom = Math.min(this.zoomMax, this.zoom * 1.2);
    this.updateZoomIndicator();
    this.draw();
  },

  zoomOut: function() {
    this.zoom = Math.max(this.zoomMin, this.zoom / 1.2);
    this.updateZoomIndicator();
    this.draw();
  },

  // Mouse Interactions
  handleMouseDown: function(e) {
    const isMiddleButton = e.button === 1;
    const isSpacePressed = e.code === "Space";
    
    if (isMiddleButton || e.shiftKey || this.spacePressed) {
      this.isPanning = true;
      this.startPanX = e.clientX - this.panX;
      this.startPanY = e.clientY - this.panY;
      this.canvas.style.cursor = "grabbing";
      return;
    }
    
    const worldPt = this.screenToWorld(e.clientX - this.canvas.getBoundingClientRect().left, e.clientY - this.canvas.getBoundingClientRect().top);
    const snapped = this.snapCoords(worldPt);
    
    if (this.activeTool === "wall") {
      this.pushStateToUndo();
      this.isDrawingWall = true;
      this.wallStartPoint = snapped;
      this.tempWallEndPoint = snapped;
    }
    else if (this.activeTool === "room") {
      this.pushStateToUndo();
      this.isDrawingRoom = true;
      this.roomStartPoint = snapped;
      this.tempRoomEndPoint = snapped;
    }
    else if (this.activeTool === "door" || this.activeTool === "window") {
      this.pushStateToUndo();
      this.insertWallAttachment(this.activeTool, worldPt);
    } 
    else if (this.activeTool === "measure") {
      this.measureStart = worldPt;
      this.measureEnd = worldPt;
    } 
    else if (this.activeTool === "select") {
      // Find what was clicked
      const clicked = this.findItemAtWorldCoords(worldPt);
      if (clicked) {
        this.selectedItem = clicked;
        this.selectedRoom = null;
        if (!clicked.locked) {
          this.draggedItem = clicked;
          this.dragOffset = {
            x: worldPt.x - clicked.x,
            y: worldPt.y - clicked.y
          };
          this.pushStateToUndo();
        }
      } else {
        // Check wall click
        const clickedWall = this.findWallAtWorldCoords(worldPt);
        if (clickedWall) {
          this.selectedItem = clickedWall;
          this.selectedRoom = null;
        } else {
          this.selectedItem = null;
          // Check room click
          const rooms = this.detectRooms ? this.detectRooms() : [];
          let clickedRoom = null;
          for (let r of rooms) {
            if (this.isPointInPolygon && this.isPointInPolygon(worldPt, r.polygon)) {
              clickedRoom = r;
              break;
            }
          }
          this.selectedRoom = clickedRoom;
        }
      }
      this.updateInspector();
    }
    
    this.draw();
  },

  handleMouseMove: function(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    
    if (this.isPanning) {
      this.panX = e.clientX - this.startPanX;
      this.panY = e.clientY - this.startPanY;
      this.draw();
      return;
    }
    
    const worldPt = this.screenToWorld(sx, sy);
    const snapped = this.snapCoords(worldPt);
    
    if (this.activeTool === "wall" && this.isDrawingWall) {
      this.tempWallEndPoint = snapped;
      this.draw();
    }
    else if (this.activeTool === "room" && this.isDrawingRoom) {
      this.tempRoomEndPoint = snapped;
      this.draw();
    }
    else if (this.activeTool === "measure" && this.measureStart) {
      this.measureEnd = worldPt;
      this.draw();
    } 
    else if (this.activeTool === "select" && this.draggedItem) {
      this.draggedItem.x = this.snapToGrid(worldPt.x - this.dragOffset.x);
      this.draggedItem.y = this.snapToGrid(worldPt.y - this.dragOffset.y);
      this.updateInspector();
      this.draw();
    }
  },

  handleMouseUp: function(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
      return;
    }
    
    if (this.activeTool === "wall" && this.isDrawingWall) {
      // Create new wall if length > 0
      const dx = this.tempWallEndPoint.x - this.wallStartPoint.x;
      const dy = this.tempWallEndPoint.y - this.wallStartPoint.y;
      const len = Math.sqrt(dx*dx + dy*dy);

      if (len > 0.1) {
        const wallId = "w_" + Date.now();
        this.walls.push({
          id: wallId,
          x1: this.wallStartPoint.x,
          y1: this.wallStartPoint.y,
          x2: this.tempWallEndPoint.x,
          y2: this.tempWallEndPoint.y,
          thickness: this.settings.wallThickness,
          height: this.settings.wallHeight
        });

        // Auto chains drawing
        this.wallStartPoint = this.tempWallEndPoint;

        if (window.threeViewer) threeViewer.needsRebuild = true;
      } else {
        this.isDrawingWall = false;
      }
    }
    else if (this.activeTool === "room" && this.isDrawingRoom) {
      this.createRoomFromRect(this.roomStartPoint, this.tempRoomEndPoint);
      this.isDrawingRoom = false;
      this.roomStartPoint = null;
      this.tempRoomEndPoint = null;
    }
    else if (this.activeTool === "measure") {
      // Keep measurement on screen until next click
    } 
    else if (this.activeTool === "select" && this.draggedItem) {
      this.draggedItem = null;
      if (window.threeViewer) threeViewer.needsRebuild = true;
      projects.saveCurrentToStorage();
    }
    
    this.draw();
  },

  handleWheel: function(e) {
    e.preventDefault();
    const zoomFactor = 1.1;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Zoom centered on mouse
    const worldBefore = this.screenToWorld(mouseX, mouseY);
    
    if (e.deltaY < 0) {
      this.zoom = Math.min(this.zoomMax, this.zoom * zoomFactor);
    } else {
      this.zoom = Math.max(this.zoomMin, this.zoom / zoomFactor);
    }
    
    this.updateZoomIndicator();
    
    const worldAfter = this.screenToWorld(mouseX, mouseY);
    this.panX += (worldAfter.x - worldBefore.x) * this.zoom;
    this.panY -= (worldAfter.y - worldBefore.y) * this.zoom;
    
    this.draw();
  },

  handleKeyDown: function(e) {
    const isStudioActive = document.getElementById("studio-page").classList.contains("active");
    if (!isStudioActive) return;
    
    // Space bar holding activates pan mode
    if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      if (!this.spacePressed) {
        this.spacePressed = true;
        this.canvas.style.cursor = "grab";
      }
    }
    
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selectedItem && !this.selectedItem.locked) {
        this.pushStateToUndo();
        this.deleteSelectedItem();
      }
    } 
    else if (e.key === "Escape") {
      this.selectTool("select");
      this.selectedItem = null;
      this.updateInspector();
      this.draw();
    }
    else if (e.ctrlKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      this.undo();
    }
    else if (e.ctrlKey && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.redo();
    }
    else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      if (this.selectedItem && this.selectedItem.x1 === undefined) {
        this.copiedItem = JSON.parse(JSON.stringify(this.selectedItem));
        this.showToast("Copied selection");
      }
    }
    else if (e.ctrlKey && e.key.toLowerCase() === "v") {
      if (this.copiedItem) {
        e.preventDefault();
        this.pushStateToUndo();
        const copy = JSON.parse(JSON.stringify(this.copiedItem));
        copy.id = "f_dup_" + Date.now();
        copy.x += 0.5;
        copy.y -= 0.5;
        copy.locked = false; // ensure new pasted item is unlocked
        this.items.push(copy);
        this.selectedItem = copy;
        this.updateInspector();
        this.draw();
        if (window.threeViewer) threeViewer.needsRebuild = true;
        projects.saveCurrentToStorage();
        this.showToast("Pasted item");
      }
    }
    else if (e.key.toLowerCase() === "w" && e.target.tagName !== "INPUT") {
      this.selectTool("wall");
    }
    else if (e.key.toLowerCase() === "v" && e.target.tagName !== "INPUT") {
      this.selectTool("select");
    }
    else if (e.key.toLowerCase() === "d" && e.target.tagName !== "INPUT") {
      this.selectTool("door");
    }
  },

  handleKeyUp: function(e) {
    if (e.code === "Space") {
      this.spacePressed = false;
      this.isPanning = false;
      this.canvas.style.cursor = "default";
      this.draw();
    }
  },

  _toastTimeout: null,
  showToast: function(msg) {
    let toast = document.getElementById("hud-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "hud-toast";
      toast.style.cssText = "position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%); background: rgba(15,23,42,0.9); color: #06b6d4; padding: 8px 18px; border-radius: 24px; font-size: 0.75rem; font-weight: 600; border: 1px solid rgba(6,182,212,0.2); z-index: 10000; pointer-events: none; opacity: 0; transition: opacity 0.2s ease-in-out;";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = 1;
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.style.opacity = 0;
    }, 2000);
  },

  // Wall attachment placer (Doors / Windows)
  insertWallAttachment: function(type, pt) {
    const snapDistance = 0.5; // click sensitivity in meters
    let bestWall = null;
    let minD = Infinity;
    let bestProj = null;
    
    this.walls.forEach(w => {
      const proj = this.projectPtOnLine(pt, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      if (proj.isOnSegment) {
        if (proj.distance < minD && proj.distance < snapDistance) {
          minD = proj.distance;
          bestWall = w;
          bestProj = proj.point;
        }
      }
    });
    
    if (bestWall) {
      // Calculate rotation angle of the wall
      const dx = bestWall.x2 - bestWall.x1;
      const dy = bestWall.y2 - bestWall.y1;
      let rotRad = Math.atan2(dy, dx);
      let rotDeg = Math.round(rotRad * (180 / Math.PI));
      
      const item = {
        id: (type === "door" ? "d_" : "win_") + Date.now(),
        type: type,
        x: bestProj.x,
        y: bestProj.y,
        w: type === "door" ? 0.9 : 1.5, // standard door 90cm, window 1.5m
        h: type === "door" ? 2.1 : 1.2,
        depth: bestWall.thickness,
        rotation: rotDeg,
        color: type === "door" ? "#a1a1aa" : "#38bdf8",
        material: type === "door" ? "wood" : "glass"
      };
      
      this.items.push(item);
      this.selectedItem = item;
      this.updateInspector();
      this.selectTool("select");
      
      if (window.threeViewer) threeViewer.needsRebuild = true;
      projects.saveCurrentToStorage();
    } else {
      alert("Please place doors and windows directly on existing walls.");
      this.selectTool("select");
    }
  },

  createRoomFromRect: function(startPt, endPt) {
    const minX = Math.min(startPt.x, endPt.x);
    const maxX = Math.max(startPt.x, endPt.x);
    const minY = Math.min(startPt.y, endPt.y);
    const maxY = Math.max(startPt.y, endPt.y);
    const width = maxX - minX;
    const height = maxY - minY;

    if (width < 0.5 || height < 0.5) {
      this.selectTool("select");
      return;
    }

    const ts = Date.now();
    const thickness = this.settings.wallThickness;
    const wallHeight = this.settings.wallHeight;
    const segments = [
      { x1: minX, y1: minY, x2: maxX, y2: minY },
      { x1: maxX, y1: minY, x2: maxX, y2: maxY },
      { x1: maxX, y1: maxY, x2: minX, y2: maxY },
      { x1: minX, y1: maxY, x2: minX, y2: minY }
    ];

    segments.forEach((seg, idx) => {
      this.walls.push({
        id: "w_" + ts + "_" + idx,
        x1: seg.x1,
        y1: seg.y1,
        x2: seg.x2,
        y2: seg.y2,
        thickness,
        height: wallHeight
      });
    });

    this.selectTool("select");
    if (window.threeViewer) threeViewer.needsRebuild = true;
    projects.saveCurrentToStorage();
  },

  projectPtOnLine: function(pt, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx*dx + dy*dy;
    
    if (lenSq === 0) return { point: p1, distance: Math.hypot(pt.x - p1.x, pt.y - p1.y), isOnSegment: false };
    
    let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    
    const projPt = {
      x: p1.x + t * dx,
      y: p1.y + t * dy
    };
    
    return {
      point: projPt,
      distance: Math.hypot(pt.x - projPt.x, pt.y - projPt.y),
      isOnSegment: t >= 0 && t <= 1
    };
  },

  // Hit test selections
  findItemAtWorldCoords: function(pt) {
    // Reverse loop to find topmost item first
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const radius = Math.max(item.w, item.h) / 2;
      const d = Math.hypot(pt.x - item.x, pt.y - item.y);
      if (d <= radius) return item;
    }
    return null;
  },

  findWallAtWorldCoords: function(pt) {
    const sensitivity = 0.25; // meters
    for (let i = 0; i < this.walls.length; i++) {
      const w = this.walls[i];
      const proj = this.projectPtOnLine(pt, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      if (proj.isOnSegment && proj.distance <= sensitivity) {
        return w;
      }
    }
    return null;
  },

  // Library Items catalog placements
  createItemFromLibrary: function(type) {
    this.pushStateToUndo();
    
    // Create element offset in middle viewport
    const viewCenter = this.screenToWorld(this.canvas.width / 2, this.canvas.height / 2);
    const snapped = this.snapCoords(viewCenter);
    
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
      pool: { w: 6.0, h: 3.5, depth: 1.6, color: "#22d3ee", material: "marble" },
      plant: { w: 0.6, h: 0.6, depth: 1.5, color: "#10b981", material: "fabric" },
      staircase: { w: 1.2, h: 3.0, depth: 3.0, color: "#44403c", material: "wood" },
      desk: { w: 1.4, h: 0.7, depth: 0.75, color: "#a16207", material: "wood" },
      bookshelf: { w: 1.0, h: 0.4, depth: 1.8, color: "#78350f", material: "wood" },
      bath_tub: { w: 1.7, h: 0.8, depth: 0.6, color: "#ffffff", material: "marble" },
      wash_basin: { w: 0.8, h: 0.55, depth: 0.85, color: "#f8fafc", material: "wood" },
      lamp_floor: { w: 0.4, h: 0.4, depth: 1.6, color: "#eab308", material: "metal" },
      office_chair: { w: 0.65, h: 0.65, depth: 0.9, color: "#1e293b", material: "fabric" },
      decor_tv: { w: 1.2, h: 0.1, depth: 0.7, color: "#0f172a", material: "metal" }
    };
    
    const specs = presets[type] || { w: 1.0, h: 1.0, depth: 0.8, color: "#ffffff", material: "wood" };
    
    const newItem = {
      id: "f_" + Date.now(),
      type: type,
      x: snapped.x,
      y: snapped.y,
      w: specs.w,
      h: specs.h,
      depth: specs.depth,
      rotation: 0,
      color: specs.color,
      material: specs.material
    };
    
    this.items.push(newItem);
    this.selectedItem = newItem;
    
    this.selectTool("select");
    this.updateInspector();
    
    if (window.threeViewer) threeViewer.needsRebuild = true;
    projects.saveCurrentToStorage();
  },

  deleteSelectedItem: function() {
    if (!this.selectedItem) return;
    
    if (this.selectedItem.x1 !== undefined) {
      // Wall
      this.walls = this.walls.filter(w => w.id !== this.selectedItem.id);
    } else {
      // Placed item
      this.items = this.items.filter(item => item.id !== this.selectedItem.id);
    }
    
    this.selectedItem = null;
    this.updateInspector();
    this.draw();
    
    if (window.threeViewer) threeViewer.needsRebuild = true;
    projects.saveCurrentToStorage();
  },

  duplicateSelectedItem: function() {
    if (!this.selectedItem || this.selectedItem.x1 !== undefined) return; // Only furniture
    
    this.pushStateToUndo();
    const copy = JSON.parse(JSON.stringify(this.selectedItem));
    copy.id = "f_dup_" + Date.now();
    copy.x += 0.5; // Offset placement
    copy.y -= 0.5;
    
    this.items.push(copy);
    this.selectedItem = copy;
    this.updateInspector();
    this.draw();
    
    if (window.threeViewer) threeViewer.needsRebuild = true;
    projects.saveCurrentToStorage();
  },

  // Updates Form inspector variables
  updateSettings: function() {
    const setUnits = document.getElementById("setting-units");
    const setHeight = document.getElementById("setting-wall-height");
    const setThickness = document.getElementById("setting-wall-thickness");
    const setSnap = document.getElementById("setting-snap");
    
    this.settings.units = setUnits ? setUnits.value : "meters";
    this.settings.wallHeight = setHeight ? Number(setHeight.value) : 2.8;
    this.settings.wallThickness = setThickness ? Number(setThickness.value) / 100 : 0.2;
    this.settings.gridSnap = setSnap ? Number(setSnap.value) / 100 : 0.1;
    
    this.draw();
    if (window.threeViewer) threeViewer.needsRebuild = true;
    projects.saveCurrentToStorage();
  },

  updateInspector: function() {
    const pane = document.getElementById("inspector-content");
    const typeLabel = document.getElementById("properties-type-label");
    if (!pane) return;
    
    if (!this.selectedItem) {
      typeLabel.textContent = "No element selected";
      pane.innerHTML = `
        <div class="empty-properties-message text-center">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <p>Select a wall, door, window, or furniture item on the canvas to inspect and edit details.</p>
        </div>
      `;
      return;
    }
    
    const isWall = this.selectedItem.x1 !== undefined;
    
    if (isWall) {
      typeLabel.textContent = "Selected element: Wall";
      pane.innerHTML = `
        <div class="inspector-group">
          <h4>Wall Constraints</h4>
          <div class="inspector-row">
            <label>Thickness (cm)</label>
            <input type="number" class="input-property" value="${Math.round(this.selectedItem.thickness * 100)}" onchange="editor.applyPropertyChange('thickness', this.value)">
          </div>
          <div class="inspector-row">
            <label>Height (m)</label>
            <input type="number" class="input-property" value="${this.selectedItem.height}" step="0.1" onchange="editor.applyPropertyChange('height', this.value)">
          </div>
        </div>
        <div class="inspector-group">
          <h4>Node Coordinates</h4>
          <div class="inspector-row">
            <label>Start X (m)</label>
            <input type="number" class="input-property" value="${this.selectedItem.x1.toFixed(2)}" step="0.1" onchange="editor.applyPropertyChange('x1', this.value)">
          </div>
          <div class="inspector-row">
            <label>Start Y (m)</label>
            <input type="number" class="input-property" value="${this.selectedItem.y1.toFixed(2)}" step="0.1" onchange="editor.applyPropertyChange('y1', this.value)">
          </div>
          <div class="inspector-row">
            <label>End X (m)</label>
            <input type="number" class="input-property" value="${this.selectedItem.x2.toFixed(2)}" step="0.1" onchange="editor.applyPropertyChange('x2', this.value)">
          </div>
          <div class="inspector-row">
            <label>End Y (m)</label>
            <input type="number" class="input-property" value="${this.selectedItem.y2.toFixed(2)}" step="0.1" onchange="editor.applyPropertyChange('y2', this.value)">
          </div>
        </div>
        <div class="inspector-group" style="margin-top: auto;">
          <button class="btn btn-secondary btn-full" onclick="editor.deleteSelectedItem()" style="color: #ef4444; border-color: rgba(239,68,68,0.2);">
            Delete Wall (Del)
          </button>
        </div>
      `;
    } else {
      // Furniture or Wall Attachments
      const item = this.selectedItem;
      typeLabel.textContent = "Selected: " + item.type.toUpperCase().replace('_', ' ');
      
      const materialOptions = ["wood", "walnut", "marble", "fabric", "metal", "glass", "concrete", "brick", "tile"]
        .map(mat => `<option value="${mat}" ${item.material === mat ? "selected" : ""}>${mat.charAt(0).toUpperCase() + mat.slice(1)}</option>`)
        .join('');
        
      let stairHtml = "";
      if (item.type === "staircase") {
        const floorOptions = (this.floors || [])
          .map(f => `<option value="${f.id}" ${item.connectToFloorId === f.id ? "selected" : ""}>${f.name}</option>`)
          .join('');
        stairHtml = `
          <div class="inspector-group">
            <h4>Staircase Connection</h4>
            <div class="inspector-row">
              <label>Connect to Floor</label>
              <select class="select-property" onchange="editor.applyPropertyChange('connectToFloorId', this.value)">
                <option value="">(None - Decor Only)</option>
                ${floorOptions}
              </select>
            </div>
          </div>
        `;
      }

      pane.innerHTML = `
        ${stairHtml}
        <div class="inspector-group">
          <h4>Position &amp; State</h4>
          <div class="inspector-row">
            <label>Pos X (m)</label>
            <input type="number" class="input-property" value="${item.x.toFixed(2)}" step="0.05" onchange="editor.applyPropertyChange('x', this.value)">
          </div>
          <div class="inspector-row">
            <label>Pos Y (m)</label>
            <input type="number" class="input-property" value="${item.y.toFixed(2)}" step="0.05" onchange="editor.applyPropertyChange('y', this.value)">
          </div>
          <div class="inspector-row">
            <label>Rotation (&deg;)</label>
            <input type="number" class="input-property" value="${item.rotation}" step="5" onchange="editor.applyPropertyChange('rotation', this.value)">
          </div>
          <div class="inspector-row" style="display: flex; align-items: center; justify-content: space-between;">
            <label style="margin: 0;">Locked (No Drag)</label>
            <input type="checkbox" style="width: auto; margin: 0;" ${item.locked ? "checked" : ""} onchange="editor.applyPropertyChange('locked', this.checked)">
          </div>
        </div>
        <div class="inspector-group">
          <h4>Dimensions</h4>
          <div class="inspector-row">
            <label>Width (m)</label>
            <input type="number" class="input-property" value="${item.w.toFixed(2)}" step="0.05" onchange="editor.applyPropertyChange('w', this.value)">
          </div>
          <div class="inspector-row">
            <label>${item.type === 'door' || item.type === 'window' ? 'Height' : 'Depth'} (m)</label>
            <input type="number" class="input-property" value="${item.h.toFixed(2)}" step="0.05" onchange="editor.applyPropertyChange('h', this.value)">
          </div>
          <div class="inspector-row">
            <label>${item.type === 'door' || item.type === 'window' ? 'Depth' : 'Height'} (m)</label>
            <input type="number" class="input-property" value="${item.depth.toFixed(2)}" step="0.05" onchange="editor.applyPropertyChange('depth', this.value)">
          </div>
        </div>
        <div class="inspector-group">
          <h4>Style &amp; Material</h4>
          <div class="inspector-row">
            <label>Material</label>
            <select class="select-property" onchange="editor.applyPropertyChange('material', this.value)">
              ${materialOptions}
            </select>
          </div>
          <div class="inspector-row">
            <label>Hex Color</label>
            <div class="color-picker-row">
              <input type="color" value="${item.color}" onchange="editor.applyPropertyChange('color', this.value)">
            </div>
          </div>
        </div>
        <div class="inspector-group" style="margin-top: 24px; display: flex; gap: 8px;">
          <button class="btn btn-secondary" onclick="editor.duplicateSelectedItem()" style="flex: 1; font-size: 0.8rem;">Duplicate</button>
          <button class="btn btn-secondary" onclick="editor.deleteSelectedItem()" style="flex: 1; font-size: 0.8rem; color: #ef4444; border-color: rgba(239,68,68,0.2);">Delete</button>
        </div>
      `;
    }
  },

  applyPropertyChange: function(prop, val) {
    if (!this.selectedItem) return;
    this.pushStateToUndo();
    
    const numeric = ["x", "y", "x1", "y1", "x2", "y2", "thickness", "height", "w", "h", "depth", "rotation"].includes(prop);
    const booleanVal = prop === "locked";
    
    let converted;
    if (numeric) {
      converted = Number(val);
    } else if (booleanVal) {
      converted = val === true || val === "true";
    } else {
      converted = val;
    }
    
    if (prop === "thickness") {
      this.selectedItem.thickness = converted / 100; // convert cm input to m
    } else {
      this.selectedItem[prop] = converted;
    }
    
    this.draw();
    if (window.threeViewer) threeViewer.needsRebuild = true;
    projects.saveCurrentToStorage();
  },

  updateGlobalMaterials: function() {
    const matWalls = document.getElementById("material-walls");
    const matFloors = document.getElementById("material-floors");
    const matDoors = document.getElementById("material-doors");
    
    this.settings.materials = {
      walls: matWalls ? matWalls.value : "white_paint",
      floors: matFloors ? matFloors.value : "oak_wood",
      doors: matDoors ? matDoors.value : "oak"
    };
    
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }
    projects.saveCurrentToStorage();
  },

  filterCatalog: function(query) {
    const list = document.querySelectorAll(".library-item");
    const q = query.toLowerCase();
    
    list.forEach(card => {
      const name = card.querySelector("span").textContent.toLowerCase();
      if (name.includes(q)) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    });
  },

  // DRAW ENGINE (2D Viewport)
  draw: function() {
    if (!this.ctx || !this.canvas || this.canvas.width === 0 || this.canvas.height === 0) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.drawGrid();
    this.drawRoomsHighlight();
    this.drawWalls();
    this.drawItems();
    this.drawCurrentInteractiveTool();
  },

  drawGrid: function() {
    const gridColor = "rgba(255, 255, 255, 0.02)";
    const majorGridColor = "rgba(255, 255, 255, 0.05)";
    
    // Calculate grid coordinate bounds
    const leftPt = this.screenToWorld(0, 0);
    const rightPt = this.screenToWorld(this.canvas.width, this.canvas.height);
    
    const startX = Math.floor(leftPt.x);
    const endX = Math.ceil(rightPt.x);
    const startY = Math.floor(rightPt.y);
    const endY = Math.ceil(leftPt.y);
    
    this.ctx.lineWidth = 1;
    
    // Draw minor grid coordinates (10cm spacing if zoom is large)
    const displayMinor = this.zoom > 25;
    if (displayMinor) {
      this.ctx.strokeStyle = gridColor;
      for (let x = startX; x <= endX; x += 0.1) {
        if (Math.abs(x - Math.round(x)) < 0.01) continue; // Skip major axis lines
        const s = this.worldToScreen(x, 0);
        this.ctx.beginPath();
        this.ctx.moveTo(s.x, 0);
        this.ctx.lineTo(s.x, this.canvas.height);
        this.ctx.stroke();
      }
      for (let y = startY; y <= endY; y += 0.1) {
        if (Math.abs(y - Math.round(y)) < 0.01) continue;
        const s = this.worldToScreen(0, y);
        this.ctx.beginPath();
        this.ctx.moveTo(0, s.x ? s.y : 0);
        this.ctx.lineTo(this.canvas.width, s.y);
        this.ctx.stroke();
      }
    }
    
    // Draw major grid coordinates (1m spacing)
    this.ctx.strokeStyle = majorGridColor;
    for (let x = startX; x <= endX; x++) {
      const s = this.worldToScreen(x, 0);
      this.ctx.beginPath();
      this.ctx.moveTo(s.x, 0);
      this.ctx.lineTo(s.x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = startY; y <= endY; y++) {
      const s = this.worldToScreen(0, y);
      this.ctx.beginPath();
      this.ctx.moveTo(0, s.y);
      this.ctx.lineTo(this.canvas.width, s.y);
      this.ctx.stroke();
    }
    
    // Draw main structural Axis line crosses
    const origin = this.worldToScreen(0, 0);
    this.ctx.strokeStyle = "rgba(6, 182, 212, 0.25)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(origin.x, 0);
    this.ctx.lineTo(origin.x, this.canvas.height);
    this.ctx.moveTo(0, origin.y);
    this.ctx.lineTo(this.canvas.width, origin.y);
    this.ctx.stroke();
  },

  drawRoomsHighlight: function() {
    if (this.walls.length === 0) return;
    
    // Detect enclosed rooms
    const rooms = this.detectRooms();
    
    rooms.forEach((room, roomIdx) => {
      const poly = room.polygon;
      if (poly.length < 3) return;
      
      // 1. Draw soft blue/cyan room highlight fill
      this.ctx.beginPath();
      const startPt = this.worldToScreen(poly[0].x, poly[0].y);
      this.ctx.moveTo(startPt.x, startPt.y);
      for (let k = 1; k < poly.length; k++) {
        const pt = this.worldToScreen(poly[k].x, poly[k].y);
        this.ctx.lineTo(pt.x, pt.y);
      }
      this.ctx.closePath();
      
      const isSelected = this.selectedRoom && this.isSameRoom && this.isSameRoom(this.selectedRoom, room);
      if (isSelected) {
        this.ctx.fillStyle = "rgba(6, 182, 212, 0.18)";
      } else {
        this.ctx.fillStyle = "rgba(6, 182, 212, 0.05)";
      }
      this.ctx.fill();
      this.ctx.strokeStyle = isSelected ? "rgba(6, 182, 212, 0.5)" : "rgba(6, 182, 212, 0.16)";
      this.ctx.lineWidth = isSelected ? 1.5 : 1;
      this.ctx.stroke();
      
      // 2. Centroid calculation
      let sumX = 0, sumY = 0;
      poly.forEach(p => { sumX += p.x; sumY += p.y; });
      const cx = sumX / poly.length;
      const cy = sumY / poly.length;
      
      // 3. Size-based Room Type Labels
      let roomName = "Hallway";
      if (room.area >= 20.0) roomName = "Living Room";
      else if (room.area >= 12.0) roomName = "Bedroom";
      else if (room.area >= 7.0) roomName = "Kitchen";
      else if (room.area >= 4.5) roomName = "Dining Room";
      else if (room.area < 4.5) roomName = "Bathroom";
      
      const s = this.worldToScreen(cx, cy);
      
      // Label pill dimensions
      const labelText = roomName;
      const areaText = room.area.toFixed(1) + " m²";
      
      this.ctx.font = "bold 9px sans-serif";
      const wLabel = this.ctx.measureText(labelText).width;
      this.ctx.font = "9px monospace";
      const wArea = this.ctx.measureText(areaText).width;
      
      const textWidth = Math.max(wLabel, wArea);
      const padX = 12;
      const padY = 6;
      const rw = textWidth + padX * 2;
      const rh = 30;
      
      // Draw background pill card
      this.ctx.fillStyle = "rgba(15, 23, 42, 0.85)"; // dark slate
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      this.ctx.lineWidth = 1.2;
      
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
        this.ctx.roundRect(s.x - rw/2, s.y - rh/2, rw, rh, 6);
      } else {
        this.ctx.rect(s.x - rw/2, s.y - rh/2, rw, rh);
      }
      this.ctx.fill();
      this.ctx.stroke();
      
      // Draw Text Labels
      this.ctx.fillStyle = "#f8fafc";
      this.ctx.textAlign = "center";
      this.ctx.font = "bold 9px sans-serif";
      this.ctx.fillText(labelText.toUpperCase(), s.x, s.y - 2);
      
      this.ctx.fillStyle = "#06b6d4"; // cyan
      this.ctx.font = "9px monospace";
      this.ctx.fillText(areaText, s.x, s.y + 9);
    });
  },

  detectRooms: function() {
    const segments = [];
    this.walls.forEach(w => {
      segments.push({
        p1: { x: w.x1, y: w.y1 },
        p2: { x: w.x2, y: w.y2 }
      });
    });

    const points = [];
    segments.forEach(s => {
      points.push(s.p1);
      points.push(s.p2);
    });

    const pointOnSegment = (p, p1, p2, tolerance = 0.05) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx*dx + dy*dy;
      if (lenSq === 0) return false;
      let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq;
      if (t < 0.01 || t > 0.99) return false;
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      return Math.hypot(p.x - projX, p.y - projY) < tolerance;
    };

    // Split segments at T-junctions
    let splitOccurred = true;
    let iterations = 0;
    while (splitOccurred && iterations < 5) {
      splitOccurred = false;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        for (let j = 0; j < points.length; j++) {
          const pt = points[j];
          if (pointOnSegment(pt, seg.p1, seg.p2)) {
            const newSeg1 = { p1: seg.p1, p2: pt };
            const newSeg2 = { p1: pt, p2: seg.p2 };
            segments.splice(i, 1, newSeg1, newSeg2);
            splitOccurred = true;
            break;
          }
        }
        if (splitOccurred) break;
      }
      iterations++;
    }

    // Build unique vertices
    const vertices = [];
    const getVertexId = (p) => {
      for (let i = 0; i < vertices.length; i++) {
        if (Math.hypot(vertices[i].x - p.x, vertices[i].y - p.y) < 0.05) {
          return i;
        }
      }
      vertices.push({ x: p.x, y: p.y });
      return vertices.length - 1;
    };

    const edges = [];
    segments.forEach(s => {
      const id1 = getVertexId(s.p1);
      const id2 = getVertexId(s.p2);
      if (id1 !== id2) {
        edges.push({ from: id1, to: id2 });
        edges.push({ from: id2, to: id1 });
      }
    });

    const adj = Array.from({ length: vertices.length }, () => []);
    edges.forEach((e, idx) => {
      const dx = vertices[e.to].x - vertices[e.from].x;
      const dy = vertices[e.to].y - vertices[e.from].y;
      e.angle = Math.atan2(dy, dx);
      e.id = idx;
      adj[e.from].push(e);
    });

    adj.forEach(list => {
      list.sort((a, b) => a.angle - b.angle);
    });

    const visited = new Array(edges.length).fill(false);
    const rooms = [];

    const normalizeAngle = (a) => {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    };

    for (let i = 0; i < edges.length; i++) {
      if (visited[i]) continue;
      
      const path = [];
      let curr = edges[i];
      let aborted = false;
      
      while (!visited[curr.id]) {
        visited[curr.id] = true;
        path.push(curr.from);
        
        const outgoing = adj[curr.to];
        if (outgoing.length === 0) { aborted = true; break; }
        
        let revIdx = -1;
        for (let k = 0; k < outgoing.length; k++) {
          if (outgoing[k].to === curr.from) {
            revIdx = k;
            break;
          }
        }
        
        if (revIdx === -1) { aborted = true; break; }
        curr = outgoing[(revIdx + 1) % outgoing.length];
      }
      
      if (!aborted && path.length >= 3) {
        let area = 0;
        for (let k = 0; k < path.length; k++) {
          const p1 = vertices[path[k]];
          const p2 = vertices[path[(k + 1) % path.length]];
          area += p1.x * p2.y - p2.x * p1.y;
        }
        area /= 2;
        
        if (area > 0) {
          rooms.push({
            polygon: path.map(idx => vertices[idx]),
            area: area
          });
        }
      }
    }
    if (this.assignRoomIds) {
      this.assignRoomIds(rooms);
    }
    return rooms;
  },

  drawWalls: function() {
    this.walls.forEach(w => {
      const p1 = this.worldToScreen(w.x1, w.y1);
      const p2 = this.worldToScreen(w.x2, w.y2);
      
      const isSelected = this.selectedItem === w;
      
      // Calculate drawing thickness
      const thicknessPx = w.thickness * this.zoom;
      
      // Main solid Wall line
      this.ctx.strokeStyle = isSelected ? "rgba(59, 130, 246, 0.85)" : "#334155";
      this.ctx.lineWidth = Math.max(4, thicknessPx);
      this.ctx.lineCap = "round";
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      
      // Wall internal core schematic
      this.ctx.strokeStyle = isSelected ? "#3b82f6" : "#64748b";
      this.ctx.lineWidth = Math.max(1, thicknessPx - 4);
      this.ctx.stroke();
      
      // Node endpoints cross lines
      this.ctx.fillStyle = isSelected ? "#3b82f6" : "#cbd5e1";
      this.ctx.beginPath();
      this.ctx.arc(p1.x, p1.y, 4, 0, Math.PI*2);
      this.ctx.arc(p2.x, p2.y, 4, 0, Math.PI*2);
      this.ctx.fill();
      
      // Wall length labels text overlays
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      if (this.zoom > 15) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Calculate tangent angle for text rotation alignment
        let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        if (angle > Math.PI/2 || angle < -Math.PI/2) angle += Math.PI;
        
        this.ctx.save();
        this.ctx.translate(midX, midY);
        this.ctx.rotate(angle);
        
        this.ctx.fillStyle = "rgba(0,0,0,0.8)";
        this.ctx.fillRect(-22, -18, 44, 12);
        
        this.ctx.font = "bold 8px monospace";
        this.ctx.fillStyle = isSelected ? "#3b82f6" : "#94a3b8";
        this.ctx.textAlign = "center";
        this.ctx.fillText(len.toFixed(2) + "m", 0, -10);
        
        this.ctx.restore();
      }
    });
  },

  drawItems: function() {
    this.items.forEach(item => {
      if (item.hidden) return;
      const scr = this.worldToScreen(item.x, item.y);
      const isSelected = this.selectedItem === item;
      
      this.ctx.save();
      this.ctx.translate(scr.x, scr.y);
      // Flip vertical coordinate systems
      this.ctx.rotate(-item.rotation * (Math.PI / 180));
      
      const wPx = item.w * this.zoom;
      const hPx = item.h * this.zoom;
      
      if (item.type === "door") {
        // Render 2D Door swing arc inside wall
        this.ctx.strokeStyle = isSelected ? "#3b82f6" : "#cbd5e1";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        // Door panel
        this.ctx.moveTo(-wPx/2, 0);
        this.ctx.lineTo(-wPx/2, -wPx);
        // Swing path arc
        this.ctx.stroke();
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "rgba(255,255,255,0.15)";
        this.ctx.setLineDash([3, 3]);
        this.ctx.beginPath();
        this.ctx.arc(-wPx/2, 0, wPx, -Math.PI/2, 0);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      } 
      else if (item.type === "window") {
        // Render 2D double-pane window element
        this.ctx.fillStyle = isSelected ? "rgba(59, 130, 246, 0.25)" : "rgba(56, 189, 248, 0.25)";
        this.ctx.strokeStyle = isSelected ? "#3b82f6" : "#38bdf8";
        this.ctx.lineWidth = 1.5;
        this.ctx.fillRect(-wPx/2, -hPx/2, wPx, hPx);
        this.ctx.strokeRect(-wPx/2, -hPx/2, wPx, hPx);
        
        // Internal pane split lines
        this.ctx.beginPath();
        this.ctx.moveTo(-wPx/2, 0);
        this.ctx.lineTo(wPx/2, 0);
        this.ctx.stroke();
      } 
      else {
        // Render general furniture catalog blueprint silhouettes
        this.ctx.fillStyle = isSelected ? "rgba(6, 182, 212, 0.15)" : "rgba(255,255,255,0.03)";
        this.ctx.strokeStyle = isSelected ? "#06b6d4" : "rgba(255,255,255,0.2)";
        this.ctx.lineWidth = isSelected ? 2 : 1;
        
        if (item.type === "sofa") {
          // Render sofa layout with armrests
          this.ctx.fillRect(-wPx/2, -hPx/2, wPx, hPx);
          this.ctx.strokeRect(-wPx/2, -hPx/2, wPx, hPx);
          
          // Armrest elements
          const armW = 0.12 * this.zoom;
          this.ctx.strokeRect(-wPx/2, -hPx/2, armW, hPx);
          this.ctx.strokeRect(wPx/2 - armW, -hPx/2, armW, hPx);
          // Back pillow
          const backW = 0.15 * this.zoom;
          this.ctx.strokeRect(-wPx/2, hPx/2 - backW, wPx, backW);
        }
        else if (item.type === "bed_double") {
          this.ctx.fillRect(-wPx/2, -hPx/2, wPx, hPx);
          this.ctx.strokeRect(-wPx/2, -hPx/2, wPx, hPx);
          // Pillows
          const pilW = 0.5 * this.zoom;
          const pilH = 0.3 * this.zoom;
          this.ctx.strokeRect(-wPx/2 + 0.2*this.zoom, -hPx/2 + 0.1*this.zoom, pilW, pilH);
          this.ctx.strokeRect(wPx/2 - 0.2*this.zoom - pilW, -hPx/2 + 0.1*this.zoom, pilW, pilH);
          // Sheet fold line
          this.ctx.beginPath();
          this.ctx.moveTo(-wPx/2, -hPx/2 + 0.7*this.zoom);
          this.ctx.lineTo(wPx/2, -hPx/2 + 0.7*this.zoom);
          this.ctx.stroke();
        }
        else if (item.type === "plant") {
          // Potted leaf circles
          this.ctx.beginPath();
          this.ctx.arc(0, 0, wPx/2, 0, Math.PI*2);
          this.ctx.fill();
          this.ctx.stroke();
          
          // Leaves radiating
          this.ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
          this.ctx.lineWidth = 1.5;
          for (let a = 0; a < Math.PI*2; a += Math.PI/4) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(Math.cos(a)*wPx/2.2, Math.sin(a)*wPx/2.2);
            this.ctx.stroke();
          }
        }
        else if (item.type === "pool") {
          // Water tile visual
          this.ctx.fillStyle = "rgba(34, 211, 238, 0.15)";
          this.ctx.strokeStyle = "#06b6d4";
          this.ctx.fillRect(-wPx/2, -hPx/2, wPx, hPx);
          this.ctx.strokeRect(-wPx/2, -hPx/2, wPx, hPx);
          // Step ladder line marks
          this.ctx.strokeRect(-wPx/2 + 8, -hPx/2 + 4, 12, 16);
        }
        else {
          // General rect fallback
          this.ctx.fillRect(-wPx/2, -hPx/2, wPx, hPx);
          this.ctx.strokeRect(-wPx/2, -hPx/2, wPx, hPx);
          this.ctx.font = "8px monospace";
          this.ctx.fillStyle = "rgba(255,255,255,0.4)";
          this.ctx.textAlign = "center";
          this.ctx.fillText(item.type.slice(0, 6), 0, 3);
        }
      }
      
      this.ctx.restore();
    });
  },

  drawCurrentInteractiveTool: function() {
    if (this.activeTool === "wall" && this.isDrawingWall) {
      const p1 = this.worldToScreen(this.wallStartPoint.x, this.wallStartPoint.y);
      const p2 = this.worldToScreen(this.tempWallEndPoint.x, this.tempWallEndPoint.y);
      
      // Draw temporary green dashed wall line
      this.ctx.strokeStyle = "#10b981";
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      
      // Node circles
      this.ctx.fillStyle = "#10b981";
      this.ctx.beginPath();
      this.ctx.arc(p2.x, p2.y, 4, 0, Math.PI*2);
      this.ctx.fill();
    }
    else if (this.activeTool === "room" && this.isDrawingRoom && this.roomStartPoint && this.tempRoomEndPoint) {
      const minX = Math.min(this.roomStartPoint.x, this.tempRoomEndPoint.x);
      const maxX = Math.max(this.roomStartPoint.x, this.tempRoomEndPoint.x);
      const minY = Math.min(this.roomStartPoint.y, this.tempRoomEndPoint.y);
      const maxY = Math.max(this.roomStartPoint.y, this.tempRoomEndPoint.y);

      const p1 = this.worldToScreen(minX, minY);
      const p2 = this.worldToScreen(maxX, maxY);
      const w = p2.x - p1.x;
      const h = p2.y - p1.y;

      this.ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
      this.ctx.strokeStyle = "#10b981";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([6, 4]);
      this.ctx.fillRect(p1.x, p1.y, w, h);
      this.ctx.strokeRect(p1.x, p1.y, w, h);
      this.ctx.setLineDash([]);

      const roomW = maxX - minX;
      const roomH = maxY - minY;
      this.ctx.fillStyle = "#10b981";
      this.ctx.font = "bold 11px monospace";
      this.ctx.textAlign = "center";
      this.ctx.fillText(roomW.toFixed(2) + "m × " + roomH.toFixed(2) + "m", p1.x + w / 2, p1.y + h / 2);
    }
    else if (this.activeTool === "measure" && this.measureStart && this.measureEnd) {
      const p1 = this.worldToScreen(this.measureStart.x, this.measureStart.y);
      const p2 = this.worldToScreen(this.measureEnd.x, this.measureEnd.y);
      
      // Green dimension extension ticks
      this.ctx.strokeStyle = "#10b981";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      
      // Dimension ticks ends
      this.ctx.fillStyle = "#10b981";
      this.ctx.beginPath();
      this.ctx.arc(p1.x, p1.y, 3, 0, Math.PI*2);
      this.ctx.arc(p2.x, p2.y, 3, 0, Math.PI*2);
      this.ctx.fill();
      
      // Text distance overlay
      const d = Math.hypot(this.measureEnd.x - this.measureStart.x, this.measureEnd.y - this.measureStart.y);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      this.ctx.fillStyle = "#10b981";
      this.ctx.font = "bold 11px monospace";
      this.ctx.fillStyle = "#07080a";
      this.ctx.fillRect(midX - 30, midY - 8, 60, 16);
      this.ctx.strokeStyle = "#10b981";
      this.ctx.strokeRect(midX - 30, midY - 8, 60, 16);
      this.ctx.fillStyle = "#10b981";
      this.ctx.textAlign = "center";
      this.ctx.fillText(d.toFixed(2) + " m", midX, midY + 4);
    }
  },

  isPointInPolygon: function(pt, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y))
          && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 0.00001) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  isSameRoom: function(r1, r2) {
    if (!r1 || !r2) return false;
    if (r1.polygon.length !== r2.polygon.length) return false;
    let sumX1 = 0, sumY1 = 0;
    r1.polygon.forEach(p => { sumX1 += p.x; sumY1 += p.y; });
    const cx1 = sumX1 / r1.polygon.length;
    const cy1 = sumY1 / r1.polygon.length;

    let sumX2 = 0, sumY2 = 0;
    r2.polygon.forEach(p => { sumX2 += p.x; sumY2 += p.y; });
    const cx2 = sumX2 / r2.polygon.length;
    const cy2 = sumY2 / r2.polygon.length;

    return Math.hypot(cx1 - cx2, cy1 - cy2) < 0.05;
  },

  floors: [],
  currentFloorId: null,

  loadFloor: function(floorId) {
    this.syncCurrentFloorState();
    const targetFloor = this.floors.find(f => f.id === floorId);
    if (!targetFloor) return;

    this.currentFloorId = floorId;
    this.walls = targetFloor.walls || [];
    this.items = targetFloor.items || [];
    this.selectedItem = null;
    this.selectedRoom = null;

    if (targetFloor.camera) {
      this.panX = targetFloor.camera.panX || 0;
      this.panY = targetFloor.camera.panY || 0;
      this.zoom = targetFloor.camera.zoom || 40;
    } else {
      this.panX = 0;
      this.panY = 0;
      this.zoom = 40;
    }

    this.undoStack = targetFloor.undoStack || [];
    this.redoStack = targetFloor.redoStack || [];

    this.draw();
    this.updateFloorManagerUI();

    if (window.threeViewer) {
      threeViewer.needsRebuild = true;
    }
  },

  syncCurrentFloorState: function() {
    if (!this.floors) return;
    const current = this.floors.find(f => f.id === this.currentFloorId);
    if (current) {
      current.walls = this.walls;
      current.items = this.items;
      current.camera = { panX: this.panX, panY: this.panY, zoom: this.zoom };
      current.undoStack = this.undoStack;
      current.redoStack = this.redoStack;
    }
  },

  updateFloorManagerUI: function() {
    const container = document.getElementById("floor-list-container");
    if (!container) return;

    container.innerHTML = "";
    
    const reversedFloors = [...this.floors].reverse();

    reversedFloors.forEach(f => {
      const row = document.createElement("div");
      row.className = `floor-item-row ${f.id === this.currentFloorId ? 'active' : ''}`;
      row.onclick = () => this.loadFloor(f.id);

      row.innerHTML = `
        <span class="floor-item-name">${f.name}</span>
        <div class="floor-item-actions" onclick="event.stopPropagation()">
          <button class="floor-action-btn" onclick="editor.renameFloor('${f.id}')" title="Rename Floor">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="floor-action-btn" onclick="editor.duplicateFloor('${f.id}')" title="Duplicate Floor">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="floor-action-btn" onclick="editor.moveFloorUp('${f.id}')" title="Move Up">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="floor-action-btn" onclick="editor.moveFloorDown('${f.id}')" title="Move Down">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="floor-action-btn delete" onclick="editor.deleteFloor('${f.id}')" title="Delete Floor">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      container.appendChild(row);
    });
  },

  addNewFloor: function(name) {
    this.syncCurrentFloorState();

    const count = this.floors.length;
    const floorNames = ["Ground Floor", "First Floor", "Second Floor", "Third Floor", "Fourth Floor", "Fifth Floor"];
    const defName = name || (count < floorNames.length ? floorNames[count] : `Floor ${count}`);
    
    const newFloor = {
      id: "floor_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name: defName,
      walls: [],
      items: [],
      camera: { panX: 0, panY: 0, zoom: 40 },
      undoStack: [],
      redoStack: [],
      settings: { wallHeight: 2.8 }
    };

    this.floors.push(newFloor);
    this.currentFloorId = newFloor.id;
    this.loadFloor(newFloor.id);
    this.showToast(`Added ${newFloor.name}`);
    projects.saveCurrentToStorage();
  },

  duplicateFloor: function(floorId) {
    this.syncCurrentFloorState();
    const source = this.floors.find(f => f.id === floorId);
    if (!source) return;

    const clonedWalls = (source.walls || []).map(w => {
      const newId = "w_" + Math.random().toString(36).substr(2, 9);
      return { ...w, id: newId };
    });

    const clonedItems = (source.items || []).map(item => {
      const newId = "f_" + Math.random().toString(36).substr(2, 9);
      let newWallId = item.wallId;
      if (item.wallId) {
        const wallIdx = source.walls.findIndex(w => w.id === item.wallId);
        if (wallIdx !== -1) {
          newWallId = clonedWalls[wallIdx].id;
        }
      }
      return { ...item, id: newId, wallId: newWallId };
    });

    const newFloor = {
      id: "floor_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name: source.name + " Copy",
      walls: clonedWalls,
      items: clonedItems,
      camera: { ...source.camera },
      undoStack: [],
      redoStack: [],
      settings: { ...source.settings }
    };

    const idx = this.floors.findIndex(f => f.id === floorId);
    this.floors.splice(idx + 1, 0, newFloor);

    this.currentFloorId = newFloor.id;
    this.loadFloor(newFloor.id);
    this.showToast(`Duplicated floor to ${newFloor.name}`);
    projects.saveCurrentToStorage();
  },

  renameFloor: function(floorId) {
    const floor = this.floors.find(f => f.id === floorId);
    if (!floor) return;
    const name = prompt("Rename Floor:", floor.name);
    if (name && name.trim()) {
      floor.name = name.trim();
      this.updateFloorManagerUI();
      projects.saveCurrentToStorage();
    }
  },

  deleteFloor: function(floorId) {
    if (this.floors.length <= 1) {
      alert("Cannot delete the last remaining floor!");
      return;
    }
    const floor = this.floors.find(f => f.id === floorId);
    if (!floor) return;

    if (confirm(`Delete ${floor.name}? This will erase all walls and items on this floor.`)) {
      this.floors = this.floors.filter(f => f.id !== floorId);
      if (this.currentFloorId === floorId) {
        this.currentFloorId = this.floors[this.floors.length - 1].id;
      }
      this.loadFloor(this.currentFloorId);
      this.showToast(`Deleted floor`);
      projects.saveCurrentToStorage();
    }
  },

  moveFloorUp: function(floorId) {
    const idx = this.floors.findIndex(f => f.id === floorId);
    if (idx === -1 || idx === this.floors.length - 1) return; 
    const temp = this.floors[idx];
    this.floors[idx] = this.floors[idx + 1];
    this.floors[idx + 1] = temp;
    this.updateFloorManagerUI();
    projects.saveCurrentToStorage();
    if (window.threeViewer) threeViewer.needsRebuild = true;
  },

  moveFloorDown: function(floorId) {
    const idx = this.floors.findIndex(f => f.id === floorId);
    if (idx <= 0) return; 
    const temp = this.floors[idx];
    this.floors[idx] = this.floors[idx - 1];
    this.floors[idx - 1] = temp;
    this.updateFloorManagerUI();
    projects.saveCurrentToStorage();
    if (window.threeViewer) threeViewer.needsRebuild = true;
  }
};

window.editor = editor;
