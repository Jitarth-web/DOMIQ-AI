/* ==========================================================================
   DOM IQ AI - UPGRADED THREE.JS 3D ENGINE & LIGHTING CONTROLLER
   ========================================================================== */

const threeViewer = {
  container: null,
  scene: null,
  camera: null,
  renderer: null,
  orbitControls: null,
  needsRebuild: true,
  
  // Lighting
  dirLight: null,
  ambientLight: null,
  hemiLight: null,
  fillLight: null,
  isNight: false,
  
  // FPV walkthrough state
  cameraMode: "orbit", // orbit or firstperson
  moveState: { forward: 0, backward: 0, left: 0, right: 0 },
  playerVelocity: { x: 0, z: 0 },
  playerHeight: 1.6, // eyes elevation in meters
  camYaw: 0,
  camPitch: 0,
  
  // Storage for rendered meshes
  wallMeshes: [],
  itemMeshes: [],
  floorMeshes: [],
  ceilingMeshes: [],
  ceilingEnabled: false,
  
  // Procedural texture cache
  textures: {},
  
  // Design system materials (updated by style selection)
  materials: {
    wall: null,
    floor: null,
    glass: null,
    wood: null,
    marble: null,
    metal: null,
    fabric: null,
    water: null,
    foliage: null,
    ceiling: null
  },

  init: function() {
    this.container = document.getElementById("threejs-container");
    if (!this.container) return;
    
    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#0a0b0d");
    this.scene.fog = new THREE.FogExp2("#0a0b0d", 0.02);
    
    // 2. Camera Setup (Near plane set to 0.05 to prevent clipping inside rooms)
    const initWidth = Math.max(this.container.clientWidth, 1);
    const initHeight = Math.max(this.container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(60, initWidth / initHeight, 0.05, 1000);
    this.camera.position.set(12, 10, 15);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(initWidth, initHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    this.container.appendChild(this.renderer.domElement);
    
    // 4. Orbit Controls
    this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera slightly above floor
    this.orbitControls.minDistance = 1.0;
    this.orbitControls.maxDistance = 60.0;
    
    // 5. Lighting setups
    this.setupLighting();
    
    // 6. Materials initialization
    this.updateStyleMaterials("modern");
    
    // 7. Bind resize events
    window.addEventListener("resize", () => this.resize());

    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(this.container);
    }

    // FPV input binding
    this.setupFPVInput();
    
    // Start drawing loop
    this.animate();
  },

  setupLighting: function() {
    // Hemisphere lighting (simulates sky dome light)
    this.hemiLight = new THREE.HemisphereLight("#f1f5f9", "#334155", 0.4);
    this.scene.add(this.hemiLight);

    // Soft Ambient lighting
    this.ambientLight = new THREE.AmbientLight("#ffffff", 0.25);
    this.scene.add(this.hemiLight); // Add hemi light to make sure it's present
    this.scene.add(this.ambientLight);
    
    // Key Sun light with shadows
    this.dirLight = new THREE.DirectionalLight("#fffaf0", 1.1);
    this.dirLight.position.set(20, 30, 15);
    this.dirLight.castShadow = true;
    
    // High quality soft shadow maps
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 100;
    const shadowSize = 25;
    this.dirLight.shadow.camera.left = -shadowSize;
    this.dirLight.shadow.camera.right = shadowSize;
    this.dirLight.shadow.camera.top = shadowSize;
    this.dirLight.shadow.camera.bottom = -shadowSize;
    
    // Biases to completely eliminate shadow acne and z-fighting
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    
    this.scene.add(this.dirLight);
    
    // Cyan bounce light representing sky glow
    this.fillLight = new THREE.DirectionalLight("#cffafe", 0.2);
    this.fillLight.position.set(-20, 15, -15);
    this.scene.add(this.fillLight);
  },

  toggleDayNight: function(isNightMode) {
    this.isNight = isNightMode;
    
    const duration = 800; // Transition duration in ms
    const steps = 24;
    let stepCount = 0;
    
    // Targets
    const targetSunColor = isNightMode ? new THREE.Color("#0c111d") : new THREE.Color("#fffaf0");
    const targetSunIntensity = isNightMode ? 0.05 : 1.1;
    const targetAmbientColor = isNightMode ? new THREE.Color("#0f172a") : new THREE.Color("#ffffff");
    const targetAmbientIntensity = isNightMode ? 0.1 : 0.25;
    const targetHemiColor = isNightMode ? new THREE.Color("#1e1b4b") : new THREE.Color("#f1f5f9");
    const targetBgColor = isNightMode ? new THREE.Color("#020305") : new THREE.Color("#0a0b0d");
    
    const startSunColor = this.dirLight.color.clone();
    const startSunIntensity = this.dirLight.intensity;
    const startAmbientColor = this.ambientLight.color.clone();
    const startAmbientIntensity = this.ambientLight.intensity;
    const startHemiColor = this.hemiLight.color.clone();
    const startBgColor = this.scene.background.clone();
    
    const interval = setInterval(() => {
      stepCount++;
      const t = stepCount / steps;
      
      this.dirLight.color.lerpColors(startSunColor, targetSunColor, t);
      this.dirLight.intensity = THREE.MathUtils.lerp(startSunIntensity, targetSunIntensity, t);
      this.ambientLight.color.lerpColors(startAmbientColor, targetAmbientColor, t);
      this.ambientLight.intensity = THREE.MathUtils.lerp(startAmbientIntensity, targetAmbientIntensity, t);
      this.hemiLight.color.lerpColors(startHemiColor, targetHemiColor, t);
      this.scene.background.lerpColors(startBgColor, targetBgColor, t);
      this.scene.fog.color.copy(this.scene.background);
      
      if (stepCount >= steps) clearInterval(interval);
    }, duration / steps);
  },

  toggleCeiling: function(enabled) {
    this.ceilingEnabled = enabled;
    this.needsRebuild = true;
  },

  // Generates procedurally patterned canvas textures
  createProceduralTexture: function(type) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    
    if (type === "wood") {
      // Wood base planks color
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(0, 0, 512, 512);
      
      // Draw board lines
      ctx.strokeStyle = "#451a03";
      ctx.lineWidth = 4;
      for (let x = 0; x <= 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      
      // Fine grain detail lines
      ctx.strokeStyle = "rgba(69, 26, 3, 0.25)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        const y = Math.random() * 512;
        ctx.moveTo(0, y);
        for (let x = 0; x <= 512; x += 16) {
          const dy = Math.sin(x * 0.05 + y) * 4;
          ctx.lineTo(x, y + dy);
        }
        ctx.stroke();
      }
    } 
    else if (type === "walnut") {
      // Dark walnut wood base planks color
      ctx.fillStyle = "#451a03";
      ctx.fillRect(0, 0, 512, 512);
      
      // Draw board lines
      ctx.strokeStyle = "#1c0d02";
      ctx.lineWidth = 4;
      for (let x = 0; x <= 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      
      // Fine grain detail lines
      ctx.strokeStyle = "rgba(28, 13, 2, 0.25)";
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        const y = Math.random() * 512;
        ctx.moveTo(0, y);
        for (let x = 0; x <= 512; x += 16) {
          const dy = Math.sin(x * 0.04 + y) * 5;
          ctx.lineTo(x, y + dy);
        }
        ctx.stroke();
      }
    } 
    else if (type === "tile") {
      // Tile white base
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, 0, 512, 512);
      
      // Grout divider lines
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 6;
      for (let y = 0; y <= 512; y += 128) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      for (let x = 0; x <= 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
    }
    else if (type === "marble") {
      // White Carrara base
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, 512, 512);
      
      // Soft grey vein patterns
      ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        let x = Math.random() * 512;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 512) {
          x += (Math.random() - 0.5) * 35;
          y += Math.random() * 50 + 15;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    else if (type === "concrete") {
      // Matte grey concrete base
      ctx.fillStyle = "#a8a29e";
      ctx.fillRect(0, 0, 512, 512);
      // noise spots
      for (let i = 0; i < 2000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 1.5;
        ctx.fillStyle = Math.random() > 0.5 ? "#78716c" : "#d6d3d1";
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI*2);
        ctx.fill();
      }
    }
    else if (type === "brick") {
      // Red clay brick pattern
      ctx.fillStyle = "#b91c1c";
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = "#e2e8f0"; // mortar grout
      ctx.lineWidth = 3;
      // horizontal rows
      for (let y = 0; y <= 512; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      // vertical offsets
      let row = 0;
      for (let y = 0; y < 512; y += 32) {
        const offset = (row % 2) * 32;
        for (let x = offset; x <= 512; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 32);
          ctx.stroke();
        }
        row++;
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  },

  updateStyleMaterials: function(styleName) {
    this.textures.wood = this.textures.wood || this.createProceduralTexture("wood");
    this.textures.walnut = this.textures.walnut || this.createProceduralTexture("walnut");
    this.textures.tile = this.textures.tile || this.createProceduralTexture("tile");
    this.textures.marble = this.textures.marble || this.createProceduralTexture("marble");
    this.textures.concrete = this.textures.concrete || this.createProceduralTexture("concrete");
    this.textures.brick = this.textures.brick || this.createProceduralTexture("brick");

    // Default basic physical shaders
    this.materials.glass = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.95,
      ior: 1.5,
      side: THREE.DoubleSide
    });
    
    this.materials.water = new THREE.MeshPhysicalMaterial({
      color: "#0891b2",
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.7,
      transmission: 0.6
    });
    
    this.materials.foliage = new THREE.MeshStandardMaterial({
      color: "#047857",
      roughness: 0.8
    });

    this.materials.ceiling = new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.9,
      side: THREE.DoubleSide
    });
    
    // Check if custom global materials are selected in project settings
    if (window.editor && editor.settings && editor.settings.materials) {
      const m = editor.settings.materials;
      
      // Walls
      if (m.walls === "concrete") {
        this.materials.wall = new THREE.MeshStandardMaterial({ map: this.textures.concrete, roughness: 0.8 });
      } else if (m.walls === "brick") {
        this.materials.wall = new THREE.MeshStandardMaterial({ map: this.textures.brick, roughness: 0.85 });
      } else { // white_paint
        this.materials.wall = new THREE.MeshStandardMaterial({ color: "#fafaf9", roughness: 0.9 });
      }
      
      // Floors
      if (m.floors === "walnut_wood") {
        this.materials.floor = new THREE.MeshStandardMaterial({ map: this.textures.walnut, roughness: 0.4 });
      } else if (m.floors === "marble") {
        this.materials.floor = new THREE.MeshStandardMaterial({ map: this.textures.marble, roughness: 0.12 });
      } else if (m.floors === "tile") {
        this.materials.floor = new THREE.MeshStandardMaterial({ map: this.textures.tile, roughness: 0.25 });
      } else { // oak_wood
        this.materials.floor = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.35 });
      }
      
      // Doors / Wood
      if (m.doors === "walnut") {
        this.materials.wood = new THREE.MeshStandardMaterial({ map: this.textures.walnut, roughness: 0.45 });
      } else { // oak
        this.materials.wood = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.4 });
      }
      
      // Standard styles backup
      this.materials.marble = new THREE.MeshStandardMaterial({ map: this.textures.marble, roughness: 0.12 });
      this.materials.metal = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.2, metalness: 0.85 });
      this.materials.fabric = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.8 });
      return;
    }
    
    // Apply styling materials (if no custom global settings are defined)
    if (styleName === "scandinavian") {
      this.materials.wall = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.9 }); // matte plaster
      this.materials.floor = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.4 });
      this.materials.wood = new THREE.MeshStandardMaterial({ color: "#e7e5e4", roughness: 0.45 });
      this.materials.marble = new THREE.MeshStandardMaterial({ map: this.textures.marble, roughness: 0.15 });
      this.materials.metal = new THREE.MeshStandardMaterial({ color: "#d1d5db", roughness: 0.2, metalness: 0.8 });
      this.materials.fabric = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.85 });
    } 
    else if (styleName === "minimalist") {
      this.materials.wall = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 });
      this.materials.floor = new THREE.MeshStandardMaterial({ map: this.textures.tile, roughness: 0.3 });
      this.materials.wood = new THREE.MeshStandardMaterial({ color: "#d6d3d1", roughness: 0.5 });
      this.materials.marble = new THREE.MeshStandardMaterial({ color: "#f3f4f6", roughness: 0.2 });
      this.materials.metal = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.1, metalness: 0.95 });
      this.materials.fabric = new THREE.MeshStandardMaterial({ color: "#e4e4e7", roughness: 0.9 });
    } 
    else if (styleName === "japanese") {
      this.materials.wall = new THREE.MeshStandardMaterial({ color: "#fafaf9", roughness: 0.9 });
      this.materials.floor = new THREE.MeshStandardMaterial({ map: this.textures.wood, color: "#fef08a", roughness: 0.5 }); // Bamboo
      this.materials.wood = new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.45 });
      this.materials.marble = new THREE.MeshStandardMaterial({ map: this.textures.marble, roughness: 0.25 });
      this.materials.metal = new THREE.MeshStandardMaterial({ color: "#3f3f46", roughness: 0.3, metalness: 0.75 });
      this.materials.fabric = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.9 });
    } 
    else if (styleName === "industrial") {
      this.materials.wall = new THREE.MeshStandardMaterial({ map: this.textures.concrete, roughness: 0.8 }); // Concrete
      this.materials.floor = new THREE.MeshStandardMaterial({ color: "#292524", roughness: 0.5 });
      this.materials.wood = new THREE.MeshStandardMaterial({ color: "#451a03", roughness: 0.5 });
      this.materials.marble = new THREE.MeshStandardMaterial({ map: this.textures.marble, color: "#475569", roughness: 0.15 });
      this.materials.metal = new THREE.MeshStandardMaterial({ color: "#09090b", roughness: 0.4, metalness: 0.95 }); // Cast Iron
      this.materials.fabric = new THREE.MeshStandardMaterial({ color: "#3f3f46", roughness: 0.8 });
    } 
    else if (styleName === "luxury") {
      this.materials.wall = new THREE.MeshStandardMaterial({ color: "#1c1917", roughness: 0.6 });
      this.materials.floor = new THREE.MeshStandardMaterial({ map: this.textures.marble, roughness: 0.08, metalness: 0.2 }); // Obsidian marble
      this.materials.wood = new THREE.MeshStandardMaterial({ map: this.textures.walnut, roughness: 0.2 }); // walnut
      this.materials.marble = new THREE.MeshStandardMaterial({ map: this.textures.marble, color: "#e2e8f0", roughness: 0.05 });
      this.materials.metal = new THREE.MeshStandardMaterial({ color: "#ca8a04", roughness: 0.1, metalness: 0.95 }); // Polished Gold
      this.materials.fabric = new THREE.MeshStandardMaterial({ color: "#701a75", roughness: 0.7 }); // Velvet
    } 
    else {
      // Modern Luxe (Default)
      this.materials.wall = new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.9 });
      this.materials.floor = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.35 });
      this.materials.wood = new THREE.MeshStandardMaterial({ color: "#a16207", roughness: 0.35 });
      this.materials.marble = new THREE.MeshStandardMaterial({ map: this.textures.marble, roughness: 0.12 });
      this.materials.metal = new THREE.MeshStandardMaterial({ color: "#2563eb", roughness: 0.15, metalness: 0.9 }); // blue chrome
      this.materials.fabric = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.8 });
    }
  },

  setupFPVInput: function() {
    window.addEventListener("keydown", (e) => {
      if (this.cameraMode !== "firstperson") return;
      this.updateMovement(e.key, 1);
    });
    
    window.addEventListener("keyup", (e) => {
      if (this.cameraMode !== "firstperson") return;
      this.updateMovement(e.key, 0);
    });
    
    document.addEventListener("pointerlockchange", () => {
      const hint = document.querySelector(".fp-controls-hint");
      if (document.pointerLockElement === this.container) {
        if (hint) hint.style.display = "block";
      } else {
        if (hint) hint.style.display = "none";
        this.setCameraMode("orbit");
      }
    });
    
    this.container.addEventListener("mousemove", (e) => {
      if (this.cameraMode !== "firstperson" || document.pointerLockElement !== this.container) return;
      
      const sensitivity = 0.0025;
      this.camYaw -= e.movementX * sensitivity;
      this.camPitch -= e.movementY * sensitivity;
      
      this.camPitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.camPitch));
      this.camera.quaternion.setFromEuler(new THREE.Euler(this.camPitch, this.camYaw, 0, 'YXZ'));
    });
  },

  updateMovement: function(key, val) {
    const k = key.toLowerCase();
    if (k === "w" || k === "arrowup") this.moveState.forward = val;
    if (k === "s" || k === "arrowdown") this.moveState.backward = val;
    if (k === "a" || k === "arrowleft") this.moveState.left = val;
    if (k === "d" || k === "arrowright") this.moveState.right = val;
  },

  setCameraMode: function(mode) {
    this.cameraMode = mode;
    
    const btnOrbit = document.getElementById("btn-camera-orbit");
    const btnFp = document.getElementById("btn-camera-fp");
    
    if (btnOrbit) btnOrbit.classList.toggle("active", mode === "orbit");
    if (btnFp) btnFp.classList.toggle("active", mode === "firstperson");
    
    if (mode === "orbit") {
      this.orbitControls.enabled = true;
      document.exitPointerLock();
      
      this.camera.position.set(12, 10, 15);
      this.updateCameraTarget();
    } else {
      this.orbitControls.enabled = false;
      this.container.requestPointerLock();
      
      this.camera.position.set(0, this.playerHeight, 0);
      this.camYaw = 0;
      this.camPitch = 0;
      this.camera.rotation.set(0, 0, 0);
    }
  },

  resize: function() {
    if (!this.renderer || !this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  },

  rebuildScene: function() {
    if (!window.editor) return;
    this.needsRebuild = false;
    
    const disposeGeometries = (node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.children) {
        node.children.forEach(disposeGeometries);
      }
    };

    // Clear old elements and free GPU resources
    this.wallMeshes.forEach(m => { this.scene.remove(m); disposeGeometries(m); });
    this.itemMeshes.forEach(m => { this.scene.remove(m); disposeGeometries(m); });
    this.floorMeshes.forEach(m => { this.scene.remove(m); disposeGeometries(m); });
    this.ceilingMeshes.forEach(m => { this.scene.remove(m); disposeGeometries(m); });
    
    this.wallMeshes = [];
    this.itemMeshes = [];
    this.floorMeshes = [];
    this.ceilingMeshes = [];
    
    // Render default ground terrain
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMesh = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: "#06080c", roughness: 0.9 }));
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);
    this.floorMeshes.push(groundMesh);

    // Get floors view mode (from dropdown selector)
    const viewModeSelect = document.getElementById("three-floors-view-mode");
    const viewMode = viewModeSelect ? viewModeSelect.value : "all";

    // Setup floors list
    const floors = editor.floors || [
      {
        id: "floor_ground",
        name: "Ground Floor",
        walls: editor.walls,
        items: editor.items
      }
    ];

    let currentFloorIndex = floors.findIndex(f => f.id === editor.currentFloorId);
    if (currentFloorIndex === -1) currentFloorIndex = 0;

    let stackingY = 0;

    floors.forEach((floor, idx) => {
      const floorHeight = Number(floor.settings?.wallHeight || 2.8);
      
      // Determine Y coordinate for this floor
      let floorY = stackingY;

      // Spacing for exploded view mode
      if (viewMode === "exploded") {
        floorY += idx * 1.5; 
      }

      // Stacking tracker (always increments logically)
      stackingY += floorHeight;

      // Filter by current floor only
      if (viewMode === "current" && floor.id !== editor.currentFloorId) {
        return; 
      }

      // Check transparency for upper floors
      let isTransparent = false;
      if (viewMode === "transparent" && idx > currentFloorIndex) {
        isTransparent = true;
      }

      const isTopFloor = (idx === floors.length - 1) || (viewMode === "current");

      // 1. Build Room Floors and Ceilings
      this.buildFloorSlabs(floor, floorY, isTransparent, isTopFloor, idx === 0);

      // 2. Build 3D Walls
      this.buildWallSegments(floor.walls || [], floor.items || [], floorY, isTransparent);

      // 3. Build Placed Furniture
      this.buildFurnitureItems(floor.items || [], floorY, isTransparent, floor.id);
    });

    // 4. Center orbit target onto the layout center boundary box
    this.updateCameraTarget();
  },

  getFloorStackingY: function(floorId) {
    const floors = editor.floors || [];
    let y = 0;
    const viewModeSelect = document.getElementById("three-floors-view-mode");
    const viewMode = viewModeSelect ? viewModeSelect.value : "all";

    for (let i = 0; i < floors.length; i++) {
      const f = floors[i];
      if (f.id === floorId) {
        if (viewMode === "exploded") {
          y += i * 1.5;
        }
        return y;
      }
      const floorHeight = Number(f.settings?.wallHeight || 2.8);
      y += floorHeight;
    }
    return 0;
  },

  applyTransparency: function(material) {
    if (!material) return material;
    if (Array.isArray(material)) {
      return material.map(m => {
        const copy = m.clone();
        copy.transparent = true;
        copy.opacity = 0.25;
        return copy;
      });
    }
    const copy = material.clone();
    copy.transparent = true;
    copy.opacity = 0.25;
    return copy;
  },

  buildFloorSlabs: function(floor, floorY, isTransparent, isTopFloor, isBottomFloor) {
    const wallsList = floor.walls || [];
    const rooms = [];

    const segments = [];
    wallsList.forEach(w => {
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
          rooms.push(path.map(idx => vertices[idx]));
        }
      }
    }

    if (rooms.length === 0 && wallsList.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      wallsList.forEach(w => {
        minX = Math.min(minX, w.x1, w.x2);
        maxX = Math.max(maxX, w.x1, w.x2);
        minY = Math.min(minY, w.y1, w.y2);
        maxY = Math.max(maxY, w.y1, w.y2);
      });
      minX -= 0.1; maxX += 0.1; minY -= 0.1; maxY += 0.1;
      rooms.push([
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ]);
    }

    const floorMat = isTransparent ? this.applyTransparency(this.materials.floor) : this.materials.floor;
    const ceilingMat = isTransparent ? this.applyTransparency(this.materials.ceiling) : this.materials.ceiling;
    const concreteMat = isTransparent ? this.applyTransparency(new THREE.MeshStandardMaterial({ color: "#3f3f46", map: this.textures.concrete, roughness: 0.9 })) : new THREE.MeshStandardMaterial({ color: "#3f3f46", map: this.textures.concrete, roughness: 0.9 });
    const wallHeight = Number(floor.settings?.wallHeight || 2.8);

    rooms.forEach(poly => {
      const shape = new THREE.Shape();
      shape.moveTo(poly[0].x, poly[0].y);
      for (let k = 1; k < poly.length; k++) {
        shape.lineTo(poly[k].x, poly[k].y);
      }
      shape.closePath();

      const shapeGeo = new THREE.ShapeGeometry(shape);
      
      const floorMesh = new THREE.Mesh(shapeGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = floorY + 0.015;
      floorMesh.receiveShadow = true;
      this.scene.add(floorMesh);
      this.floorMeshes.push(floorMesh);

      if (isBottomFloor) {
        const extrudeSettings = { depth: 0.3, bevelEnabled: false };
        const fGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const fMesh = new THREE.Mesh(fGeo, concreteMat);
        fMesh.rotation.x = -Math.PI / 2;
        fMesh.position.y = floorY; 
        fMesh.receiveShadow = true;
        this.scene.add(fMesh);
        this.floorMeshes.push(fMesh);
      }

      if (this.ceilingEnabled) {
        const ceilingMesh = new THREE.Mesh(shapeGeo, ceilingMat);
        ceilingMesh.rotation.x = -Math.PI / 2;
        ceilingMesh.position.y = floorY + wallHeight - 0.005;
        this.scene.add(ceilingMesh);
        this.ceilingMeshes.push(ceilingMesh);

        if (isTopFloor) {
          const rGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
          const rMesh = new THREE.Mesh(rGeo, new THREE.MeshStandardMaterial({ color: "#27272a", roughness: 0.7 }));
          rMesh.rotation.x = -Math.PI / 2;
          rMesh.position.y = floorY + wallHeight + 0.2; 
          rMesh.castShadow = true;
          this.scene.add(rMesh);
          this.ceilingMeshes.push(rMesh);
        }
      }
    });
  },

  buildWallSegments: function(wallsList, itemsList, floorY, isTransparent) {
    const wallMat = isTransparent ? this.applyTransparency(this.materials.wall) : this.materials.wall;

    wallsList.forEach((w, wallIdx) => {
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len < 0.01) return;
      
      const rot = Math.atan2(dy, dx);
      
      const openings = [];
      itemsList.forEach(item => {
        if (item.type !== "door" && item.type !== "window") return;
        const t = ((item.x - w.x1) * dx + (item.y - w.y1) * dy) / (len * len);
        if (t < 0 || t > 1) return;
        
        const projX = w.x1 + t * dx;
        const projY = w.y1 + t * dy;
        const dist = Math.hypot(item.x - projX, item.y - projY);
        if (dist > 0.3) return;
        
        openings.push({
          start: Math.max(0, t * len - item.w / 2),
          end: Math.min(len, t * len + item.w / 2),
          type: item.type,
          h: item.h,
          item: item
        });
      });
      
      openings.sort((a, b) => a.start - b.start);
      let curr = 0;
      
      const createWallBlock = (xStart, xEnd, yStart, yEnd) => {
        const subLen = xEnd - xStart;
        if (subLen < 0.01) return;
        
        const subHeight = yEnd - yStart;
        const wallGeometry = new THREE.BoxGeometry(subLen, subHeight, w.thickness);
        const heightOffset = wallIdx * 0.0001;
        const wallMesh = new THREE.Mesh(wallGeometry, wallMat);
        
        const localXMid = (xStart + xEnd) / 2;
        const midX = w.x1 + (localXMid / len) * dx;
        const midY = w.y1 + (localXMid / len) * dy;
        const yCenter = floorY + yStart + subHeight / 2 + heightOffset;
        
        wallMesh.position.set(midX, yCenter, -midY);
        wallMesh.rotation.y = -rot;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        
        this.scene.add(wallMesh);
        this.wallMeshes.push(wallMesh);
      };
      
      openings.forEach(op => {
        if (op.start > curr) {
          createWallBlock(curr, op.start, 0, w.height);
        }
        
        if (op.type === "door") {
          if (op.h < w.height) {
            createWallBlock(op.start, op.end, op.h, w.height);
          }
        } 
        else if (op.type === "window") {
          const sillH = 0.9;
          const winTop = Math.min(w.height - 0.1, sillH + op.h);
          createWallBlock(op.start, op.end, 0, sillH);
          if (winTop < w.height) {
            createWallBlock(op.start, op.end, winTop, w.height);
          }
        }
        curr = op.end;
      });
      
      if (curr < len) {
        createWallBlock(curr, len, 0, w.height);
      }
    });
  },

  buildFurnitureItems: function(itemsList, floorY = 0, isTransparent = false, floorId = null) {
    itemsList.forEach(item => {
      if (item.hidden) return;
      let itemGroup = new THREE.Group();
      
      itemGroup.position.set(item.x, floorY, -item.y);
      itemGroup.rotation.y = -item.rotation * (Math.PI / 180);
      
      let w = item.w;
      let h_3d, d_3d;
      if (item.type === "door" || item.type === "window") {
        w = item.w;
        h_3d = item.h;       
        d_3d = item.depth;   
      } else {
        w = item.w;
        d_3d = item.h;       
        h_3d = item.depth;   
      }

      if (item.type === "staircase") {
        let stairHeight = h_3d;
        if (item.connectToFloorId) {
          const fromY = floorY;
          const toY = this.getFloorStackingY(item.connectToFloorId);
          if (toY > fromY) {
            stairHeight = toY - fromY;
          }
        }
        h_3d = stairHeight;
      }
      
      if (item.type === "door") {
        // 1. Oak wood door frame (4 sides)
        const frameMat = this.materials.wood;
        const postW = 0.04;
        const postDepth = d_3d + 0.015; // slightly wider than wall for aesthetic frame reveal
        
        // Left vertical post
        const leftPost = new THREE.Mesh(new THREE.BoxGeometry(postW, h_3d, postDepth), frameMat);
        leftPost.position.set(-w/2 + postW/2, h_3d/2, 0);
        leftPost.castShadow = true;
        
        // Right vertical post
        const rightPost = new THREE.Mesh(new THREE.BoxGeometry(postW, h_3d, postDepth), frameMat);
        rightPost.position.set(w/2 - postW/2, h_3d/2, 0);
        rightPost.castShadow = true;
        
        // Top header post
        const header = new THREE.Mesh(new THREE.BoxGeometry(w, postW, postDepth), frameMat);
        header.position.set(0, h_3d - postW/2, 0);
        header.castShadow = true;
        
        // Thin threshold bottom bar
        const threshold = new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, d_3d), frameMat);
        threshold.position.set(0, 0.0075, 0);
        threshold.receiveShadow = true;
        
        itemGroup.add(leftPost);
        itemGroup.add(rightPost);
        itemGroup.add(header);
        itemGroup.add(threshold);
        
        // 2. Hinge swing pivot sub-group
        const hingeGroup = new THREE.Group();
        hingeGroup.position.set(-w/2 + postW, 0.015, 0); // starts above bottom threshold
        
        // Swing door panel 35 degrees open for depth visual
        hingeGroup.rotation.y = 0.6; 
        
        const panelW = w - postW * 2;
        const panelH = h_3d - postW - 0.015;
        const panelThick = 0.04; // 40mm thickness
        const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, panelThick), this.materials.wood);
        panel.position.set(panelW/2, panelH/2, 0);
        panel.castShadow = true;
        panel.receiveShadow = true;
        hingeGroup.add(panel);
        
        // Two physical brass hinge cylinders on the left edge pivot
        const hingeGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.07);
        const hinge1 = new THREE.Mesh(hingeGeo, this.materials.metal);
        hinge1.position.set(0, 0.35, 0);
        const hinge2 = new THREE.Mesh(hingeGeo, this.materials.metal);
        hinge2.position.set(0, panelH - 0.35, 0);
        hingeGroup.add(hinge1);
        hingeGroup.add(hinge2);
        
        // 3. Brass lever handles on both sides
        const handleX = panelW - 0.06;
        const handleY = 0.95; // 95cm height
        const createDoorHandle = (isBack) => {
          const handleGroup = new THREE.Group();
          const zOffset = isBack ? (panelThick/2 + 0.002) : (-panelThick/2 - 0.002);
          const yRot = isBack ? 0 : Math.PI;
          handleGroup.position.set(handleX, handleY, zOffset);
          handleGroup.rotation.y = yRot;
          
          // Rosette / base plate
          const rosette = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.004), this.materials.metal);
          rosette.rotation.x = Math.PI / 2;
          handleGroup.add(rosette);
          
          // Spindle shaft extending outward
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.022), this.materials.metal);
          shaft.rotation.x = Math.PI / 2;
          shaft.position.z = 0.011;
          handleGroup.add(shaft);
          
          // Horizontal Lever handle grip
          const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1), this.materials.metal);
          grip.rotation.z = Math.PI / 2;
          grip.position.set(-0.04, 0, 0.022); // points towards hinges
          handleGroup.add(grip);
          
          return handleGroup;
        };
        
        hingeGroup.add(createDoorHandle(true));
        hingeGroup.add(createDoorHandle(false));
        
        itemGroup.add(hingeGroup);
      }
      else if (item.type === "window") {
        const sillH = 0.9;
        const winH = h_3d;
        
        // 1. Protruding Marble Window sill
        const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.03, d_3d + 0.06), this.materials.marble);
        sill.position.set(0, sillH - 0.015, 0);
        sill.castShadow = true;
        itemGroup.add(sill);
        
        // 2. Sash outer structural frame (metal, matches wall opening thickness)
        const frameMat = this.materials.metal;
        const frameW = 0.04;
        const frameDepth = d_3d + 0.01;
        
        // Outer Left
        const lPost = new THREE.Mesh(new THREE.BoxGeometry(frameW, winH, frameDepth), frameMat);
        lPost.position.set(-w/2 + frameW/2, sillH + winH/2, 0);
        // Outer Right
        const rPost = new THREE.Mesh(new THREE.BoxGeometry(frameW, winH, frameDepth), frameMat);
        rPost.position.set(w/2 - frameW/2, sillH + winH/2, 0);
        // Outer Top
        const tFrame = new THREE.Mesh(new THREE.BoxGeometry(w, frameW, frameDepth), frameMat);
        tFrame.position.set(0, sillH + winH - frameW/2, 0);
        // Outer Bottom
        const bFrame = new THREE.Mesh(new THREE.BoxGeometry(w, frameW, frameDepth), frameMat);
        bFrame.position.set(0, sillH + frameW/2, 0);
        
        itemGroup.add(lPost);
        itemGroup.add(rPost);
        itemGroup.add(tFrame);
        itemGroup.add(bFrame);
        
        // 3. Inner sash frame (recessed inside outer frame, 45mm thick for true 3D relief)
        const innerW = 0.03;
        const innerDepth = 0.045;
        const innerH = winH - frameW * 2;
        const innerWidth = w - frameW * 2;
        
        // Inner frame left vertical
        const lInner = new THREE.Mesh(new THREE.BoxGeometry(innerW, innerH, innerDepth), frameMat);
        lInner.position.set(-innerWidth/2 + innerW/2, sillH + winH/2, 0);
        // Inner frame right vertical
        const rInner = new THREE.Mesh(new THREE.BoxGeometry(innerW, innerH, innerDepth), frameMat);
        rInner.position.set(innerWidth/2 - innerW/2, sillH + winH/2, 0);
        // Inner frame top horizontal
        const tInner = new THREE.Mesh(new THREE.BoxGeometry(innerWidth, innerW, innerDepth), frameMat);
        tInner.position.set(0, sillH + winH - frameW - innerW/2, 0);
        // Inner frame bottom horizontal
        const bInner = new THREE.Mesh(new THREE.BoxGeometry(innerWidth, innerW, innerDepth), frameMat);
        bInner.position.set(0, sillH + frameW + innerW/2, 0);
        
        itemGroup.add(lInner);
        itemGroup.add(rInner);
        itemGroup.add(tInner);
        itemGroup.add(bInner);
        
        // 4. Central division mullion
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(innerW, innerH - innerW*2, innerDepth + 0.005), frameMat);
        mullion.position.set(0, sillH + winH/2, 0);
        itemGroup.add(mullion);
        
        // 5. Transparent Physical Glass Panes
        const paneW = (innerWidth - innerW * 3) / 2;
        const paneH = innerH - innerW * 2;
        const glassThick = 0.012; // 12mm glass thickness
        
        const glassL = new THREE.Mesh(new THREE.BoxGeometry(paneW, paneH, glassThick), this.materials.glass);
        glassL.position.set(-paneW/2 - innerW/2, sillH + winH/2, 0);
        const glassR = new THREE.Mesh(new THREE.BoxGeometry(paneW, paneH, glassThick), this.materials.glass);
        glassR.position.set(paneW/2 + innerW/2, sillH + winH/2, 0);
        
        itemGroup.add(glassL);
        itemGroup.add(glassR);
      }
      else if (item.type === "sofa") {
        // Sofa base cushion
        const baseH = h_3d * 0.35;
        const base = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, baseH, d_3d - 0.1), this.materials.fabric);
        base.position.y = baseH / 2 + 0.08;
        base.castShadow = true;
        base.receiveShadow = true;
        
        // Back rest
        const backH = h_3d * 0.6;
        const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, backH, 0.15), this.materials.fabric);
        back.position.set(0, backH/2 + 0.08, -d_3d/2 + 0.125);
        back.castShadow = true;
        
        // Armrests
        const armW = 0.15;
        const armH = h_3d * 0.55;
        const armL = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, d_3d), this.materials.fabric);
        armL.position.set(-w/2 + armW/2, armH/2 + 0.08, 0);
        armL.castShadow = true;
        
        const armR = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, d_3d), this.materials.fabric);
        armR.position.set(w/2 - armW/2, armH/2 + 0.08, 0);
        armR.castShadow = true;
        
        itemGroup.add(base);
        itemGroup.add(back);
        itemGroup.add(armL);
        itemGroup.add(armR);
        
        // Wooden legs cylinders
        const legGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.08);
        const legMat = this.materials.wood;
        const ox = w/2 - 0.15;
        const oz = d_3d/2 - 0.15;
        const offsets = [[-ox, -oz], [ox, -oz], [-ox, oz], [ox, oz]];
        offsets.forEach(off => {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(off[0], 0.04, off[1]);
          leg.castShadow = true;
          itemGroup.add(leg);
        });
      }
      else if (item.type === "chair") {
        // Seat cushion
        const seatH = h_3d * 0.12;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(w, seatH, d_3d), this.materials.fabric);
        seat.position.y = 0.4 + seatH/2;
        seat.castShadow = true;
        itemGroup.add(seat);
        
        // Spindle backrest
        const backH = 0.45;
        const back = new THREE.Mesh(new THREE.BoxGeometry(w, backH, 0.05), this.materials.wood);
        back.position.set(0, 0.4 + seatH + backH/2, -d_3d/2 + 0.05);
        back.castShadow = true;
        itemGroup.add(back);
        
        // Slanted cylindrical legs
        const legGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.4);
        const legMat = this.materials.metal;
        const ox = w/2 - 0.04;
        const oz = d_3d/2 - 0.04;
        const offsets = [[-ox, -oz], [ox, -oz], [-ox, oz], [ox, oz]];
        offsets.forEach((off, idx) => {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(off[0], 0.2, off[1]);
          // Slant slightly outwards
          leg.rotation.z = off[0] > 0 ? 0.1 : -0.1;
          leg.rotation.x = off[1] > 0 ? 0.1 : -0.1;
          leg.castShadow = true;
          itemGroup.add(leg);
        });
      }
      else if (item.type === "dining_table" || item.type === "table_coffee") {
        const heightVal = item.type === "table_coffee" ? 0.4 : 0.75;
        const thick = 0.04;
        
        // Table top slab
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w, thick, d_3d), this.materials.wood);
        slab.position.y = heightVal - thick/2;
        slab.castShadow = true;
        slab.receiveShadow = true;
        itemGroup.add(slab);
        
        // Cylinder legs
        const legGeo = new THREE.CylinderGeometry(0.03, 0.025, heightVal - thick);
        const legMat = this.materials.metal;
        const ox = w/2 - 0.06;
        const oz = d_3d/2 - 0.06;
        const offsets = [[-ox, -oz], [ox, -oz], [-ox, oz], [ox, oz]];
        offsets.forEach(off => {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(off[0], (heightVal - thick)/2, off[1]);
          leg.castShadow = true;
          itemGroup.add(leg);
        });
      }
      else if (item.type === "desk") {
        // Table top slab
        const thick = 0.03;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w, thick, d_3d), this.materials.wood);
        slab.position.y = h_3d - thick/2;
        slab.castShadow = true;
        slab.receiveShadow = true;
        itemGroup.add(slab);
        
        // Desk legs (thin black metal posts on the left)
        const legGeo = new THREE.CylinderGeometry(0.02, 0.02, h_3d - thick);
        const legMat = this.materials.metal;
        const legL1 = new THREE.Mesh(legGeo, legMat);
        legL1.position.set(-w/2 + 0.05, (h_3d - thick)/2, -d_3d/2 + 0.05);
        legL1.castShadow = true;
        
        const legL2 = legL1.clone();
        legL2.position.z = d_3d/2 - 0.05;
        
        itemGroup.add(legL1);
        itemGroup.add(legL2);
        
        // Cabinet drawer stack on the right side
        const cabW = w * 0.28;
        const cabH = h_3d - thick - 0.02;
        const cabD = d_3d - 0.04;
        const cab = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD), this.materials.wood);
        cab.position.set(w/2 - cabW/2 - 0.02, cabH/2, 0);
        cab.castShadow = true;
        itemGroup.add(cab);
        
        // 2 Drawer front plates + tiny knobs
        for (let i = 0; i < 2; i++) {
          const drawH = (cabH - 0.04) / 2;
          const drawPlate = new THREE.Mesh(new THREE.BoxGeometry(cabW - 0.02, drawH - 0.01, 0.005), this.materials.wood);
          const localY = 0.02 + drawH/2 + i * drawH;
          drawPlate.position.set(w/2 - cabW/2 - 0.02, localY, cabD/2 + 0.001);
          itemGroup.add(drawPlate);
          
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), this.materials.metal);
          knob.position.set(w/2 - cabW/2 - 0.02, localY, cabD/2 + 0.012);
          itemGroup.add(knob);
        }
      }
      else if (item.type === "office_chair") {
        // Rolling base star (5 spokes)
        const spokeGroup = new THREE.Group();
        spokeGroup.position.y = 0.03;
        const spokeGeo = new THREE.BoxGeometry(w * 0.7, 0.03, 0.04);
        for (let i = 0; i < 5; i++) {
          const spoke = new THREE.Mesh(spokeGeo, this.materials.metal);
          spoke.rotation.y = (i * 2 * Math.PI) / 5;
          spoke.position.x = Math.sin(spoke.rotation.y) * 0.05;
          spoke.position.z = Math.cos(spoke.rotation.y) * 0.05;
          spoke.castShadow = true;
          spokeGroup.add(spoke);
        }
        itemGroup.add(spokeGroup);
        
        // Hydraulic central stem cylinder
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38), this.materials.metal);
        stem.position.y = 0.22;
        stem.castShadow = true;
        itemGroup.add(stem);
        
        // Seat cushion
        const seatH = 0.08;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, seatH, d_3d * 0.8), this.materials.fabric);
        seat.position.y = 0.41 + seatH/2;
        seat.castShadow = true;
        itemGroup.add(seat);
        
        // Armrests L and R
        const armH = 0.2;
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.05, armH, d_3d * 0.6), this.materials.metal);
        armL.position.set(-w*0.4 + 0.025, 0.41 + seatH + armH/2 - 0.04, 0);
        armL.castShadow = true;
        
        const armR = armL.clone();
        armR.position.x = w*0.4 - 0.025;
        itemGroup.add(armL);
        itemGroup.add(armR);
        
        // Chair backrest panel
        const backH = 0.48;
        const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, backH, 0.04), this.materials.fabric);
        back.position.set(0, 0.41 + seatH + backH/2 + 0.05, -d_3d*0.4);
        back.rotation.x = 0.06; // slight lean
        back.castShadow = true;
        itemGroup.add(back);
      }
      else if (item.type === "bookshelf") {
        // Outer cabinet frame (backing + 2 sides + top + bottom)
        const frameMat = this.materials.wood;
        const sideThick = 0.025;
        
        // Backing board
        const backBoard = new THREE.Mesh(new THREE.BoxGeometry(w, h_3d, 0.015), frameMat);
        backBoard.position.set(0, h_3d/2, -d_3d/2 + 0.0075);
        backBoard.castShadow = true;
        itemGroup.add(backBoard);
        
        // Left wall side
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(sideThick, h_3d, d_3d), frameMat);
        leftWall.position.set(-w/2 + sideThick/2, h_3d/2, 0);
        leftWall.castShadow = true;
        itemGroup.add(leftWall);
        
        // Right wall side
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(sideThick, h_3d, d_3d), frameMat);
        rightWall.position.set(w/2 - sideThick/2, h_3d/2, 0);
        rightWall.castShadow = true;
        itemGroup.add(rightWall);
        
        // Top cap board
        const topCap = new THREE.Mesh(new THREE.BoxGeometry(w, sideThick, d_3d), frameMat);
        topCap.position.set(0, h_3d - sideThick/2, 0);
        topCap.castShadow = true;
        itemGroup.add(topCap);
        
        // Base shelf board
        const baseShelf = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d_3d), frameMat);
        baseShelf.position.set(0, 0.03, 0);
        baseShelf.castShadow = true;
        itemGroup.add(baseShelf);
        
        // Three horizontal shelves at intermediate heights
        const numShelves = 3;
        const shelfH = (h_3d - 0.06 - sideThick) / (numShelves + 1);
        const bookMatColors = [
          new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.8 }), // red
          new THREE.MeshStandardMaterial({ color: "#2563eb", roughness: 0.8 }), // blue
          new THREE.MeshStandardMaterial({ color: "#16a34a", roughness: 0.8 }), // green
          new THREE.MeshStandardMaterial({ color: "#d97706", roughness: 0.8 }), // amber
          new THREE.MeshStandardMaterial({ color: "#4f46e5", roughness: 0.8 })  // indigo
        ];
        
        for (let i = 1; i <= numShelves; i++) {
          const yPos = 0.06 + i * shelfH;
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(w - sideThick * 2, 0.02, d_3d - 0.01), frameMat);
          shelf.position.set(0, yPos, 0.005);
          shelf.castShadow = true;
          itemGroup.add(shelf);
          
          // Draw 4-6 procedural book boxes on each shelf!
          const shelfBooksCount = 5;
          const shelfInnerW = w - sideThick * 2 - 0.1;
          const bookSpacing = shelfInnerW / shelfBooksCount;
          
          for (let b = 0; b < shelfBooksCount; b++) {
            const bWidth = 0.035;
            const bHeight = 0.18 + (b % 3) * 0.03;
            const bDepth = d_3d * 0.7;
            const bookMat = bookMatColors[(i + b) % bookMatColors.length];
            const book = new THREE.Mesh(new THREE.BoxGeometry(bWidth, bHeight, bDepth), bookMat);
            
            const localX = -shelfInnerW/2 + b * bookSpacing;
            book.position.set(localX, yPos + 0.01 + bHeight/2, -d_3d/2 + bDepth/2 + 0.06);
            
            // Lean the last book
            if (b === shelfBooksCount - 1) {
              book.rotation.z = 0.2;
              book.position.x += 0.02;
            }
            book.castShadow = true;
            itemGroup.add(book);
          }
        }
      }
      else if (item.type === "bath_tub") {
        // Outer tub ceramic frame
        const rimMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.1 });
        const wallThick = 0.05;
        
        // Bottom floor slab
        const floorSlab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d_3d), rimMat);
        floorSlab.position.y = 0.04;
        floorSlab.castShadow = true;
        itemGroup.add(floorSlab);
        
        // Front wall side
        const frontWall = new THREE.Mesh(new THREE.BoxGeometry(w, h_3d - 0.08, wallThick), rimMat);
        frontWall.position.set(0, 0.08 + (h_3d - 0.08)/2, d_3d/2 - wallThick/2);
        frontWall.castShadow = true;
        itemGroup.add(frontWall);
        
        // Back wall side
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, h_3d - 0.08, wallThick), rimMat);
        backWall.position.set(0, 0.08 + (h_3d - 0.08)/2, -d_3d/2 + wallThick/2);
        backWall.castShadow = true;
        itemGroup.add(backWall);
        
        // Left side wall
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h_3d - 0.08, d_3d - wallThick * 2), rimMat);
        leftWall.position.set(-w/2 + wallThick/2, 0.08 + (h_3d - 0.08)/2, 0);
        leftWall.castShadow = true;
        itemGroup.add(leftWall);
        
        // Right side wall
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h_3d - 0.08, d_3d - wallThick * 2), rimMat);
        rightWall.position.set(w/2 - wallThick/2, 0.08 + (h_3d - 0.08)/2, 0);
        rightWall.castShadow = true;
        itemGroup.add(rightWall);
        
        // Swimming turquoise water level inside
        const waterMat = this.materials.water;
        const waterSheet = new THREE.Mesh(new THREE.BoxGeometry(w - wallThick*2, 0.01, d_3d - wallThick*2), waterMat);
        waterSheet.position.set(0, h_3d * 0.7, 0);
        itemGroup.add(waterSheet);
        
        // Chrome silver tap mixer faucet
        const faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16), this.materials.metal);
        faucetBase.position.set(-w/2 + wallThick + 0.04, h_3d + 0.04, 0);
        
        const faucetNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06), this.materials.metal);
        faucetNozzle.rotation.z = Math.PI / 2;
        faucetNozzle.position.set(-w/2 + wallThick + 0.07, h_3d + 0.1, 0);
        
        itemGroup.add(faucetBase);
        itemGroup.add(faucetNozzle);
      }
      else if (item.type === "wash_basin") {
        // 1. Base wood vanity cabinet cupboard
        const cabH = h_3d * 0.78;
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(w, cabH, d_3d), this.materials.wood);
        cabinet.position.y = cabH / 2;
        cabinet.castShadow = true;
        cabinet.receiveShadow = true;
        itemGroup.add(cabinet);
        
        // Cabinet black handle seams
        const handle = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.015, 0.02), this.materials.metal);
        handle.position.set(0, cabH - 0.08, d_3d/2 + 0.01);
        itemGroup.add(handle);
        
        // 2. White countertop ceramic sink basin (cylinder)
        const bowlMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.1 });
        const bowlH = h_3d * 0.22;
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.3, bowlH, 16), bowlMat);
        bowl.position.set(0, cabH + bowlH/2, 0);
        bowl.castShadow = true;
        itemGroup.add(bowl);
        
        // 3. Curved faucet tap spout
        const tapBase = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18), this.materials.metal);
        tapBase.position.set(0, cabH + bowlH, -d_3d * 0.25);
        
        const tapArc = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.015), this.materials.metal);
        tapArc.position.set(0.035, cabH + bowlH + 0.09, -d_3d * 0.25);
        
        itemGroup.add(tapBase);
        itemGroup.add(tapArc);
      }
      else if (item.type === "lamp_floor") {
        // Base flat black metal disc
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), this.materials.metal);
        base.position.y = 0.01;
        base.castShadow = true;
        itemGroup.add(base);
        
        // Slim vertical metal pole stem
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h_3d - 0.2), this.materials.metal);
        pole.position.y = (h_3d - 0.2) / 2 + 0.02;
        pole.castShadow = true;
        itemGroup.add(pole);
        
        // Angled conical fabric lampshade
        const shadeH = 0.28;
        const shadeMat = new THREE.MeshStandardMaterial({ color: "#fef08a", roughness: 0.9, emissive: "#fef08a", emissiveIntensity: 0.35 });
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, shadeH, 16), shadeMat);
        shade.position.y = h_3d - shadeH/2;
        shade.castShadow = true;
        itemGroup.add(shade);
        
        // Add a real warm PointLight inside the shade that casts shadows!
        const lampLight = new THREE.PointLight("#fef08a", 1.5, 8.0, 1.6);
        lampLight.position.set(0, h_3d - 0.15, 0);
        lampLight.castShadow = true;
        lampLight.shadow.bias = -0.001;
        lampLight.shadow.mapSize.width = 512;
        lampLight.shadow.mapSize.height = 512;
        itemGroup.add(lampLight);
      }
      else if (item.type === "decor_tv" || item.type === "tv_stand" || item.type === "tv") {
        // Low wood TV cabinet stand console
        const cabH = 0.45;
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(w, cabH, d_3d), this.materials.wood);
        cabinet.position.y = cabH / 2;
        cabinet.castShadow = true;
        cabinet.receiveShadow = true;
        itemGroup.add(cabinet);
        
        // Divider line seams
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.005, cabH - 0.04, 0.005), this.materials.metal);
        seam.position.set(0, cabH/2, d_3d/2 + 0.001);
        itemGroup.add(seam);
        
        // Cylindrical metal low support legs
        const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.08);
        const legMat = this.materials.metal;
        const ox = w/2 - 0.12;
        const oz = d_3d/2 - 0.08;
        const legOffsets = [[-ox, -oz], [ox, -oz], [-ox, oz], [ox, oz]];
        legOffsets.forEach(off => {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(off[0], -0.04, off[1]);
          leg.castShadow = true;
          itemGroup.add(leg);
        });
        
        // Flat thin TV screen standing on top
        const tvW = w * 0.85;
        const tvH = 0.65;
        const tvD = 0.035;
        const screen = new THREE.Mesh(new THREE.BoxGeometry(tvW, tvH, tvD), new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.12, metalness: 0.85 }));
        screen.position.set(0, cabH + tvH/2 + 0.06, 0);
        screen.castShadow = true;
        itemGroup.add(screen);
        
        // Stand neck post + base plate on console top
        const basePlate = new THREE.Mesh(new THREE.BoxGeometry(tvW * 0.28, 0.012, 0.18), this.materials.metal);
        basePlate.position.set(0, cabH + 0.006, 0);
        
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.06), this.materials.metal);
        neck.position.set(0, cabH + 0.03, 0);
        
        itemGroup.add(basePlate);
        itemGroup.add(neck);
      }
      else if (item.type === "bed_double") {
        // Bed wooden base box frame
        const frameH = 0.25;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w, frameH, d_3d), this.materials.wood);
        frame.position.y = frameH / 2;
        frame.castShadow = true;
        itemGroup.add(frame);
        
        // White soft mattress
        const matW = w - 0.06;
        const matD = d_3d - 0.08;
        const matH = 0.24;
        const mattress = new THREE.Mesh(new THREE.BoxGeometry(matW, matH, matD), new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.8 }));
        mattress.position.set(0, frameH + matH/2 - 0.02, 0.04);
        mattress.castShadow = true;
        mattress.receiveShadow = true;
        itemGroup.add(mattress);
        
        // Headboard vertical wooden slab
        const headH = 0.95;
        const head = new THREE.Mesh(new THREE.BoxGeometry(w, headH, 0.08), this.materials.wood);
        head.position.set(0, headH/2, -d_3d/2 + 0.04);
        head.castShadow = true;
        itemGroup.add(head);
        
        // Soft white pillows
        const pilW = (matW - 0.15) / 2;
        const pillowL = new THREE.Mesh(new THREE.BoxGeometry(pilW, 0.08, 0.38), new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.95 }));
        pillowL.position.set(-matW/4, frameH + matH - 0.01, -matD/2 + 0.28);
        pillowL.rotation.x = -0.1;
        
        const pillowR = pillowL.clone();
        pillowR.position.x = matW/4;
        
        itemGroup.add(pillowL);
        itemGroup.add(pillowR);
      }
      else if (item.type === "kitchen_island") {
        // Cabinet base structure
        const cabH = 0.85;
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(w, cabH, d_3d), this.materials.wood);
        cabinet.position.y = cabH / 2;
        cabinet.castShadow = true;
        cabinet.receiveShadow = true;
        itemGroup.add(cabinet);
        
        // Overhead counter slab (marble map)
        const slabThick = 0.04;
        const counter = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, slabThick, d_3d + 0.04), this.materials.marble);
        counter.position.set(0, cabH + slabThick/2, 0);
        counter.castShadow = true;
        itemGroup.add(counter);
        
        // Simple metallic sink tap structure
        const tapBase = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18), this.materials.metal);
        tapBase.position.set(-w/4, cabH + slabThick + 0.09, 0);
        
        const tapNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08), this.materials.metal);
        tapNozzle.rotation.z = Math.PI / 2;
        tapNozzle.position.set(-w/4 + 0.04, cabH + slabThick + 0.18, 0);
        
        itemGroup.add(tapBase);
        itemGroup.add(tapNozzle);
      }
      else if (item.type === "wardrobe") {
        // Cabinet frame
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(w, h_3d, d_3d), this.materials.wood);
        cabinet.position.y = h_3d / 2;
        cabinet.castShadow = true;
        cabinet.receiveShadow = true;
        itemGroup.add(cabinet);
        
        // Divider door seams lines
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.005, h_3d - 0.06, 0.005), this.materials.metal);
        seam.position.set(0, h_3d/2, d_3d/2 + 0.001);
        itemGroup.add(seam);
        
        // Tall handle bars
        const handleGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.25);
        const handleL = new THREE.Mesh(handleGeo, this.materials.metal);
        handleL.position.set(-0.04, h_3d/2, d_3d/2 + 0.015);
        
        const handleR = handleL.clone();
        handleR.position.x = 0.04;
        
        itemGroup.add(handleL);
        itemGroup.add(handleR);
      }
      else if (item.type === "nightstand") {
        // Stand drawer base
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(w, h_3d, d_3d), this.materials.wood);
        cabinet.position.y = h_3d / 2;
        cabinet.castShadow = true;
        itemGroup.add(cabinet);
        
        // Drawer front face panel offset
        const drawer = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h_3d * 0.4, 0.005), this.materials.wood);
        drawer.position.set(0, h_3d * 0.7, d_3d/2 + 0.001);
        itemGroup.add(drawer);
        
        // Small metallic knob handle
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), this.materials.metal);
        knob.position.set(0, h_3d * 0.7, d_3d/2 + 0.018);
        itemGroup.add(knob);
      }
      else if (item.type === "plant") {
        // Clay terracotta pot pot
        const potMat = new THREE.MeshStandardMaterial({ color: "#c2410c", roughness: 0.8 }); // terracotta
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.38, 12), potMat);
        pot.position.y = 0.19;
        pot.castShadow = true;
        itemGroup.add(pot);
        
        // Wooden thin trunk
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), this.materials.wood);
        trunk.position.y = 0.38 + 0.3;
        trunk.castShadow = true;
        itemGroup.add(trunk);
        
        // Spherical green leafy dome
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), this.materials.foliage);
        leaves.position.y = 0.38 + 0.6 + 0.15;
        leaves.scale.set(1, 1.3, 1);
        leaves.castShadow = true;
        itemGroup.add(leaves);
      }
      else if (item.type === "pool") {
        // Marble rim border frame
        const rimH = 1.0;
        const outerRim = new THREE.Mesh(new THREE.BoxGeometry(w, rimH, d_3d), this.materials.marble);
        outerRim.position.y = rimH / 2;
        outerRim.receiveShadow = true;
        itemGroup.add(outerRim);
        
        // Swimming turquoise reflection water
        const waterSheet = new THREE.Mesh(new THREE.BoxGeometry(w - 0.25, 0.02, d_3d - 0.25), this.materials.water);
        waterSheet.position.set(0, rimH - 0.05, 0);
        itemGroup.add(waterSheet);
      }
      else if (item.type === "staircase") {
        // Build 3D step blocks dynamically
        const numSteps = 12;
        const stepH = h_3d / numSteps;
        const stepD = d_3d / numSteps;
        
        for (let i = 0; i < numSteps; i++) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(w, stepH, stepD), this.materials.wood);
          const localY = i * stepH + stepH/2;
          const localZ = -d_3d/2 + i * stepD + stepD/2;
          step.position.set(0, localY, localZ);
          step.castShadow = true;
          step.receiveShadow = true;
          itemGroup.add(step);
        }
      }
      else {
        // Wooden cubic backup container block
        const backupBox = new THREE.Mesh(new THREE.BoxGeometry(w, h_3d, d_3d), this.materials.wood);
        backupBox.position.y = h_3d / 2;
        backupBox.castShadow = true;
        backupBox.receiveShadow = true;
        itemGroup.add(backupBox);
      }
      if (isTransparent) {
        itemGroup.traverse(node => {
          if (node.isMesh && node.material) {
            node.material = this.applyTransparency(node.material);
          }
        });
      }

      this.scene.add(itemGroup);
      this.itemMeshes.push(itemGroup);
    });
  },

  animate: function() {
    requestAnimationFrame(() => this.animate());
    
    if (this.needsRebuild) {
      this.rebuildScene();
    }
    
    if (this.cameraMode === "orbit") {
      this.orbitControls.update();
    } else {
      this.updateFPVMovement();
    }
    
    this.renderer.render(this.scene, this.camera);
  },

  updateFPVMovement: function() {
    const speed = 0.075;
    const friction = 0.85;
    
    this.playerVelocity.x *= friction;
    this.playerVelocity.z *= friction;
    
    const cosYaw = Math.cos(this.camYaw);
    const sinYaw = Math.sin(this.camYaw);
    
    // Direction calculations
    if (this.moveState.forward) {
      this.playerVelocity.x -= sinYaw * speed;
      this.playerVelocity.z -= cosYaw * speed;
    }
    if (this.moveState.backward) {
      this.playerVelocity.x += sinYaw * speed;
      this.playerVelocity.z += cosYaw * speed;
    }
    if (this.moveState.left) {
      this.playerVelocity.x -= cosYaw * speed;
      this.playerVelocity.z += sinYaw * speed;
    }
    if (this.moveState.right) {
      this.playerVelocity.x += cosYaw * speed;
      this.playerVelocity.z -= sinYaw * speed;
    }
    
    const nextX = this.camera.position.x + this.playerVelocity.x;
    const nextZ = this.camera.position.z + this.playerVelocity.z;
    
    // FPV player collision boundary check against structural walls (radius: 35cm)
    let colX = false;
    let colZ = false;
    const radius = 0.35;
    
    if (window.editor) {
      editor.walls.forEach(w => {
        const wallStart = { x: w.x1, y: -w.y1 };
        const wallEnd = { x: w.x2, y: -w.y2 };
        
        // check X boundary
        const projX = this.projectPtOnLine({ x: nextX, y: this.camera.position.z }, wallStart, wallEnd);
        if (projX.isOnSegment && projX.distance < radius + w.thickness / 2) {
          colX = true;
        }
        // check Z boundary
        const projZ = this.projectPtOnLine({ x: this.camera.position.x, y: nextZ }, wallStart, wallEnd);
        if (projZ.isOnSegment && projZ.distance < radius + w.thickness / 2) {
          colZ = true;
        }
      });
    }
    
    if (!colX) this.camera.position.x = nextX;
    if (!colZ) this.camera.position.z = nextZ;
    this.camera.position.y = this.playerHeight; // locked eye line level height
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

  updateCameraTarget: function() {
    if (!window.editor || editor.walls.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    editor.walls.forEach(w => {
      minX = Math.min(minX, w.x1, w.x2);
      maxX = Math.max(maxX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2);
      maxY = Math.max(maxY, w.y1, w.y2);
    });
    
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    
    // Sets camera orbit rotation target center
    this.orbitControls.target.set(midX, 1.0, -midY);
  }
};

window.threeViewer = threeViewer;
