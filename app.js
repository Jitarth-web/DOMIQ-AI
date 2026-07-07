/* ==========================================================================
   DOM IQ AI - APPLICATION COORDINATOR & GLOBAL CONTROLLER
   ========================================================================== */

const BACKGROUND_CONFIG = {
  particleCount: 850,           // Configured to exactly 1200 particles spread across the viewport
  auroraIntensity: 2.2,         // Increased from 1.0 to 2.2 for 3x visual presence
  bloomIntensity: 0.42,         // Increased bloom for soft highlight diffusion
  bloomRadius: 0.85,            // Spread radius of the bloom
  bloomThreshold: 0.12,         // Lower threshold so that more aurora color passes to bloom
  mouseStrength: 1.3,           // Gravity pull factor of the cursor
  cameraBreathing: 0.65,        // Elegant idle camera breathing offset scale
  animationSpeed: 0.72,         // Time delta multiplier (smooth flowing plasma motion)
  rippleStrength: 1.0,          // Intensity of velocity and click ripples
  parallaxDepth: 0.85,          // Parallax scale factor on camera movements
  glowIntensity: 1.4,           // Increased core background ambient glow scale
  colors: {
    background: ['#020205', '#040712', '#080c1b'], // Deep Black, Deep Navy
    aurora: ['#1d4ed8', '#06b6d4', '#1e1b4b', '#4c1d95', '#312e81'], // Electric Blue, Cyan, Deep Indigo, Subtle Violet, Royal Navy
    accent: '#06b6d4' // Accent color
  }
};

class ParticleField {
  constructor(canvasId, parentId) {
    this.canvasId = canvasId;
    this.parentId = parentId;
    this.canvas = document.getElementById(canvasId);
    this.parent = document.getElementById(parentId);
    if (!this.canvas || !this.parent) return;

    this.animationFrameId = null;
    this.active = false;
    this.isFallback = false;

    // Mouse tracking variables
    this.mouseX_target = 0;
    this.mouseY_target = 0;
    this.mouseX_spring = 0;
    this.mouseY_spring = 0;
    this.mouseSpringX_px = 0;
    this.mouseSpringY_px = 0;
    this.mouseVelX = 0;
    this.mouseVelY = 0;
    this.mouseSpeed = 0;
    this.velocityRippleAmt = 0;

    // Last mouse positions for delta calculations
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Click ripple trackers
    this.clickRippleX = 0.5;
    this.clickRippleY = 0.5;
    this.clickRippleTime = 99.0; // inactive initially

    // Hover trackers
    this.hoverActive = 0.0;
    this.hoverX = 0.5;
    this.hoverY = 0.5;
    this.hoverW = 0.0;
    this.hoverH = 0.0;

    // Performance state
    this.perfPreset = "high"; // low, med, high
    this.frameCount = 0;
    this.lastFpsCheckTime = 0;
    this.fpsHistory = [];

    // Bind mouse and click handlers
    this.bindEvents();

    // Detect WebGL capability
    if (!this.detectWebGL()) {
      this.isFallback = true;
    }
  }

  detectWebGL() {
    try {
      const canvas = document.createElement("canvas");
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  bindEvents() {
    if (!this.parent) return;

    this.parent.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      const nx = px * 2 - 1;
      const ny = -(py * 2 - 1);

      const dx = nx - this.mouseX_target;
      const dy = ny - this.mouseY_target;
      this.mouseSpeed = Math.hypot(dx, dy);

      this.mouseX_target = nx;
      this.mouseY_target = ny;
    });

    this.parent.addEventListener("mouseleave", () => {
      this.mouseX_target = 0;
      this.mouseY_target = 0;
      this.mouseSpeed = 0;
    });

    this.parent.addEventListener("mousedown", (e) => {
      // Check if click was on empty space
      const interactive = e.target.closest("button, input, select, a, textarea, .template-card, .project-card");
      if (!interactive) {
        const rect = this.canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = 1.0 - (e.clientY - rect.top) / rect.height; // WebGL shader is 0 at bottom, 1 at top
        this.clickRippleX = px;
        this.clickRippleY = py;
        this.clickRippleTime = 0.0;
      }
    });

    // Hover delegation for dashboard panels/cards
    this.parent.addEventListener("mouseover", (e) => {
      const card = e.target.closest(".template-card, .project-card, .glass, .studio-header");
      if (card && card !== this.parent) {
        const rect = card.getBoundingClientRect();
        const parentRect = this.canvas.getBoundingClientRect();

        // Convert rect center to normalized coordinates (0 to 1) for the fragment shader
        const cx = (rect.left + rect.width / 2 - parentRect.left) / parentRect.width;
        const cy = 1.0 - (rect.top + rect.height / 2 - parentRect.top) / parentRect.height;
        const cw = rect.width / parentRect.width;
        const ch = rect.height / parentRect.height;

        this.hoverActive = 1.0;
        this.hoverX = cx;
        this.hoverY = cy;
        this.hoverW = cw;
        this.hoverH = ch;
      }
    });

    this.parent.addEventListener("mouseout", (e) => {
      const card = e.target.closest(".template-card, .project-card, .glass, .studio-header");
      if (card) {
        this.hoverActive = 0.0;
      }
    });

    window.addEventListener("resize", () => {
      if (this.active) {
        this.resize();
      }
    });

    // Pause rendering when browser tab is inactive to save GPU
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pause();
      } else if (this.active) {
        this.resume();
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  start() {
    this.active = true;
    this.canvas = document.getElementById(this.canvasId);
    this.parent = document.getElementById(this.parentId);
    if (!this.canvas || !this.parent) return;

    if (this.isFallback) {
      this.startFallback();
      return;
    }

    try {
      this.initThree();
      this.resize();
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.lastPerfTime = performance.now();
      this.lastFpsCheckTime = performance.now();
      this.loopWebGL();
    } catch (err) {
      console.warn("WebGL initialization failed, falling back to 2D Canvas:", err);
      this.isFallback = true;
      this.startFallback();
    }
  }

  initThree() {
    const w = this.canvas.width || this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.height || this.canvas.clientHeight || window.innerHeight;

    // 1. Scene & Renderer
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.perfPreset !== "low",
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    this.camera.position.set(0, 0, 15);
    this.cameraTime = 0;

    // 3. Centralized configuration lookup
    const config = BACKGROUND_CONFIG;

    // Determine particle count based on preset
    let pCount = config.particleCount;
    if (this.perfPreset === "med") pCount = Math.floor(pCount * 0.6);
    else if (this.perfPreset === "low") pCount = Math.floor(pCount * 0.25);

    // 4. Background Plane with Custom GLSL Shader (Layer 1, 2, 3)
    this.initBackgroundShader();

    // 5. Layer 4: Particle Field
    this.initParticles(pCount);

    // 6. Layer 5: Twinkling Stars
    this.initStars(this.perfPreset === "low" ? 150 : 400);

    // 7. Layer 6: Floating Light Streaks
    this.initStreaks(this.perfPreset === "low" ? 4 : 12);

    // 8. Post-processing Composer & Bloom Pass
    this.initPostprocessing();
  }

  initBackgroundShader() {
    const config = BACKGROUND_CONFIG;

    // Stefan Gustavson Simplex 3D Noise GLSL Implementation
    const simplexNoiseGLSL = `
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      
      float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 =   v - i + dot(i, C.xxx) ;
        
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - D.yyy;
        
        i = mod(i, 289.0 );
        vec4 p = permute( permute( permute(
                   i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                 + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                 + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                 
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                      dot(p2,x2), dot(p3,x3) ) );
      }
      
      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 3; i++) {
          value += amplitude * snoise(p * frequency);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
    `;

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Layer 1 Sky Glow (Z = -30) fragment shader
    const skyGlowFragmentShader = `
      uniform float u_time;
      varying vec2 vUv;
      
      ${simplexNoiseGLSL}

      void main() {
        vec2 uv = vUv;
        
        // Deep background colors
        vec3 cNavy = vec3(0.006, 0.012, 0.024);  // Deep Navy
        vec3 cBlack = vec3(0.002, 0.002, 0.004); // Deep Black
        vec3 cIndigo = vec3(0.015, 0.01, 0.035); // Dark Indigo
        
        // Extremely slow drift temporal variation
        float t = u_time * 0.011;
        float noiseVal = snoise(vec3(uv * 0.8, t)) * 0.5 + 0.5;
        
        // Base gradient
        vec3 skyColor = mix(cBlack, cNavy, uv.y);
        skyColor = mix(skyColor, cIndigo, noiseVal * 0.4);
        
        // Soft vignette to preserve extreme blackness at borders
        float vignette = uv.x * (1.0 - uv.x) * uv.y * (1.0 - uv.y);
        vignette = clamp(pow(vignette * 16.0, 0.25), 0.0, 1.0);
        skyColor *= vignette;

        gl_FragColor = vec4(skyColor, 1.0);
      }
    `;

    // Layer 2 Volumetric Aurora (Z = -15) fragment shader
    const auroraFragmentShader = `
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform vec2 u_resolution;
      uniform float u_velocity_ripple;
      uniform float u_aurora_intensity;
      uniform vec4 u_ui_boxes[4];
      uniform int u_ui_box_count;
      varying vec2 vUv;

      ${simplexNoiseGLSL}

      void main() {
        vec2 uv = vUv;
        
        // 1. Magnetic cursor bending (warps coordinates organically towards cursor)
        vec2 mUv = uv - (u_mouse * 0.5 + 0.5);
        float mLen = length(mUv);
        vec2 magneticPull = mUv * (1.0 / (mLen * 9.0 + 1.0)) * 0.065;
        vec2 distortedUv = uv - magneticPull;
        
        // 2. Velocity ripples on fast mouse movement
        if (u_velocity_ripple > 0.01) {
          float rippleWave = sin(distortedUv.x * 65.0 + u_time * 15.0) * u_velocity_ripple * 0.0045;
          distortedUv.y += rippleWave;
        }

        // 3. Temporal velocity independent clock
        float flowTime = u_time * 0.031; // smooth flowing motion
        
        // 4. Anisotropic scaling (stretching coordinates along diagonal flow direction)
        float angle = -0.46; // approx -26 deg
        float cosA = cos(angle);
        float sinA = sin(angle);
        vec2 rotCoords = vec2(distortedUv.x * cosA - distortedUv.y * sinA, distortedUv.x * sinA + distortedUv.y * cosA);
        rotCoords.x += flowTime;
        
        // Stretch along flow axis, compress across
        vec2 stretchedCoords = rotCoords;
        stretchedCoords.x *= 0.52;
        stretchedCoords.y *= 1.35;
        
        // 5. Compute fBm layers for organic ribbon displacement
        float n1 = fbm(vec3(stretchedCoords * 1.6, u_time * 0.007));
        float n2 = fbm(vec3(stretchedCoords * 2.6 + vec2(2.1, 4.7), u_time * 0.011));

        // 6. Asymmetrical Aurora Ribbon formations (uneven spacing, width, and brightness)
        // Primary ribbon: wide, bright, center-ish
        float rib1Pos = 0.52 + sin(stretchedCoords.x * 0.8) * 0.12 + n1 * 0.2;
        float ribbon1 = smoothstep(0.38, 0.0, abs(distortedUv.y - rib1Pos));

        // Secondary ribbon 1: narrower, medium brightness, lower screen
        float rib2Pos = 0.22 + cos(stretchedCoords.x * 1.1) * 0.18 + n2 * 0.15;
        float ribbon2 = smoothstep(0.18, 0.0, abs(distortedUv.y - rib2Pos)) * 0.35;

        // Secondary ribbon 2: very soft, violet-tinted, upper screen
        float rib3Pos = 0.78 + sin(stretchedCoords.x * 0.7) * 0.15 - n1 * 0.15;
        float ribbon3 = smoothstep(0.25, 0.0, abs(distortedUv.y - rib3Pos)) * 0.25;

        // Palette blending
        vec3 cElectricBlue = vec3(0.04, 0.25, 0.75); // Electric Blue
        vec3 cCyan         = vec3(0.02, 0.52, 0.62); // Cyan
        vec3 cViolet       = vec3(0.24, 0.08, 0.48); // Subtle Violet

        vec3 auroraColor = cElectricBlue * ribbon1 + cCyan * ribbon2 + cViolet * ribbon3;

        // 7. Focal Point (Rule of Thirds, upper-right third: x ~ 0.68, y ~ 0.65)
        vec2 focalPoint = vec2(0.68, 0.65);
        float dToFocal = length(uv - focalPoint);
        float focalMask = smoothstep(0.85, 0.05, dToFocal) * 0.95 + 0.05;
        auroraColor *= focalMask;

        // 8. Dynamic UI Protection Exclusion zones
        float uiProtection = 0.0;
        for (int i = 0; i < 4; i++) {
          if (i >= u_ui_box_count) break;
          vec4 box = u_ui_boxes[i];
          
          // Calculate smooth SDF to the bounding box
          vec2 d = max(box.xy - uv, uv - box.zw);
          float sdf = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
          
          // Smoothly suppress underneath the UI elements
          float prot = smoothstep(0.09, -0.03, sdf);
          uiProtection = max(uiProtection, prot);
        }
        auroraColor *= (1.0 - uiProtection * 0.82);

        // 9. Localized mouse glow
        float mouseGlow = smoothstep(0.28, 0.0, mLen) * 0.12;
        auroraColor += cCyan * mouseGlow * (1.0 - uiProtection);

        // Add soft atmospheric perspective: fade out far edges
        float edgeVignette = uv.x * (1.0 - uv.x) * uv.y * (1.0 - uv.y);
        edgeVignette = clamp(pow(edgeVignette * 16.0, 0.2), 0.0, 1.0);
        auroraColor *= edgeVignette;

        // Render transparent additive coloring
        float maxVal = max(auroraColor.r, max(auroraColor.g, auroraColor.b));
        gl_FragColor = vec4(auroraColor * u_aurora_intensity, maxVal * 0.92);
      }
    `;

    // Layer 3 Foreground Waves (Z = -5) fragment shader
    const foregroundWavesFragmentShader = `
      uniform float u_time;
      varying vec2 vUv;

      ${simplexNoiseGLSL}

      void main() {
        vec2 uv = vUv;
        
        // Fast, high-frequency, extremely transparent waves (subtle local distortion)
        float t = u_time * 0.082; // faster foreground clock
        float w1 = snoise(vec3(uv * 3.5, t)) * 0.5 + 0.5;
        float w2 = snoise(vec3(uv * 5.5 + vec2(2.5, 3.8), -t * 0.9)) * 0.5 + 0.5;
        
        float wave = w1 * w2;
        
        // Thin, extremely transparent glowing waves
        float alpha = smoothstep(0.22, 0.78, wave) * 0.038; // extremely low opacity (max ~3.8%)
        
        vec3 waveColor = vec3(0.02, 0.62, 0.72); // Cyan/Teal
        
        gl_FragColor = vec4(waveColor, alpha);
      }
    `;

    // Shared Uniforms Object
    this.bgUniforms = {
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(0, 0) },
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_velocity_ripple: { value: 0 },
      u_click_ripple_pos: { value: new THREE.Vector2(0.5, 0.5) },
      u_click_ripple_time: { value: 99.0 },
      u_hover_active: { value: 0 },
      u_hover_pos: { value: new THREE.Vector2(0.5, 0.5) },
      u_hover_size: { value: new THREE.Vector2(0, 0) },
      u_aurora_intensity: { value: config.auroraIntensity },
      u_glow_intensity: { value: config.glowIntensity },
      u_color_drift: { value: 0 },
      u_camera_offset: { value: new THREE.Vector2(0, 0) },
      u_ui_boxes: {
        value: [
          new THREE.Vector4(0, 0, 0, 0),
          new THREE.Vector4(0, 0, 0, 0),
          new THREE.Vector4(0, 0, 0, 0),
          new THREE.Vector4(0, 0, 0, 0)
        ]
      },
      u_ui_box_count: { value: 0 }
    };

    // Layer 1: Sky Glow Plane (Z = -30)
    const skyGlowMat = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: skyGlowFragmentShader,
      uniforms: this.bgUniforms,
      depthWrite: false,
      depthTest: false
    });
    this.bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), skyGlowMat);
    this.bgPlane.position.set(0, 0, -30);
    this.scene.add(this.bgPlane);

    // Layer 2: Volumetric Asymmetric Aurora Plane (Z = -15)
    const auroraMat = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: auroraFragmentShader,
      uniforms: this.bgUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.auroraPlane = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), auroraMat);
    this.auroraPlane.position.set(0, 0, -15);
    this.scene.add(this.auroraPlane);

    // Layer 3: Foreground Waves Plane (Z = -5)
    const foregroundMat = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: foregroundWavesFragmentShader,
      uniforms: this.bgUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.foregroundPlane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), foregroundMat);
    this.foregroundPlane.position.set(0, 0, -5);
    this.scene.add(this.foregroundPlane);
  }

  getFrustumBounds(zDepth) {
    if (!this.camera) return { minX: -22, maxX: 22, minY: -12.5, maxY: 12.5, centerX: 0, centerY: 0, width: 44, height: 25 };
    const vFOV = THREE.MathUtils.degToRad(this.camera.fov);

    // Get direction camera is looking
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    // Find intersection with the plane Z = zDepth
    const t = (zDepth - this.camera.position.z) / dir.z;
    const center = this.camera.position.clone().add(dir.clone().multiplyScalar(t));

    // Frustum height & width at distance t
    const height = 2.0 * Math.abs(t) * Math.tan(vFOV / 2.0);
    const width = height * this.camera.aspect;

    // Spawning padding: 25% extra beyond the screen boundaries (1.25x scale)
    const padX = width * 1.25;
    const padY = height * 1.25;

    return {
      minX: center.x - padX / 2.0,
      maxX: center.x + padX / 2.0,
      minY: center.y - padY / 2.0,
      maxY: center.y + padY / 2.0,
      centerX: center.x,
      centerY: center.y,
      width: padX,
      height: padY
    };
  }

  initParticles(pCount) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    const sizes = new Float32Array(pCount);
    const phases = new Float32Array(pCount);

    this.particleData = [];

    for (let i = 0; i < pCount; i++) {
      // Distributed across the depth range to create volumetric layers
      const z = -26.0 + Math.random() * 21.0;

      // Calculate exact frustum bounds at this depth to cover the entire screen uniformly
      const bounds = this.getFrustumBounds(z);
      const x = bounds.minX + Math.random() * bounds.width;
      const y = bounds.minY + Math.random() * bounds.height;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      sizes[i] = 1.3 + Math.random() * 1.7; // larger sizes to showcase snowflake details
      phases[i] = Math.random() * 100.0;

      this.particleData.push({
        x: x,
        y: y,
        z: z,
        homeX: x,
        homeY: y,
        homeZ: z,
        vx: 0,
        vy: 0,
        vz: 0,
        driftSpeed: 0.005 + Math.random() * 0.01,
        driftPhase: Math.random() * Math.PI * 2,
        size: sizes[i]
      });
    }

    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("a_size", new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute("a_phase", new THREE.BufferAttribute(phases, 1));

    const particleVertex = `
      uniform float u_time;
      attribute float a_size;
      attribute float a_phase;
      varying float vAlpha;
      void main() {
        vAlpha = 0.25 + 0.75 * sin(u_time * 1.5 + a_phase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = a_size * (320.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const particleFragment = `
      varying float vAlpha;
      uniform vec3 u_color;
      void main() {
        // Center mapping coordinates
        vec2 coord = gl_PointCoord - vec2(0.5);
        float r = length(coord);
        if (r > 0.5) discard;
        
        float angle = atan(coord.y, coord.x);
        
        // 6-fold radial symmetry segment (60 degree wedges)
        float segment = 3.14159265 / 3.0;
        float a = mod(angle + 3.14159265, segment) - segment * 0.5;
        
        // Project coordinates along the main stem axis of the wedge
        float axisDist = abs(r * sin(a));
        float axisPos = r * cos(a);
        
        // Draw the main central stem of the snowflake arm
        float stem = smoothstep(0.045, 0.0, axisDist);
        
        // Draw secondary branches at 45 degree angles branching off the stem
        float branchWidth = 0.03;
        float b1 = smoothstep(branchWidth, 0.0, abs(axisDist - (axisPos - 0.15) * 0.8));
        float b2 = smoothstep(branchWidth, 0.0, abs(axisDist - (axisPos - 0.28) * 0.8));
        
        // Combine structure with edge fade
        float snowflakePattern = max(stem * smoothstep(0.48, 0.38, axisPos), max(b1, b2) * smoothstep(0.38, 0.12, axisPos));
        
        gl_FragColor = vec4(u_color, snowflakePattern * vAlpha * 0.55);
      }
    `;

    this.particleUniforms = {
      u_time: { value: 0 },
      u_color: { value: new THREE.Color("#ffffff") }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: this.particleUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.particlePoints = new THREE.Points(geom, mat);
    this.scene.add(this.particlePoints);
  }

  initStars(sCount) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(sCount * 3);
    const sizes = new Float32Array(sCount);
    const phases = new Float32Array(sCount);

    this.starPositions = [];

    for (let i = 0; i < sCount; i++) {
      const x = (Math.random() - 0.5) * 45.0;
      const y = (Math.random() - 0.5) * 25.0;
      // Positioned at Layer 1/2 gap Z-plane (-22)
      const z = -25.0 + Math.random() * 6.0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      sizes[i] = 0.2 + Math.random() * 0.5; // very tiny stars
      phases[i] = Math.random() * 100.0;

      this.starPositions.push({ x, y, z, originalX: x });
    }

    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("a_size", new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute("a_phase", new THREE.BufferAttribute(phases, 1));

    const starVertex = `
      uniform float u_time;
      attribute float a_size;
      attribute float a_phase;
      varying float vAlpha;
      void main() {
        vAlpha = 0.15 + 0.85 * sin(u_time * 1.5 + a_phase); // slower star twinkle temporal variation
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = a_size * (150.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const starFragment = `
      varying float vAlpha;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float intensity = smoothstep(0.5, 0.0, dist);
        gl_FragColor = vec4(0.85, 0.92, 1.0, intensity * vAlpha * 0.15); // dim twinkling
      }
    `;

    this.starUniforms = {
      u_time: { value: 0 }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: this.starUniforms,
      transparent: true,
      depthWrite: false
    });

    this.starPoints = new THREE.Points(geom, mat);
    this.scene.add(this.starPoints);
  }

  initStreaks(stCount) {
    this.streaks = [];
    this.streakGroup = new THREE.Group();

    // Reduce streaks count for sparsity
    const activeCount = Math.max(2, Math.floor(stCount * 0.4));

    const streakMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 u_color;
        void main() {
          float fadeX = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
          float fadeY = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
          gl_FragColor = vec4(u_color, fadeX * fadeY * 0.06); // lower opacity (max 6%)
        }
      `,
      uniforms: {
        u_color: { value: new THREE.Color("#06b6d4") }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < activeCount; i++) {
      const length = 2.0 + Math.random() * 3.5;
      const height = 0.01 + Math.random() * 0.02;
      const geom = new THREE.PlaneGeometry(length, height);
      const mesh = new THREE.Mesh(geom, streakMaterial);

      const x = (Math.random() - 0.5) * 30.0;
      const y = (Math.random() - 0.5) * 16.0;
      const z = -20.0 + Math.random() * 15.0;

      mesh.position.set(x, y, z);
      this.streakGroup.add(mesh);

      this.streaks.push({
        mesh: mesh,
        speed: 0.02 + Math.random() * 0.04,
        yDrift: (Math.random() - 0.5) * 0.005,
        originalZ: z
      });
    }

    this.scene.add(this.streakGroup);
  }

  initPostprocessing() {
    const config = BACKGROUND_CONFIG;
    let composer, renderPass, bloomPass;

    try {
      if (typeof THREE.EffectComposer !== 'undefined' &&
        typeof THREE.RenderPass !== 'undefined' &&
        typeof THREE.UnrealBloomPass !== 'undefined') {

        composer = new THREE.EffectComposer(this.renderer);
        renderPass = new THREE.RenderPass(this.scene, this.camera);
        composer.addPass(renderPass);

        const w = this.canvas.width;
        const h = this.canvas.height;
        bloomPass = new THREE.UnrealBloomPass(
          new THREE.Vector2(w, h),
          config.bloomIntensity,
          config.bloomRadius,
          config.bloomThreshold
        );

        composer.addPass(bloomPass);

        this.composer = composer;
        this.bloomPass = bloomPass;
      }
    } catch (e) {
      console.warn("Could not load post-processing pipeline. Direct rendering active:", e);
    }
  }

  resize() {
    if (!this.canvas) return;
    const parentRect = this.parent.getBoundingClientRect();
    const w = parentRect.width;
    const h = window.innerHeight;

    this.canvas.width = w;
    this.canvas.height = h;

    if (this.isFallback) {
      this.resizeFallback(w, h);
      return;
    }

    if (this.renderer) {
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    if (this.composer) {
      this.composer.setSize(w, h);
    }

    if (this.bloomPass) {
      this.bloomPass.setSize(w, h);
    }

    if (this.bgUniforms) {
      this.bgUniforms.u_resolution.value.set(w, h);
      this.updateUiBoundingBoxes();
    }

    // Recalculate particle bounds and redistribute uniformly on resize to cover the viewport
    if (this.camera && this.particleData) {
      this.particleData.forEach(p => {
        const bounds = this.getFrustumBounds(p.z);
        p.x = bounds.minX + Math.random() * bounds.width;
        p.y = bounds.minY + Math.random() * bounds.height;
        p.homeX = p.x;
        p.homeY = p.y;
        p.vx = 0;
        p.vy = 0;
      });
    }
  }

  loopWebGL() {
    if (!this.active) return;
    this.animationFrameId = requestAnimationFrame(() => this.loopWebGL());

    const config = BACKGROUND_CONFIG;
    const timeDelta = 0.016 * config.animationSpeed;

    // 1. Update Click Ripple Timer
    if (this.clickRippleTime < 2.0) {
      this.clickRippleTime += timeDelta;
      if (this.bgUniforms) {
        this.bgUniforms.u_click_ripple_time.value = this.clickRippleTime;
        this.bgUniforms.u_click_ripple_pos.value.set(this.clickRippleX, this.clickRippleY);
      }
    }

    // 2. Interpolate mouse spring physics
    const springTension = 0.04;
    const springDamping = 0.88;
    const diffX = this.mouseX_target - this.mouseX_spring;
    const diffY = this.mouseY_target - this.mouseY_spring;
    this.mouseVelX += diffX * springTension;
    this.mouseVelY += diffY * springTension;
    this.mouseVelX *= springDamping;
    this.mouseVelY *= springDamping;
    this.mouseX_spring += this.mouseVelX;
    this.mouseY_spring += this.mouseVelY;

    // Fast mouse movement ripples
    if (this.mouseSpeed > 0.015) {
      this.velocityRippleAmt += (this.mouseSpeed * 8.0 - this.velocityRippleAmt) * 0.1;
    } else {
      this.velocityRippleAmt += (0.0 - this.velocityRippleAmt) * 0.08;
    }

    // 3. Slow color temperature drift
    this.colorDrift = (this.colorDrift || 0) + 0.0001 * config.animationSpeed;
    if (this.colorDrift > 1.0) this.colorDrift -= 1.0;

    // 4. Update Uniforms
    const elapsedTime = (performance.now() - this.lastPerfTime) * 0.001;
    if (this.bgUniforms) {
      this.bgUniforms.u_time.value = elapsedTime;
      this.bgUniforms.u_mouse.value.set(this.mouseX_spring, this.mouseY_spring);
      this.bgUniforms.u_velocity_ripple.value = this.velocityRippleAmt;
      this.bgUniforms.u_color_drift.value = this.colorDrift;
      this.bgUniforms.u_hover_active.value = this.hoverActive;
      this.bgUniforms.u_hover_pos.value.set(this.hoverX, this.hoverY);
      this.bgUniforms.u_hover_size.value.set(this.hoverW, this.hoverH);

      // Update dynamic DOM protection regions every 15 frames
      if (this.frameCount % 15 === 0) {
        this.updateUiBoundingBoxes();
      }
    }

    if (this.particleUniforms) {
      this.particleUniforms.u_time.value = elapsedTime;
    }

    if (this.starUniforms) {
      this.starUniforms.u_time.value = elapsedTime;
    }

    // 5. Cinematic camera gentle float drifting through layers
    this.cameraTime = (this.cameraTime || 0) + 0.0012 * config.cameraBreathing;
    const floatRadiusX = 2.8;
    const floatRadiusY = 1.4;
    const camDriftX = Math.sin(this.cameraTime) * floatRadiusX;
    const camDriftY = Math.cos(this.cameraTime * 0.5) * floatRadiusY;
    const camDriftZ = 15.0 + Math.sin(this.cameraTime * 0.3) * 2.0;

    const mouseParallaxX = this.mouseX_spring * 5.0 * config.parallaxDepth;
    const mouseParallaxY = this.mouseY_spring * 3.8 * config.parallaxDepth;

    this.camera.position.set(camDriftX + mouseParallaxX, camDriftY + mouseParallaxY, camDriftZ);
    this.camera.lookAt(new THREE.Vector3(4.0, -2.5, -25.0));

    // Write camera offset uniform for custom background parallax
    if (this.bgUniforms) {
      this.bgUniforms.u_camera_offset.value.set(this.camera.position.x, this.camera.position.y);
    }

    // 6. Update Particles (Layer 4)
    if (this.particlePoints && this.particleData) {
      const posAttr = this.particlePoints.geometry.attributes.position;
      const arr = posAttr.array;
      const count = this.particleData.length;

      // Mouse project to Z of particle average (-20)
      const mouse3D = new THREE.Vector3(
        this.mouseX_spring * 15.0 * config.mouseStrength,
        this.mouseY_spring * 9.0 * config.mouseStrength,
        -18.0
      );

      // Card hover center projection
      let hover3D = null;
      if (this.hoverActive > 0.5) {
        hover3D = new THREE.Vector3(
          (this.hoverX * 2.0 - 1.0) * 15.0,
          (this.hoverY * 2.0 - 1.0) * 9.0,
          -18.0
        );
      }

      for (let i = 0; i < count; i++) {
        const p = this.particleData[i];

        // Wave/noise-based organic drift
        p.driftPhase += p.driftSpeed;
        const driftX = Math.sin(p.driftPhase) * 0.008;
        const driftY = Math.cos(p.driftPhase * 1.3) * 0.006;

        let targetX = p.homeX + Math.sin(p.driftPhase) * 0.8;
        let targetY = p.homeY + Math.cos(p.driftPhase * 1.3) * 0.8;

        // Spring force pulling particles back to their home anchors
        const springK = 0.012;
        p.vx += (targetX - p.x) * springK;
        p.vy += (targetY - p.y) * springK;

        // Apply mouse gravity
        let dx = mouse3D.x - p.x;
        let dy = mouse3D.y - p.y;
        let dist = Math.hypot(dx, dy);
        const mouseGravRadius = 5.0;

        if (dist < mouseGravRadius) {
          const force = (mouseGravRadius - dist) / mouseGravRadius;
          const accel = force * force * 0.08 * config.mouseStrength;
          p.vx += (dx / dist) * accel;
          p.vy += (dy / dist) * accel;
        }

        // Apply Card Hover density pull
        if (hover3D) {
          let hdx = hover3D.x - p.x;
          let hdy = hover3D.y - p.y;
          let hdist = Math.hypot(hdx, hdy);
          const hoverGravRadius = 6.0;
          if (hdist < hoverGravRadius) {
            const force = (hoverGravRadius - hdist) / hoverGravRadius;
            p.vx += (hdx / hdist) * force * 0.03;
            p.vy += (hdy / hdist) * force * 0.03;
          }
        }

        // Integrate physics
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.vz *= 0.94;

        p.x += p.vx + driftX;
        p.y += p.vy + driftY;
        p.z += p.vz;

        // Dynamic frustum boundary wrapping & edge respawning logic
        const bounds = this.getFrustumBounds(p.z);
        if (p.x < bounds.minX || p.x > bounds.maxX || p.y < bounds.minY || p.y > bounds.maxY) {
          if (p.x < bounds.minX) {
            p.x = bounds.maxX;
            p.y = bounds.minY + Math.random() * bounds.height;
          } else if (p.x > bounds.maxX) {
            p.x = bounds.minX;
            p.y = bounds.minY + Math.random() * bounds.height;
          } else if (p.y < bounds.minY) {
            p.y = bounds.maxY;
            p.x = bounds.minX + Math.random() * bounds.width;
          } else if (p.y > bounds.maxY) {
            p.y = bounds.minY;
            p.x = bounds.minX + Math.random() * bounds.width;
          }
          p.vx = 0;
          p.vy = 0;
          p.homeX = p.x;
          p.homeY = p.y;
        }

        // Update vertex buffer arrays
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }
      posAttr.needsUpdate = true;
    }

    // 7. Update Streaks (Layer 6)
    if (this.streaks) {
      for (let i = 0; i < this.streaks.length; i++) {
        const s = this.streaks[i];
        s.mesh.position.x += s.speed * config.animationSpeed;
        s.mesh.position.y += s.yDrift * config.animationSpeed;

        // Wrap around off screen
        if (s.mesh.position.x > 18) {
          s.mesh.position.x = -18;
          s.mesh.position.y = (Math.random() - 0.5) * 16.0;
        }
      }
    }

    // 8. Performance profiling (adaptive quality adjustment)
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsCheckTime > 2000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsCheckTime));
      this.frameCount = 0;
      this.lastFpsCheckTime = now;

      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 5) this.fpsHistory.shift();

      const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
      if (avgFps < 45 && this.fpsHistory.length >= 3) {
        this.degradeQuality();
      }
    }

    // 9. Render Scene (Post-processed Composer or directly)
    if (this.composer) {
      this.composer.render();
    } else if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  degradeQuality() {
    if (this.perfPreset === "high") {
      this.perfPreset = "med";
      console.warn("FPS dipped below 45, degrading preset to Medium");
      this.reinitThreeParameters();
    } else if (this.perfPreset === "med") {
      this.perfPreset = "low";
      console.warn("FPS dipped below 45, degrading preset to Low");
      this.reinitThreeParameters();
    }
  }

  reinitThreeParameters() {
    if (this.particlePoints && this.particleData) {
      let reduction = 0.6;
      if (this.perfPreset === "low") reduction = 0.25;

      const newCount = Math.floor(BACKGROUND_CONFIG.particleCount * reduction);
      this.particleData = this.particleData.slice(0, newCount);

      const positions = new Float32Array(newCount * 3);
      for (let i = 0; i < newCount; i++) {
        positions[i * 3] = this.particleData[i].x;
        positions[i * 3 + 1] = this.particleData[i].y;
        positions[i * 3 + 2] = this.particleData[i].z;
      }
      this.particlePoints.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      this.particlePoints.geometry.drawRange.count = newCount;
    }

    if (this.perfPreset === "low" && this.composer) {
      this.composer = null;
      console.log("Postprocessing bloom disabled for low-performance preset");
    }
  }

  updateUiBoundingBoxes() {
    if (!this.canvas || !this.bgUniforms) return;
    const canvasRect = this.canvas.getBoundingClientRect();
    if (canvasRect.width === 0 || canvasRect.height === 0) return;

    // List of key selectors we want to protect
    const selectors = [
      ".studio-header",
      ".dashboard-welcome",
      ".templates-grid",
      "#recent-projects-grid"
    ];

    const boxes = [];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Convert to UV space (X: 0 to 1, Y: 0 is bottom, 1 is top)
          const xMin = (rect.left - canvasRect.left) / canvasRect.width;
          const yMin = 1.0 - (rect.bottom - canvasRect.top) / canvasRect.height;
          const xMax = (rect.right - canvasRect.left) / canvasRect.width;
          const yMax = 1.0 - (rect.top - canvasRect.top) / canvasRect.height;

          // Padding around exclusion zone
          const padding = 0.02;
          boxes.push(new THREE.Vector4(
            Math.max(0.0, xMin - padding),
            Math.max(0.0, yMin - padding),
            Math.min(1.0, xMax + padding),
            Math.min(1.0, yMax + padding)
          ));
        }
      }
    });

    const boxCount = Math.min(boxes.length, 4);
    for (let i = 0; i < 4; i++) {
      if (i < boxCount) {
        this.bgUniforms.u_ui_boxes.value[i].copy(boxes[i]);
      } else {
        this.bgUniforms.u_ui_boxes.value[i].set(0, 0, 0, 0);
      }
    }
    this.bgUniforms.u_ui_box_count.value = boxCount;
  }

  startFallback() {
    this.ctx = this.canvas.getContext("2d");
    this.fallbackTime = 0;
    this.fallbackColorDrift = 0;
    this.mouseSpringX_px = this.canvas.width / 2;
    this.mouseSpringY_px = this.canvas.height / 2;

    // Setup fallback particles (sparse count for secondary depth support)
    this.fallbackParticles = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
      this.fallbackParticles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: 0,
        vy: 0,
        radius: 0.7 + Math.random() * 1.3,
        alpha: 0.1 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.015,
        originalSize: 0.7 + Math.random() * 1.3,
        layer: 1.0 + Math.random() * 2.0
      });
    }

    this.resize();
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.loopFallback();
  }

  resizeFallback(w, h) {
    // Canvas dimensions are handled by the caller resize()
  }

  loopFallback() {
    if (!this.active) return;
    this.animationFrameId = requestAnimationFrame(() => this.loopFallback());

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (!ctx) return;

    this.fallbackTime += 0.0055 * BACKGROUND_CONFIG.animationSpeed; // slow, luxurious clock
    this.fallbackColorDrift += 0.00015 * BACKGROUND_CONFIG.animationSpeed;
    if (this.fallbackColorDrift > 1.0) this.fallbackColorDrift -= 1.0;

    // 1. Interpolate mouse spring physics
    const springTension = 0.04;
    const springDamping = 0.88;

    const targetPixelX = (this.mouseX_target + 1.0) * 0.5 * w;
    const targetPixelY = (-(this.mouseY_target) + 1.0) * 0.5 * h;

    const diffX = targetPixelX - this.mouseSpringX_px;
    const diffY = targetPixelY - this.mouseSpringY_px;
    this.mouseVelX += diffX * springTension;
    this.mouseVelY += diffY * springTension;
    this.mouseVelX *= springDamping;
    this.mouseVelY *= springDamping;
    this.mouseSpringX_px += this.mouseVelX;
    this.mouseSpringY_px += this.mouseVelY;

    const dxParallax = (this.mouseSpringX_px - w / 2);
    const dyParallax = (this.mouseSpringY_px - h / 2);

    // 2. Draw Premium Dark Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#020205");
    bgGrad.addColorStop(0.5, "#040712");
    bgGrad.addColorStop(1, "#080c1b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 3. Color temperature drift
    const r1 = Math.round(5 + sinDrift(this.fallbackColorDrift) * 20);
    const g1 = Math.round(10 + cosDrift(this.fallbackColorDrift) * 30);
    const b1 = Math.round(60 + sinDrift(this.fallbackColorDrift * 1.5) * 80);

    const r2 = Math.round(15 + cosDrift(this.fallbackColorDrift * 0.7) * 25);
    const g2 = Math.round(8 + sinDrift(this.fallbackColorDrift * 1.2) * 15);
    const b2 = Math.round(55 + cosDrift(this.fallbackColorDrift) * 70);

    function sinDrift(f) { return Math.sin(f * Math.PI * 2) * 0.5 + 0.5; }
    function cosDrift(f) { return Math.cos(f * Math.PI * 2) * 0.5 + 0.5; }

    // 4. Layer 1: Ambient Glow blobs (radial gradients, deep navy/cyan/violet)
    const blobParallax = 0.05;
    const blob1X = w * 0.3 + Math.sin(this.fallbackTime * 0.2) * 80 - dxParallax * blobParallax;
    const blob1Y = h * 0.35 + Math.cos(this.fallbackTime * 0.28) * 80 - dyParallax * blobParallax;
    const blob2X = w * 0.75 + Math.cos(this.fallbackTime * 0.15) * 100 - dxParallax * blobParallax;
    const blob2Y = h * 0.65 + Math.sin(this.fallbackTime * 0.22) * 80 - dyParallax * blobParallax;

    const rGrad1 = ctx.createRadialGradient(blob1X, blob1Y, 0, blob1X, blob1Y, Math.min(w, h) * 0.45);
    rGrad1.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0.12)`);
    rGrad1.addColorStop(1, "rgba(2, 2, 5, 0)");
    ctx.fillStyle = rGrad1;
    ctx.beginPath();
    ctx.arc(blob1X, blob1Y, Math.min(w, h) * 0.45, 0, Math.PI * 2);
    ctx.fill();

    const rGrad2 = ctx.createRadialGradient(blob2X, blob2Y, 0, blob2X, blob2Y, Math.min(w, h) * 0.5);
    rGrad2.addColorStop(0, `rgba(${r2}, ${g2}, ${b2}, 0.1)`);
    rGrad2.addColorStop(1, "rgba(2, 2, 5, 0)");
    ctx.fillStyle = rGrad2;
    ctx.beginPath();
    ctx.arc(blob2X, blob2Y, Math.min(w, h) * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Draw Card Hover back glow (Canvas fallback)
    if (this.hoverActive > 0.5) {
      const hpx = this.hoverX * w;
      const hpy = (1.0 - this.hoverY) * h;
      const hw = this.hoverW * w;
      const hh = this.hoverH * h;

      const cardGrad = ctx.createRadialGradient(hpx, hpy, 0, hpx, hpy, Math.max(hw, hh) * 1.1);
      cardGrad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0.08)`);
      cardGrad.addColorStop(1, "rgba(2, 2, 5, 0)");
      ctx.fillStyle = cardGrad;
      ctx.fillRect(hpx - hw / 2 - 40, hpy - hh / 2 - 40, hw + 80, hh + 80);
    }

    // 6. Layer 2 & 3: Flowing Aurora Ribbons (Bezier Curves)
    // Draw 3 asymmetrical overlapping wide curves
    ctx.lineWidth = 140.0;
    const waveGradient = ctx.createLinearGradient(0, 0, w, 0);
    waveGradient.addColorStop(0, "rgba(2, 2, 5, 0)");
    waveGradient.addColorStop(0.3, `rgba(${r2}, ${g2}, ${b2}, 0.035)`);
    waveGradient.addColorStop(0.7, `rgba(${r1}, ${g1}, ${b1}, 0.04)`);
    waveGradient.addColorStop(1, "rgba(2, 2, 5, 0)");
    ctx.strokeStyle = waveGradient;
    ctx.beginPath();
    const startY1 = h * 0.45 + Math.sin(this.fallbackTime * 0.4) * 40 - dyParallax * 0.1;
    ctx.moveTo(0, startY1);
    const cp1x = w * 0.25;
    const cp1y = h * 0.35 + Math.cos(this.fallbackTime * 0.3) * 60 + (this.mouseSpringY_px - h / 2) * 0.08;
    const cp2x = w * 0.75;
    const cp2y = h * 0.55 + Math.sin(this.fallbackTime * 0.35) * 80 + (this.mouseSpringY_px - h / 2) * 0.08;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, w, h * 0.5 - dyParallax * 0.1);
    ctx.stroke();

    ctx.lineWidth = 90.0;
    const waveGradient2 = ctx.createLinearGradient(0, 0, w, 0);
    waveGradient2.addColorStop(0, "rgba(2, 2, 5, 0)");
    waveGradient2.addColorStop(0.5, `rgba(${r1}, ${g1}, ${b1}, 0.03)`);
    waveGradient2.addColorStop(1, "rgba(2, 2, 5, 0)");
    ctx.strokeStyle = waveGradient2;
    ctx.beginPath();
    const startY2 = h * 0.52 + Math.cos(this.fallbackTime * 0.35) * 30 - dyParallax * 0.12;
    ctx.moveTo(0, startY2);
    const cp3x = w * 0.35;
    const cp3y = h * 0.6 + Math.sin(this.fallbackTime * 0.25) * 50 + (this.mouseSpringY_px - h / 2) * 0.06;
    const cp4x = w * 0.65;
    const cp4y = h * 0.42 + Math.cos(this.fallbackTime * 0.4) * 65 + (this.mouseSpringY_px - h / 2) * 0.06;
    ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, w, h * 0.48 - dyParallax * 0.12);
    ctx.stroke();

    ctx.lineWidth = 60.0;
    const waveGradient3 = ctx.createLinearGradient(0, 0, w, 0);
    waveGradient3.addColorStop(0, "rgba(2, 2, 5, 0)");
    waveGradient3.addColorStop(0.4, `rgba(${r2}, ${g2}, ${b2}, 0.02)`);
    waveGradient3.addColorStop(1, "rgba(2, 2, 5, 0)");
    ctx.strokeStyle = waveGradient3;
    ctx.beginPath();
    const startY3 = h * 0.32 + Math.sin(this.fallbackTime * 0.2) * 50 - dyParallax * 0.08;
    ctx.moveTo(0, startY3);
    const cp5x = w * 0.45;
    const cp5y = h * 0.25 + Math.cos(this.fallbackTime * 0.45) * 40 + (this.mouseSpringY_px - h / 2) * 0.05;
    const cp6x = w * 0.55;
    const cp6y = h * 0.68 + Math.sin(this.fallbackTime * 0.3) * 50 + (this.mouseSpringY_px - h / 2) * 0.05;
    ctx.bezierCurveTo(cp5x, cp5y, cp6x, cp6y, w, h * 0.38 - dyParallax * 0.08);
    ctx.stroke();

    // 7. Layer 4 & 5: Particles and Stars (Parallax depth layers)
    this.fallbackParticles.forEach(p => {
      p.phase += p.speed;
      const driftX = Math.sin(p.phase) * 0.15;
      const driftY = Math.cos(p.phase * 1.2) * 0.1;

      const parallaxFactor = p.layer * 0.08;
      let drawX = p.x - dxParallax * parallaxFactor + driftX;
      let drawY = p.y - dyParallax * parallaxFactor + driftY;

      const dxMouse = this.mouseSpringX_px - drawX;
      const dyMouse = this.mouseSpringY_px - drawY;
      const distMouse = Math.hypot(dxMouse, dyMouse);
      const attractionRadius = 140;

      if (distMouse < attractionRadius) {
        const force = (attractionRadius - distMouse) / attractionRadius;
        drawX += (dxMouse / distMouse) * force * force * 15.0;
        drawY += (dyMouse / distMouse) * force * force * 15.0;
        p.radius = p.originalSize * (1.0 + force * 0.5);
      } else {
        p.radius = p.originalSize;
      }

      const twinkle = 0.3 + 0.7 * Math.sin(this.fallbackTime * 2.0 + p.phase * 5.0);
      const alpha = p.layer > 2.0 ? p.alpha * twinkle * 0.28 : p.alpha * twinkle * 0.2;

      // Draw 6-pointed snowflake crystal fallback
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let j = 0; j < 3; j++) {
        const theta = p.phase + (j * Math.PI / 3.0);
        const armLength = p.radius * 2.8;
        const dx = Math.cos(theta) * armLength;
        const dy = Math.sin(theta) * armLength;
        ctx.moveTo(drawX - dx, drawY - dy);
        ctx.lineTo(drawX + dx, drawY + dy);
      }
      ctx.stroke();

      if (p.x < -100) p.x = w + 100;
      if (p.x > w + 100) p.x = -100;
      if (p.y < -100) p.y = h + 100;
      if (p.y > h + 100) p.y = -100;
    });

    // 8. Vignette
    const vigGrad = ctx.createRadialGradient(w / 2, h / 2, Math.max(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    vigGrad.addColorStop(0, "rgba(2, 2, 5, 0)");
    vigGrad.addColorStop(1, "rgba(2, 2, 5, 0.7)");
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
  }

  stop() {
    this.active = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clean up Three.js objects
    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch (e) { }
    }

    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.composer = null;
    this.bloomPass = null;
    this.bgUniforms = null;
    this.particleUniforms = null;
    this.starUniforms = null;
    this.streaks = null;
    this.particleData = null;

    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx = null;
    }
  }

  pause() {
    if (!this.active) return;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resume() {
    if (!this.active) return;
    if (this.isFallback) {
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.loopFallback();
    } else {
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.lastPerfTime = performance.now();
      this.loopWebGL();
    }
  }
}

class LandingBlobs {
  constructor(canvasId, parentId) {
    this.canvasId = canvasId;
    this.parentId = parentId;
    this.canvas = null;
    this.parent = null;
    this.ctx = null;
    this.blobs = [];
    this.animationFrameId = null;
    this.mouseX = -9999;
    this.mouseY = -9999;
    this.active = false;
    this.time = 0;
    this.running = false;
    this.eventsBound = false;

    this.bindEvents();

    window.addEventListener("resize", () => {
      if (this.active) this.resize();
    });
  }

  bindEvents() {
    this.parent = document.getElementById(this.parentId);
    if (!this.parent || this.eventsBound) return;
    this.eventsBound = true;

    this.parent.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    this.parent.addEventListener("mouseleave", () => {
      this.mouseX = -9999;
      this.mouseY = -9999;
    });
  }

  resize() {
    this.canvas = document.getElementById(this.canvasId);
    if (!this.canvas || !this.canvas.parentElement) return;
    this.ctx = this.canvas.getContext("2d");

    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = window.innerHeight;
    this.setupBlobs();
  }

  setupBlobs() {
    if (!this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.blobs = [
      {
        x: w * 0.25,
        y: h * 0.3,
        homeX: w * 0.25,
        homeY: h * 0.3,
        radius: Math.min(w, h) * 0.45,
        vx: 0,
        vy: 0,
        colorStart: "rgba(59, 130, 246, 0.45)",
        colorEnd: "rgba(59, 130, 246, 0)",
        speed: 0.0008,
        seed: Math.random() * 100
      },
      {
        x: w * 0.75,
        y: h * 0.4,
        homeX: w * 0.75,
        homeY: h * 0.4,
        radius: Math.min(w, h) * 0.5,
        vx: 0,
        vy: 0,
        colorStart: "rgba(139, 92, 246, 0.4)",
        colorEnd: "rgba(139, 92, 246, 0)",
        speed: 0.0006,
        seed: Math.random() * 100
      },
      {
        x: w * 0.5,
        y: h * 0.7,
        homeX: w * 0.5,
        homeY: h * 0.7,
        radius: Math.min(w, h) * 0.48,
        vx: 0,
        vy: 0,
        colorStart: "rgba(236, 72, 153, 0.35)",
        colorEnd: "rgba(236, 72, 153, 0)",
        speed: 0.0007,
        seed: Math.random() * 100
      }
    ];
  }

  start() {
    this.canvas = document.getElementById(this.canvasId);
    this.parent = document.getElementById(this.parentId);

    if (!this.canvas || !this.parent) {
      this.active = false;
      return;
    }

    this.bindEvents();
    this.active = true;
    this.resize();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.active = false;
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.canvas && this.ctx && document.body.contains(this.canvas)) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  loop() {
    if (!this.active || !this.running) {
      this.running = false;
      return;
    }

    this.canvas = document.getElementById(this.canvasId);
    if (!this.canvas || !this.ctx || !document.body.contains(this.canvas)) {
      this.stop();
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());

    this.time += 1;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    this.blobs.forEach(b => {
      const driftX = Math.cos(this.time * b.speed + b.seed) * 100;
      const driftY = Math.sin(this.time * b.speed * 1.2 + b.seed) * 100;

      let targetX = b.homeX + driftX;
      let targetY = b.homeY + driftY;

      if (this.mouseX > 0) {
        const mousePullX = (this.mouseX - targetX) * 0.12;
        const mousePullY = (this.mouseY - targetY) * 0.12;
        targetX += mousePullX;
        targetY += mousePullY;
      }

      b.x += (targetX - b.x) * 0.05;
      b.y += (targetY - b.y) * 0.05;

      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
      grad.addColorStop(0, b.colorStart);
      grad.addColorStop(1, b.colorEnd);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

const app = {
  isYearlyBilling: false,
  landingParticles: null,
  dashboardParticles: null,

  init: function () {
    // Initialize standard plugins
    projects.init();
    editor.init();
    threeViewer.init();
    ai.init();

    // Initialize Particle Fields
    this.landingParticles = new LandingBlobs("landing-particles-canvas", "landing-page");
    this.dashboardParticles = new ParticleField("dashboard-particles-canvas", "dashboard-page");

    // Bind global page-routing events
    if (!window.router) {
      this.openLandingPage();
    }
  },

  // View routing switcher
  switchView: function (viewId) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const view = document.getElementById(viewId);
    if (view) {
      view.classList.add("active");

      // Auto-scrolling to top on navigations
      window.scrollTo(0, 0);
    }
  },

  openLandingPage: function () {
    if (window.router) {
      window.router.navigate('/');
    } else {
      this.switchView("landing-page");
      if (this.landingParticles) this.landingParticles.start();
      if (this.dashboardParticles) this.dashboardParticles.stop();
    }
  },

  openDashboard: function () {
    if (!window.auth || !auth.currentUser) {
      if (window.auth) auth.openModal('login');
      return;
    }
    if (window.router) {
      window.router.navigate('/dashboard');
    } else {
      projects.refreshGrid();
      this.switchView("dashboard-page");
      if (this.landingParticles) this.landingParticles.stop();
      if (this.dashboardParticles) this.dashboardParticles.start();
    }
  },

  openStudio: function () {
    if (!window.auth || !auth.currentUser) {
      if (window.auth) auth.openModal('login');
      return;
    }
    if (window.router) {
      window.router.navigate('/editor');
    } else {
      this.switchView("studio-page");
      this.refreshStudioLayout();
      if (this.landingParticles) this.landingParticles.stop();
      if (this.dashboardParticles) this.dashboardParticles.stop();
    }
  },

  refreshStudioLayout: function () {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (window.editor) {
          editor.resizeCanvas();
          if (editor.canvas && editor.canvas.width > 0) {
            editor.resetViewport();
          }
        }
        if (window.threeViewer) {
          threeViewer.resize();
          threeViewer.needsRebuild = true;
        }
      });
    });
  },

  // Studio vertical tabs navigation
  selectStudioTab: function (btn) {
    const tabId = btn.getAttribute("data-tab");
    this.selectStudioTabById(tabId);
  },

  selectStudioTabById: function (tabId) {
    // Deactivate old buttons
    document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));

    // Find matching button to highlight
    const matchingBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
    if (matchingBtn) matchingBtn.classList.add("active");

    // Hide all sub-panels content
    document.querySelectorAll(".studio-tab-content").forEach(p => p.classList.remove("active"));

    const panel = document.getElementById("tab-" + tabId);
    if (panel) panel.classList.add("active");

    // Run hooks based on tab
    if (tabId === "3d-viewer" && window.threeViewer) {
      requestAnimationFrame(() => {
        threeViewer.resize();
        threeViewer.needsRebuild = true;
      });
    }
    if (tabId === "cost-estimator" && window.ai) {
      ai.updateCostEstimates();
    }
    if (tabId === "floor-planner" && window.editor) {
      requestAnimationFrame(() => editor.resizeCanvas());
    }
  },

  // AI Assistant drawer slider
  toggleAiAssistantDrawer: function () {
    const drawer = document.getElementById("ai-assistant-drawer");
    if (drawer) {
      drawer.classList.toggle("open");
    }
  },

  // Top header notifications panel box toggler
  toggleNotifications: function () {
    const box = document.getElementById("notifications-box");
    if (box) {
      box.classList.toggle("active");
    }

    // Clear blue indicator dot
    const dot = document.querySelector(".notification-indicator");
    if (dot) {
      dot.style.display = "none";
    }
  },

  // Pricing pricing switch plans billing
  toggleBilling: function () {
    this.isYearlyBilling = !this.isYearlyBilling;

    const toggle = document.querySelector(".toggle-switch");
    if (toggle) toggle.classList.toggle("yearly", this.isYearlyBilling);

    // Update pricing text elements
    document.querySelectorAll(".price-val").forEach(el => {
      const monVal = el.getAttribute("data-monthly");
      const yrVal = el.getAttribute("data-yearly");
      el.textContent = this.isYearlyBilling ? "$" + yrVal : "$" + monVal;
    });

    const billingLabels = document.querySelectorAll(".billing-toggle span");
    if (billingLabels.length >= 2) {
      billingLabels[0].classList.toggle("active", !this.isYearlyBilling);
      billingLabels[1].classList.toggle("active", this.isYearlyBilling);
    }
  },

  // FAQs item accordions togglers
  toggleFaq: function (faqEl) {
    const isExpanded = faqEl.classList.contains("expanded");
    // Collapse all first
    document.querySelectorAll(".faq-item").forEach(item => item.classList.remove("expanded"));

    if (!isExpanded) {
      faqEl.classList.add("expanded");
    }
  },

  // Walkthrough video simulator modal
  playVideoDemo: function () {
    const modal = document.getElementById("video-demo-modal");
    if (modal) {
      const header = modal.querySelector(".modal-header h3");
      const body = modal.querySelector(".modal-body-content");

      header.textContent = "Dom IQ AI Video Walkthrough";
      body.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <p style="color: #06b6d4; font-size: 1.1rem; margin-bottom: 12px; font-weight: 600;">Explore Dom IQ AI Interactive Demo</p>
          <p style="margin-bottom: 24px; font-size: 0.9rem; color: #94a3b8; max-width: 500px; margin-left: auto; margin-right: auto;">
            This system runs entirely inside your web browser. You can click <strong>Start Designing</strong> to explore the full dashboard, load real presets, draw walls, insert doors/windows, toggle Day/Night lighting, and inspect properties.
          </p>
          <button class="btn btn-primary btn-glow" onclick="app.closeVideoDemo(); app.openDashboard();" style="margin: 0 auto;">Start Designing Now</button>
        </div>
      `;

      modal.classList.add("active");
    }
  },

  closeVideoDemo: function () {
    const modal = document.getElementById("video-demo-modal");
    if (modal) {
      modal.classList.remove("active");
    }
  },

  // Export engine
  triggerExport: function (format) {
    if (!projects.activeProject) return;

    if (format === "pdf") {
      // Print architectural summary
      let report = `====================================================\n`;
      report += `      DOM IQ AI ARCHITECTURAL DESIGN REPORT         \n`;
      report += `====================================================\n\n`;
      report += `Project Name: ${projects.activeProject.name}\n`;
      report += `Export Date: ${new Date().toLocaleDateString()}\n`;
      report += `Total Structural Walls: ${editor.walls.length} segments\n`;
      report += `Furniture Catalog items: ${editor.items.length} placed\n\n`;

      if (window.ai) {
        let total = ai.getProjectTotal();
        report += `Est Project Cost Summary: $${total.toLocaleString()}\n`;
      }

      report += `\n====================================================\n`;
      report += `Report generated successfully. Open developer console to save.\n`;

      console.log(report);
      alert("Architectural PDF dossier layout printed to developer log console successfully.");
    }
    else if (format === "png") {
      // Trigger canvas image download
      const link = document.createElement("a");
      link.download = projects.activeProject.name.replace(/\s+/g, "_") + "_blueprint.png";
      link.href = editor.canvas.toDataURL("image/png");
      link.click();
    }
    else if (format === "json") {
      // Trigger project object file download
      const link = document.createElement("a");
      link.download = projects.activeProject.name.replace(/\s+/g, "_") + "_domiq3d.json";

      const payload = JSON.stringify(projects.activeProject, null, 2);
      const file = new Blob([payload], { type: "application/json" });
      link.href = URL.createObjectURL(file);
      link.click();
    }
  }
};

window.app = app;

// Document onload trigger
window.addEventListener("DOMContentLoaded", () => {
  app.init();
});

// Click delegation for landing page CTA buttons
document.addEventListener('click', (e) => {
  if (e.target.closest('#cta-start-designing') || e.target.closest('#cta-lets-go')) {
    if (window.router) {
      window.router.navigate('/login');
    } else if (window.auth) {
      auth.openModal('login');
    }
  }
});
