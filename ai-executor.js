/**
 * ai-executor.js
 * Executes layout operations recommended by the AI Assistant on the 2D/3D editor.
 * Reuses the existing editor state management and APIs.
 */

window.aiExecutor = {
  applyActions: function(rec, isPreview) {
    if (!rec) return;

    console.log("Applying AI Actions (isPreview=" + isPreview + "):", rec);

    // Save state to undo before applying batch actions (only for actual commits)
    if (!isPreview && window.editor && typeof editor.pushStateToUndo === 'function') {
      editor.pushStateToUndo();
    }

    // 1. Process structured general actions
    if (rec.actions && Array.isArray(rec.actions)) {
      rec.actions.forEach(action => {
        try {
          this.executeSingleAction(action, isPreview);
        } catch (e) {
          console.error("AI Executor: Failed to execute action:", action, e);
        }
      });
    }

    // 2. Process legacy format add/move/remove if supplied by AI
    if (rec.furnitureToAdd && Array.isArray(rec.furnitureToAdd)) {
      rec.furnitureToAdd.forEach(f => {
        this.executeSingleAction({
          action: "add",
          targetType: "furniture",
          type: f.type,
          x: f.x,
          y: f.y,
          rotation: f.rotation,
          color: f.color,
          material: f.material
        }, isPreview);
      });
    }

    if (rec.furnitureToMove && Array.isArray(rec.furnitureToMove)) {
      rec.furnitureToMove.forEach(f => {
        this.executeSingleAction({
          action: "move",
          targetId: f.targetId,
          x: f.x,
          y: f.y,
          rotation: f.rotation
        }, isPreview);
      });
    }

    if (rec.furnitureToRemove && Array.isArray(rec.furnitureToRemove)) {
      rec.furnitureToRemove.forEach(f => {
        this.executeSingleAction({
          action: "delete",
          targetId: f.targetId
        }, isPreview);
      });
    }

    // 3. Process structural changes (walls, doors, windows) from legacy formats
    if (rec.wallsToAdd && Array.isArray(rec.wallsToAdd)) {
      rec.wallsToAdd.forEach(w => {
        this.executeSingleAction({
          action: "add",
          targetType: "wall",
          x1: w.x1,
          y1: w.y1,
          x2: w.x2,
          y2: w.y2,
          thickness: w.thickness,
          height: w.height
        }, isPreview);
      });
    }

    if (rec.wallsToRemove && Array.isArray(rec.wallsToRemove)) {
      rec.wallsToRemove.forEach(w => {
        this.executeSingleAction({
          action: "delete",
          targetId: w.targetId || w.id
        }, isPreview);
      });
    }

    if (rec.materials) {
      Object.keys(rec.materials).forEach(key => {
        this.executeSingleAction({
          action: "change_material",
          targetType: "global",
          targetId: key,
          value: rec.materials[key]
        }, isPreview);
      });
    }

    if (rec.lighting) {
      this.executeSingleAction({
        action: "change_lighting",
        ambient: rec.lighting.ambient,
        daylight: rec.lighting.daylight
      }, isPreview);
    }

    // Trigger updates
    if (window.editor) {
      editor.draw();
      editor.updateInspector();
    }
    if (window.threeViewer) {
      threeViewer.updateStyleMaterials();
      threeViewer.needsRebuild = true;
    }
  },

  executeSingleAction: function(act, isPreview) {
    if (!act || !act.action) return;

    let target = null;
    if (act.targetId) {
      target = editor.items.find(it => it.id === act.targetId) || editor.walls.find(w => w.id === act.targetId);
    }

    switch (act.action.toLowerCase()) {
      case "add":
      case "create": {
        const type = act.targetType || act.type;
        if (type === "door" || type === "window") {
          const pt = { x: act.x || 0, y: act.y || 0 };
          editor.insertWallAttachment(type, pt);
          const newItem = editor.selectedItem;
          if (newItem) {
            if (act.w !== undefined) newItem.w = act.w;
            if (act.h !== undefined) newItem.h = act.h;
            if (isPreview) newItem.isAiPreview = true;
          }
        } else if (type === "wall") {
          const newWall = {
            id: "w_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            x1: act.x1 || 0,
            y1: act.y1 || 0,
            x2: act.x2 || 0,
            y2: act.y2 || 0,
            thickness: act.thickness || editor.settings.wallThickness,
            height: act.height || editor.settings.wallHeight
          };
          if (isPreview) newWall.isAiPreview = true;
          editor.walls.push(newWall);
        } else {
          // General furniture from library
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
            id: "f_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            type: type,
            x: act.x !== undefined ? act.x : 0,
            y: act.y !== undefined ? act.y : 0,
            w: act.w || specs.w,
            h: act.h || specs.h,
            depth: act.depth || specs.depth,
            rotation: act.rotation || 0,
            color: act.color || specs.color,
            material: act.material || specs.material
          };
          if (isPreview) newItem.isAiPreview = true;
          editor.items.push(newItem);
          editor.selectedItem = newItem;
        }
        break;
      }
      case "delete":
      case "remove": {
        if (target) {
          editor.selectedItem = target;
          editor.deleteSelectedItem();
        }
        break;
      }
      case "move": {
        if (target) {
          editor.selectedItem = target;
          if (target.x1 !== undefined) {
            if (act.x1 !== undefined) editor.applyPropertyChange('x1', act.x1);
            if (act.y1 !== undefined) editor.applyPropertyChange('y1', act.y1);
            if (act.x2 !== undefined) editor.applyPropertyChange('x2', act.x2);
            if (act.y2 !== undefined) editor.applyPropertyChange('y2', act.y2);
          } else {
            if (act.x !== undefined) editor.applyPropertyChange('x', act.x);
            if (act.y !== undefined) editor.applyPropertyChange('y', act.y);
          }
          if (isPreview) target.isAiPreview = true;
        }
        break;
      }
      case "rotate": {
        if (target && target.rotation !== undefined) {
          editor.selectedItem = target;
          editor.applyPropertyChange('rotation', act.rotation);
          if (isPreview) target.isAiPreview = true;
        }
        break;
      }
      case "resize":
      case "scale": {
        if (target) {
          editor.selectedItem = target;
          if (act.w !== undefined) editor.applyPropertyChange('w', act.w);
          if (act.h !== undefined) editor.applyPropertyChange('h', act.h);
          if (act.depth !== undefined) editor.applyPropertyChange('depth', act.depth);
          if (isPreview) target.isAiPreview = true;
        }
        break;
      }
      case "duplicate": {
        if (target) {
          editor.selectedItem = target;
          editor.duplicateSelectedItem();
          const copy = editor.selectedItem;
          if (copy && isPreview) copy.isAiPreview = true;
        }
        break;
      }
      case "replace": {
        if (target) {
          editor.selectedItem = target;
          editor.applyPropertyChange('type', act.newType);
          if (act.w !== undefined) editor.applyPropertyChange('w', act.w);
          if (act.h !== undefined) editor.applyPropertyChange('h', act.h);
          if (act.depth !== undefined) editor.applyPropertyChange('depth', act.depth);
          if (isPreview) target.isAiPreview = true;
        }
        break;
      }
      case "rename": {
        if (target) {
          editor.selectedItem = target;
          editor.applyPropertyChange('name', act.name);
        }
        break;
      }
      case "lock": {
        if (target) {
          editor.selectedItem = target;
          editor.applyPropertyChange('locked', true);
        }
        break;
      }
      case "unlock": {
        if (target) {
          editor.selectedItem = target;
          editor.applyPropertyChange('locked', false);
        }
        break;
      }
      case "hide": {
        if (target) {
          target.hidden = true;
        }
        break;
      }
      case "show": {
        if (target) {
          target.hidden = false;
        }
        break;
      }
      case "change_material":
      case "change_color":
      case "change_texture":
      case "change_finish": {
        if (act.targetType === "global" || ["walls", "floors", "doors", "ceiling"].includes(act.targetId)) {
          if (!editor.settings.materials) editor.settings.materials = {};
          const key = act.targetId === "floors" ? "floors" : (act.targetId === "walls" ? "walls" : (act.targetId === "doors" ? "doors" : "ceiling"));
          editor.settings.materials[key] = act.value;
          const dropdown = document.getElementById("material-" + key);
          if (dropdown) dropdown.value = act.value;
        } else if (target) {
          editor.selectedItem = target;
          if (act.value) {
            if (act.value.startsWith("#")) {
              editor.applyPropertyChange('color', act.value);
            } else {
              editor.applyPropertyChange('material', act.value);
            }
          }
        }
        break;
      }
      case "change_lighting": {
        if (editor.settings) {
          if (!editor.settings.lighting) editor.settings.lighting = {};
          if (act.ambient !== undefined) editor.settings.lighting.ambient = act.ambient;
          if (act.daylight !== undefined) editor.settings.lighting.daylight = act.daylight;
        }
        break;
      }
      case "split_wall": {
        const wall = editor.walls.find(w => w.id === act.targetId);
        if (wall) {
          const mx = (wall.x1 + wall.x2) / 2;
          const my = (wall.y1 + wall.y2) / 2;
          const wall1 = {
            id: "w_split1_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            x1: wall.x1, y1: wall.y1, x2: mx, y2: my,
            thickness: wall.thickness, height: wall.height
          };
          const wall2 = {
            id: "w_split2_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            x1: mx, y1: my, x2: wall.x2, y2: wall.y2,
            thickness: wall.thickness, height: wall.height
          };
          editor.walls = editor.walls.filter(w => w.id !== wall.id);
          editor.walls.push(wall1, wall2);
        }
        break;
      }
      case "merge_walls": {
        const w1 = editor.walls.find(w => w.id === act.targetId1 || w.id === act.targetId);
        const w2 = editor.walls.find(w => w.id === act.targetId2);
        if (w1 && w2) {
          const merged = {
            id: "w_merged_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            x1: w1.x1, y1: w1.y1, x2: w2.x2, y2: w2.y2,
            thickness: w1.thickness, height: w1.height
          };
          editor.walls = editor.walls.filter(w => w.id !== w1.id && w.id !== w2.id);
          editor.walls.push(merged);
        }
        break;
      }
      default:
        console.warn("Unknown action type:", act.action);
    }
  }
};
