import apiClient from './api/index.js';

/* ==========================================================================
   DOM IQ AI - USER-ISOLATED PROJECTS & DEBOUNCED OPTIMISTIC AUTO-SAVE
   ========================================================================= */

const projects = {
  activeProject: null,
  userProjects: [],
  autoSaveTimer: null,
  savePending: false,
  presets: {
    studio: {
      name: "Modern Studio Flat",
      walls: [
        { id: "w1", x1: -5, y1: -4, x2: 5, y2: -4, thickness: 0.2, height: 2.8 },
        { id: "w2", x1: 5, y1: -4, x2: 5, y2: 4, thickness: 0.2, height: 2.8 },
        { id: "w3", x1: 5, y1: 4, x2: -5, y2: 4, thickness: 0.2, height: 2.8 },
        { id: "w4", x1: -5, y1: 4, x2: -5, y2: -4, thickness: 0.2, height: 2.8 },
        { id: "w5", x1: -5, y1: 1, x2: -1, y2: 1, thickness: 0.15, height: 2.8 },
        { id: "w6", x1: -1, y1: 1, x2: -1, y2: 4, thickness: 0.15, height: 2.8 }
      ],
      items: [
        { id: "d1", type: "door", x: -3, y: -4, w: 0.9, h: 2.1, depth: 0.15, rotation: 0, color: "#a1a1aa", material: "wood" },
        { id: "d2", type: "door", x: -2, y: 1, w: 0.8, h: 2.1, depth: 0.15, rotation: 0, color: "#e4e4e7", material: "wood" },
        { id: "win1", type: "window", x: 2, y: 4, w: 1.5, h: 1.2, depth: 0.15, rotation: 180, color: "#38bdf8", material: "glass" },
        { id: "win2", type: "window", x: 5, y: 0, w: 1.8, h: 1.5, depth: 0.15, rotation: 90, color: "#38bdf8", material: "glass" },
        { id: "f1", type: "bed_double", x: -3, y: 2.5, w: 1.6, h: 2.0, depth: 0.6, rotation: 90, color: "#cbd5e1", material: "fabric" },
        { id: "f2", type: "sofa", x: 2, y: -2, w: 2.1, h: 0.9, depth: 0.8, rotation: 0, color: "#475569", material: "fabric" },
        { id: "f3", type: "table_coffee", x: 2, y: -0.8, w: 0.9, h: 0.6, depth: 0.45, rotation: 0, color: "#78350f", material: "wood" },
        { id: "f4", type: "tv_stand", x: 4.5, y: -2, w: 0.4, h: 1.6, depth: 0.5, rotation: 270, color: "#1e293b", material: "metal" },
        { id: "f5", type: "dining_table", x: 2, y: 2, w: 1.2, h: 0.8, depth: 0.75, rotation: 90, color: "#b45309", material: "wood" },
        { id: "f6", type: "kitchen_island", x: -3, y: -2, w: 0.8, h: 1.8, depth: 0.9, rotation: 0, color: "#f1f5f9", material: "marble" },
        { id: "f7", type: "plant", x: 4.2, y: 3.2, w: 0.6, h: 0.6, depth: 1.4, rotation: 0, color: "#10b981", material: "fabric" }
      ],
      settings: { units: "meters", wallHeight: 2.8, wallThickness: 20, gridSnap: 10 }
    },
    loft: {
      name: "Nordic Open Loft",
      walls: [
        { id: "w1", x1: -6, y1: -5, x2: 6, y2: -5, thickness: 0.25, height: 3.2 },
        { id: "w2", x1: 6, y1: -5, x2: 6, y2: 5, thickness: 0.25, height: 3.2 },
        { id: "w3", x1: 6, y1: 5, x2: -6, y2: 5, thickness: 0.25, height: 3.2 },
        { id: "w4", x1: -6, y1: 5, x2: -6, y2: -5, thickness: 0.25, height: 3.2 }
      ],
      items: [
        { id: "d1", type: "door", x: 0, y: -5, w: 1.0, h: 2.4, depth: 0.2, rotation: 0, color: "#27272a", material: "metal" },
        { id: "win1", type: "window", x: -4, y: 5, w: 2.2, h: 2.0, depth: 0.2, rotation: 180, color: "#e0f2fe", material: "glass" },
        { id: "win2", type: "window", x: 4, y: 5, w: 2.2, h: 2.0, depth: 0.2, rotation: 180, color: "#e0f2fe", material: "glass" },
        { id: "f1", type: "sofa", x: -2, y: 2, w: 2.4, h: 1.0, depth: 0.8, rotation: 180, color: "#e2e8f0", material: "fabric" },
        { id: "f2", type: "chair", x: 1, y: 2.5, w: 0.85, h: 0.85, depth: 0.75, rotation: 150, color: "#f8fafc", material: "wood" },
        { id: "f3", type: "table_coffee", x: -0.5, y: 1.2, w: 1.0, h: 1.0, depth: 0.4, rotation: 45, color: "#f5f5f4", material: "wood" },
        { id: "f4", type: "dining_table", x: -3.5, y: -2.5, w: 1.6, h: 0.9, depth: 0.75, rotation: 0, color: "#d6d3d1", material: "wood" },
        { id: "f5", type: "wardrobe", x: 4.5, y: -3, w: 0.6, h: 2.0, depth: 2.2, rotation: 90, color: "#1c1917", material: "wood" },
        { id: "f6", type: "bed_double", x: 4, y: 2.5, w: 1.8, h: 2.1, depth: 0.65, rotation: 270, color: "#cbd5e1", material: "fabric" },
        { id: "f7", type: "plant", x: -5.2, y: 4.2, w: 0.6, h: 0.6, depth: 1.8, rotation: 0, color: "#14b8a6", material: "fabric" }
      ],
      settings: { units: "meters", wallHeight: 3.2, wallThickness: 25, gridSnap: 10 }
    },
    villa: {
      name: "Minimalist Luxury Villa",
      walls: [
        { id: "w1", x1: -8, y1: -6, x2: 8, y2: -6, thickness: 0.25, height: 3.0 },
        { id: "w2", x1: 8, y1: -6, x2: 8, y2: 6, thickness: 0.25, height: 3.0 },
        { id: "w3", x1: 8, y1: 6, x2: -8, y2: 6, thickness: 0.25, height: 3.0 },
        { id: "w4", x1: -8, y1: 6, x2: -8, y2: -6, thickness: 0.25, height: 3.0 },
        { id: "w5", x1: 0, y1: -6, x2: 0, y2: 1, thickness: 0.2, height: 3.0 },
        { id: "w6", x1: 0, y1: 1, x2: 8, y2: 1, thickness: 0.2, height: 3.0 }
      ],
      items: [
        { id: "d1", type: "door", x: -4, y: -6, w: 1.2, h: 2.6, depth: 0.25, rotation: 0, color: "#18181b", material: "metal" },
        { id: "d2", type: "door", x: 4, y: 1, w: 0.9, h: 2.2, depth: 0.2, rotation: 0, color: "#f4f4f5", material: "wood" },
        { id: "win1", type: "window", x: -8, y: 0, w: 3.0, h: 2.2, depth: 0.25, rotation: 270, color: "#bae6fd", material: "glass" },
        { id: "win2", type: "window", x: 8, y: 3.5, w: 2.5, h: 2.2, depth: 0.25, rotation: 90, color: "#bae6fd", material: "glass" },
        { id: "f1", type: "sofa", x: -4, y: 3, w: 2.6, h: 1.1, depth: 0.85, rotation: 180, color: "#ffffff", material: "fabric" },
        { id: "f2", type: "table_coffee", x: -4, y: 1.2, w: 1.2, h: 1.2, depth: 0.35, rotation: 0, color: "#18181b", material: "marble" },
        { id: "f3", type: "bed_double", x: 4, y: 3.5, w: 2.0, h: 2.2, depth: 0.7, rotation: 270, color: "#e4e4e7", material: "fabric" },
        { id: "f4", type: "nightstand", x: 3, y: 4.8, w: 0.5, h: 0.5, depth: 0.5, rotation: 0, color: "#27272a", material: "wood" },
        { id: "f5", type: "nightstand", x: 5, y: 4.8, w: 0.5, h: 0.5, depth: 0.5, rotation: 0, color: "#27272a", material: "wood" }
      ],
      settings: { units: "meters", wallHeight: 3.0, wallThickness: 25, gridSnap: 10 }
    }
  },

  init: function() {
    this.loadUserProjects();
    
    // Auto-save on page exit
    window.addEventListener("beforeunload", () => {
      if (this.savePending) {
        this.saveCurrentToBackend(true);
      }
    });
  },

  loadUserProjects: async function() {
    if (!auth.currentUser) {
      this.userProjects = [];
      this.refreshGrid();
      return;
    }

    try {
      const data = await apiClient.get('/api/projects');
      if (data && data.success) {
        this.userProjects = data.projects;
        this.refreshGrid();
        return;
      }
    } catch (err) {
      console.warn('Failed to load user projects from backend:', err.message);
    }
    this.refreshGrid();
  },

  refreshGrid: function() {
    const grid = document.getElementById("recent-projects-grid");
    if (!grid) return;
    
    grid.innerHTML = "";

    if (!auth.currentUser) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--text-muted);">
          <p>Please sign in to access your saved workspace projects.</p>
          <button class="btn btn-primary btn-glow" style="margin-top: 12px;" onclick="auth.openModal('login')">Sign In Now</button>
        </div>
      `;
      return;
    }

    if (this.userProjects.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--text-muted);">
          <p>No projects found in your isolated workspace.</p>
        </div>
      `;
      return;
    }
    
    this.userProjects.forEach(p => {
      const card = document.createElement("div");
      card.className = "project-card glass";
      
      card.innerHTML = `
        <div class="project-avatar-icon" onclick="projects.load('${p.id}')">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </div>
        <div class="project-details" onclick="projects.load('${p.id}')">
          <div class="project-name">${p.name}</div>
          <div class="project-meta">Last saved: ${this.formatTime(p.lastSaved || p.updatedAt)}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button class="project-delete-btn" onclick="projects.delete('${p.id}')" title="Move to Trash" style="margin-left: 0;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      `;
      
      grid.appendChild(card);
    });
  },

  formatTime: function(timestamp) {
    if (!timestamp) return 'Just now';
    const d = new Date(timestamp);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  createNewBlank: async function() {
    if (!auth.currentUser) {
      auth.openModal('login');
      return;
    }

    const newProject = {
      name: "Blank Project Suite",
      walls: [],
      items: [],
      settings: { units: "meters", wallHeight: 2.8, wallThickness: 20, gridSnap: 10 }
    };
    
    await this.saveNewProjectToBackend(newProject);
  },

  createFromTemplate: async function(presetKey) {
    if (!auth.currentUser) {
      auth.openModal('login');
      return;
    }

    const preset = this.presets[presetKey];
    if (!preset) return;
    
    const newProject = JSON.parse(JSON.stringify(preset));
    newProject.name = "My " + preset.name;
    newProject.template = presetKey;
    
    await this.saveNewProjectToBackend(newProject);
  },
  saveNewProjectToBackend: async function(projectObj) {
    try {
      const resData = await apiClient.post('/api/projects', {
        name: projectObj.name,
        template: projectObj.template || null,
        data: projectObj
      });

      if (resData && resData.success) {
        await this.loadUserProjects();
        this.load(resData.projectId);
        return;
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  },

  load: async function(id) {
    if (!auth.currentUser) {
      auth.openModal('login');
      return;
    }

    try {
      const resData = await apiClient.get(`/api/projects/${id}`);
      if (resData && resData.success && resData.project) {
        this.activeProject = resData.project;
          
          const nameInput = document.getElementById("project-name-input");
          if (nameInput) nameInput.value = this.activeProject.name;
          
          if (window.editor) {
            editor.loadProjectData(this.activeProject);
          }
          if (window.threeViewer) {
            threeViewer.needsRebuild = true;
          }
          
          app.openStudio();
          return;
      }
    } catch (err) {
      console.error('Failed to load project from backend:', err);
    }
  },

  /**
   * Schedule debounced auto-save (3 seconds after last modification)
   */
  triggerAutoSave: function() {
    this.savePending = true;
    this.updateSaveIndicator("Saving...", "rgba(59, 130, 246, 0.15)", "var(--accent-blue)");

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = setTimeout(() => {
      this.saveCurrentToBackend();
    }, 3000);
  },

  saveCurrentName: function(newName) {
    if (!this.activeProject) return;
    this.activeProject.name = newName;
    this.triggerAutoSave();
  },

  saveCurrentToBackend: async function(isSync = false) {
    if (!this.activeProject || !auth.currentUser) return;
    
    // Sync current values from editor state
    if (window.editor) {
      if (editor.syncCurrentFloorState) {
        editor.syncCurrentFloorState();
      }
      this.activeProject.floors = editor.floors;
      this.activeProject.roomRegistry = editor.roomRegistry || [];
      this.activeProject.walls = editor.walls;
      this.activeProject.items = editor.items;
      this.activeProject.settings = {
        units: editor.settings.units,
        wallHeight: editor.settings.wallHeight,
        wallThickness: Math.round(editor.settings.wallThickness * 100),
        gridSnap: Math.round(editor.settings.gridSnap * 100),
        materials: editor.settings.materials
      };
    }

    this.savePending = false;
    this.updateSaveIndicator("Saving...", "rgba(59, 130, 246, 0.15)", "var(--accent-blue)");

    try {
      await apiClient.post('/api/projects', {
        id: this.activeProject.id,
        name: this.activeProject.name,
        template: this.activeProject.template,
        lastSaved: Date.now(),
        data: this.activeProject
      });

      this.updateSaveIndicator("✓ Saved", "rgba(20, 184, 166, 0.15)", "var(--accent-teal)");
    } catch (err) {
      console.error('Auto-save failed:', err.message);
      this.updateSaveIndicator("⚠ Save Failed (Retry)", "rgba(239, 68, 68, 0.2)", "#fca5a5");
    }
  },

  updateSaveIndicator: function(text, bg, color) {
    const indicator = document.querySelector(".save-status-indicator");
    if (indicator) {
      indicator.textContent = text;
      indicator.style.background = bg;
      indicator.style.color = color;
      indicator.onclick = text.includes("Retry") ? () => this.saveCurrentToBackend() : null;
    }
  },

  delete: async function(id) {
    if (!confirm("Move project to trash? You can recover soft-deleted items later.")) return;

    try {
      await apiClient.delete(`/api/projects/${id}`);
      await this.loadUserProjects();
    } catch (err) {
      console.error('Delete project error:', err);
    }
  },

  /**
   * Project Version History Modal
   */
  openVersionHistory: async function() {
    if (!this.activeProject) return;
    try {
      const [vData, sData] = await Promise.all([
        apiClient.get(`/api/projects/${this.activeProject.id}/versions`),
        apiClient.get(`/api/projects/${this.activeProject.id}/snapshots`)
      ]);
      
      const versions = vData && vData.success ? (vData.versions || []) : [];
      const snapshots = sData && sData.success ? (sData.snapshots || []) : [];
      
      this.snapshots = snapshots;
      this.versions = versions;
      
      this.renderVersionsModal();
    } catch (err) {
      console.error('Open version history and snapshots error:', err);
    }
  },

  renderVersionsModal: function() {
    let modal = document.getElementById("versions-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "versions-modal";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content glass" style="max-width: 600px; width: 90%; max-height: 85vh; display: flex; flex-direction: column; padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: rgba(10, 10, 10, 0.9); backdrop-filter: blur(20px); box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
        <div class="modal-header" style="flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; color: #fff;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Project Snapshots & Versions
          </h3>
          <button class="modal-close" onclick="document.getElementById('versions-modal').classList.remove('active')" style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        
        <!-- Tabs Navigation -->
        <div class="modal-tabs" style="display: flex; gap: 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; margin-bottom: 16px;">
          <button id="tab-snapshots-btn" class="tab-btn active" onclick="projects.switchVersionsTab('snapshots')" style="background: none; border: none; padding: 8px 4px; color: #fff; font-weight: 600; cursor: pointer; border-bottom: 2px solid var(--accent-blue); font-size: 0.85rem; display: flex; align-items: center; gap: 6px; outline: none;">
            📸 Snapshots
          </button>
          <button id="tab-versions-btn" class="tab-btn" onclick="projects.switchVersionsTab('versions')" style="background: none; border: none; padding: 8px 4px; color: var(--text-muted); font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; outline: none;">
            🕒 Version History
          </button>
        </div>

        <!-- Tab Contents -->
        <div class="modal-tab-content" style="flex-grow: 1; overflow: hidden; display: flex; flex-direction: column;">
          
          <!-- Left Tab: Snapshots -->
          <div id="tab-snapshots-content" class="tab-pane active" style="display: flex; flex-direction: column; gap: 14px; height: 100%; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-shrink: 0;">
              <span style="font-size: 0.8rem; color: var(--text-muted);">Create visual snapshots of your current layouts:</span>
              <button class="btn btn-primary btn-sm" onclick="projects.createSnapshot()" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.8rem;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Create Snapshot
              </button>
            </div>

            <!-- Snapshots Grid -->
            <div id="snapshots-list-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; overflow-y: auto; flex-grow: 1; padding-bottom: 8px; max-height: 380px;">
              <!-- Loaded dynamically -->
            </div>
          </div>

          <!-- Right Tab: Version History -->
          <div id="tab-versions-content" class="tab-pane" style="display: none; flex-direction: column; gap: 12px; overflow-y: auto; max-height: 420px; width: 100%;">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 8px 0;">Restore previous auto-saved snapshots from your design session:</p>
            <div id="versions-list-container" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
              <!-- Loaded dynamically -->
            </div>
          </div>

        </div>
      </div>
    `;
    modal.classList.add("active");
    
    this.activeTab = 'snapshots';
    this.updateSnapshotsListUI();
    this.updateVersionsListUI();
  },

  switchVersionsTab: function(tabName) {
    this.activeTab = tabName;
    
    const snapshotsBtn = document.getElementById("tab-snapshots-btn");
    const versionsBtn = document.getElementById("tab-versions-btn");
    const snapshotsContent = document.getElementById("tab-snapshots-content");
    const versionsContent = document.getElementById("tab-versions-content");
    
    if (!snapshotsBtn || !versionsBtn || !snapshotsContent || !versionsContent) return;

    if (tabName === 'snapshots') {
      snapshotsBtn.classList.add("active");
      snapshotsBtn.style.color = "#fff";
      snapshotsBtn.style.borderBottomColor = "var(--accent-blue)";
      
      versionsBtn.classList.remove("active");
      versionsBtn.style.color = "var(--text-muted)";
      versionsBtn.style.borderBottomColor = "transparent";
      
      snapshotsContent.style.display = "flex";
      versionsContent.style.display = "none";
    } else {
      versionsBtn.classList.add("active");
      versionsBtn.style.color = "#fff";
      versionsBtn.style.borderBottomColor = "var(--accent-blue)";
      
      snapshotsBtn.classList.remove("active");
      snapshotsBtn.style.color = "var(--text-muted)";
      snapshotsBtn.style.borderBottomColor = "transparent";
      
      snapshotsContent.style.display = "none";
      versionsContent.style.display = "flex";
    }
  },

  updateSnapshotsListUI: function() {
    const container = document.getElementById("snapshots-list-container");
    if (!container) return;
    
    if (!this.snapshots || this.snapshots.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: var(--text-muted); text-align: center; border: 1px dashed var(--border-color); border-radius: var(--radius-md); background: rgba(255,255,255,0.01);">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 10px; opacity: 0.5;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style="font-size: 0.85rem; font-weight: 550; color: #fff; margin-bottom: 4px;">No Snapshots Yet</span>
          <span style="font-size: 0.75rem;">Create snapshots to preserve different design iterations.</span>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.snapshots.map(s => `
      <div class="snapshot-card glass" style="display: flex; flex-direction: column; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: rgba(255,255,255,0.02); transition: all 0.2s ease;">
        
        <!-- Thumbnail -->
        <div style="width: 100%; height: 120px; background: #121212; border-radius: var(--radius-sm); border: 1px solid var(--border-color); overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; margin-bottom: 10px;">
          <img src="${s.thumbnail || ''}" style="max-width: 100%; max-height: 100%; object-fit: contain; opacity: 0.85;" />
          <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.7); padding: 2px 6px; border-radius: var(--radius-sm); font-size: 0.65rem; color: #fff; font-weight: 500; border: 1px solid rgba(255,255,255,0.1);">
            ${s.floor_name}
          </div>
        </div>

        <!-- Meta Info -->
        <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; margin-bottom: 12px;">
          <input type="text" class="snapshot-name-input" value="${s.name}" 
                 onchange="projects.renameSnapshot('${s.id}', this.value)" 
                 style="background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm); color: #fff; font-weight: 600; font-size: 0.85rem; width: 100%; padding: 2px 4px; margin-left: -4px; outline: none; transition: border-color 0.2s;" 
                 onfocus="this.style.borderColor='var(--border-color)'; this.style.background='rgba(0,0,0,0.3)';" 
                 onblur="this.style.borderColor='transparent'; this.style.background='transparent';" 
                 onkeydown="if(event.key==='Enter') this.blur()" />
          <span style="font-size: 0.7rem; color: var(--text-muted); padding-left: 4px;">
            ${projects.formatTime(s.created_at)}
          </span>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 6px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="projects.restoreSnapshot('${s.id}')" style="flex-grow: 1; font-size: 0.75rem; padding: 4px 8px; font-weight: 600;">Restore</button>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-secondary btn-sm" onclick="projects.duplicateSnapshot('${s.id}')" title="Duplicate" style="padding: 4px 8px;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="projects.deleteSnapshot('${s.id}')" title="Delete" style="padding: 4px 8px; color: #fca5a5;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </div>

      </div>
    `).join("");
  },

  updateVersionsListUI: function() {
    const container = document.getElementById("versions-list-container");
    if (!container) return;
    
    if (!this.versions || this.versions.length === 0) {
      container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 20px 0;">No snapshots found.</p>`;
      return;
    }
    
    container.innerHTML = this.versions.map(v => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 8px; width: 100%;">
        <div>
          <div style="font-size: 0.85rem; font-weight: 600; color: #fff;">Snapshot Version</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(v.created_at).toLocaleString()}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="projects.restoreVersion('${v.id}')">Restore</button>
      </div>
    `).join("");
  },

  createSnapshot: async function() {
    if (!this.activeProject) return;
    
    const canvas = document.getElementById("floor-planner-canvas");
    let thumbnail = "";
    if (canvas) {
      thumbnail = canvas.toDataURL("image/jpeg", 0.7);
    }
    
    let floorName = "Ground Floor";
    if (window.editor && editor.floors && editor.currentFloorId) {
      const floor = editor.floors.find(f => f.id === editor.currentFloorId);
      if (floor) floorName = floor.name;
    }
    
    const count = this.snapshots ? this.snapshots.length : 0;
    const name = `Snapshot ${count + 1}`;
    
    if (window.editor && editor.syncCurrentFloorState) {
      editor.syncCurrentFloorState();
    }
    
    const snapshotData = {
      floors: editor.floors,
      roomRegistry: editor.roomRegistry || [],
      walls: editor.walls,
      items: editor.items,
      settings: {
        units: editor.settings.units,
        wallHeight: editor.settings.wallHeight,
        wallThickness: Math.round(editor.settings.wallThickness * 100),
        gridSnap: Math.round(editor.settings.gridSnap * 100),
        materials: editor.settings.materials
      }
    };
    
    try {
      const resData = await apiClient.post(`/api/projects/${this.activeProject.id}/snapshots`, {
        name: name,
        snapshot: JSON.stringify(snapshotData),
        thumbnail: thumbnail,
        floorName: floorName
      });
      
      if (resData && resData.success) {
        const sData = await apiClient.get(`/api/projects/${this.activeProject.id}/snapshots`);
        if (sData && sData.success) {
          this.snapshots = sData.snapshots || [];
        }
        this.updateSnapshotsListUI();
        if (window.editor) editor.showToast('✓ Snapshot created successfully!');
      }
    } catch (err) {
      console.error('Create snapshot error:', err);
    }
  },

  renameSnapshot: async function(snapshotId, newName) {
    if (!this.activeProject) return;
    try {
      await apiClient.put(`/api/projects/${this.activeProject.id}/snapshots/${snapshotId}`, {
        name: newName
      });
      const snap = this.snapshots.find(s => s.id === snapshotId);
      if (snap) snap.name = newName;
      this.updateSnapshotsListUI();
      if (window.editor) editor.showToast('✓ Snapshot renamed!');
    } catch (err) {
      console.error('Rename snapshot error:', err);
    }
  },

  duplicateSnapshot: async function(snapshotId) {
    if (!this.activeProject) return;
    try {
      const resData = await apiClient.post(`/api/projects/${this.activeProject.id}/snapshots/${snapshotId}/duplicate`);
      if (resData && resData.success) {
        const sData = await apiClient.get(`/api/projects/${this.activeProject.id}/snapshots`);
        if (sData && sData.success) {
          this.snapshots = sData.snapshots || [];
        }
        this.updateSnapshotsListUI();
        if (window.editor) editor.showToast('✓ Snapshot duplicated!');
      }
    } catch (err) {
      console.error('Duplicate snapshot error:', err);
    }
  },

  deleteSnapshot: async function(snapshotId) {
    if (!this.activeProject) return;
    if (!confirm('Are you sure you want to delete this snapshot?')) return;
    try {
      await apiClient.delete(`/api/projects/${this.activeProject.id}/snapshots/${snapshotId}`);
      this.snapshots = this.snapshots.filter(s => s.id !== snapshotId);
      this.updateSnapshotsListUI();
      if (window.editor) editor.showToast('✓ Snapshot deleted!');
    } catch (err) {
      console.error('Delete snapshot error:', err);
    }
  },

  restoreSnapshot: async function(snapshotId) {
    if (!this.activeProject) return;
    try {
      await apiClient.post(`/api/projects/${this.activeProject.id}/snapshots/${snapshotId}/restore`);
      document.getElementById('versions-modal').classList.remove('active');
      await this.load(this.activeProject.id);
      if (window.editor) editor.showToast('✓ Project restored to selected snapshot layout!');
    } catch (err) {
      console.error('Restore snapshot error:', err);
    }
  },

  restoreVersion: async function(versionId) {
    if (!this.activeProject) return;
    try {
      await apiClient.post(`/api/projects/${this.activeProject.id}/restore/${versionId}`);
      document.getElementById('versions-modal').classList.remove('active');
      await this.load(this.activeProject.id);
      if (window.editor) editor.showToast('✓ Project restored to selected version snapshot!');
    } catch (err) {
      console.error('Restore version error:', err);
    }
  }
};

window.projects = projects;
