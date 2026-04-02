/**
 * Phosphor — 3D Scene Engine
 * JSON in, navigable 3D scene out.
 * The layer between raw signal and visible light.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';


// ─── Post-Processing Shaders ────────────────────────────────────

const PASSTHROUGH_VERTEX = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ChromaticAberrationShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 0.003 },
    },
    vertexShader: PASSTHROUGH_VERTEX,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        varying vec2 vUv;
        void main() {
            vec2 dir = vUv - vec2(0.5);
            float d = length(dir);
            vec2 off = dir * offset * d;
            float r = texture2D(tDiffuse, vUv + off).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - off).b;
            gl_FragColor = vec4(r, g, b, 1.0);
        }`,
};

const ScanlinesShader = {
    uniforms: {
        tDiffuse: { value: null },
        count: { value: 300.0 },
        opacity: { value: 0.08 },
    },
    vertexShader: PASSTHROUGH_VERTEX,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float count;
        uniform float opacity;
        varying vec2 vUv;
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float scanline = sin(vUv.y * count * 3.14159) * 0.5 + 0.5;
            color.rgb -= scanline * opacity;
            gl_FragColor = color;
        }`,
};

const FilmGrainShader = {
    uniforms: {
        tDiffuse: { value: null },
        intensity: { value: 0.05 },
        time: { value: 0.0 },
    },
    vertexShader: PASSTHROUGH_VERTEX,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float intensity;
        uniform float time;
        varying vec2 vUv;
        float rand(vec2 co) {
            return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float noise = rand(vUv + time) * 2.0 - 1.0;
            color.rgb += noise * intensity;
            gl_FragColor = color;
        }`,
};



// ─── Themes ──────────────────────────────────────────────────────
// Each theme defines a palette (color name remapping) and atmosphere
// (background, ambient, bloom, fog defaults). Scene-level settings
// override theme values. Element-level colors always win.

const THEMES = {
    phosphor: {
        palette: {
            void:    '#000000',
            grid:    '#1a1a4e',
            cyan:    '#00ffff',
            orange:  '#ff6600',
            magenta: '#ff00ff',
            violet:  '#aa44ff',
            green:   '#00ff88',
            red:     '#ff2244',
            blue:    '#4488ff',
            yellow:  '#ffdd00',
            white:   '#ffffff',
            pink:    '#ff88cc',
        },
        atmosphere: {
            background: '#000000',
            ambient: '#111111',
            bloom: { strength: 1.5, radius: 0.4, threshold: 0.1 },
        },
    },
    ocean: {
        palette: {
            void:    '#000811',
            grid:    '#0a2a3e',
            cyan:    '#00bbcc',
            orange:  '#cc8844',
            magenta: '#8855aa',
            violet:  '#5566aa',
            green:   '#00aa77',
            red:     '#cc5544',
            blue:    '#2266cc',
            yellow:  '#ccaa44',
            white:   '#aaccdd',
            pink:    '#aa6688',
        },
        atmosphere: {
            background: '#000811',
            ambient: '#0a1520',
            bloom: { strength: 1.2, radius: 0.5, threshold: 0.15 },
            fog: { color: '#000811', near: 50, far: 140 },
        },
    },
    forest: {
        palette: {
            void:    '#020a00',
            grid:    '#0a2a10',
            cyan:    '#44cc88',
            orange:  '#cc8833',
            magenta: '#aa4488',
            violet:  '#665599',
            green:   '#22dd66',
            red:     '#cc4433',
            blue:    '#448866',
            yellow:  '#ddbb33',
            white:   '#ccddcc',
            pink:    '#cc8899',
        },
        atmosphere: {
            background: '#020a00',
            ambient: '#0a1a08',
            bloom: { strength: 1.3, radius: 0.5, threshold: 0.12 },
            fog: { color: '#020a00', near: 40, far: 120 },
        },
    },
    monochrome: {
        palette: {
            void:    '#000000',
            grid:    '#222222',
            cyan:    '#cccccc',
            orange:  '#aaaaaa',
            magenta: '#bbbbbb',
            violet:  '#999999',
            green:   '#bbbbbb',
            red:     '#888888',
            blue:    '#aaaaaa',
            yellow:  '#dddddd',
            white:   '#ffffff',
            pink:    '#cccccc',
        },
        atmosphere: {
            background: '#000000',
            ambient: '#111111',
            bloom: { strength: 1.4, radius: 0.4, threshold: 0.1 },
        },
    },
    sunset: {
        palette: {
            void:    '#0a0005',
            grid:    '#2a1028',
            cyan:    '#44aacc',
            orange:  '#ff8833',
            magenta: '#ee44aa',
            violet:  '#9944cc',
            green:   '#66bb55',
            red:     '#ff4444',
            blue:    '#6655cc',
            yellow:  '#ffcc22',
            white:   '#ffddcc',
            pink:    '#ff77aa',
        },
        atmosphere: {
            background: '#0a0005',
            ambient: '#1a0810',
            bloom: { strength: 1.8, radius: 0.5, threshold: 0.08 },
        },
    },
};

// Active palette — starts as phosphor, mutated by theme loading
let PALETTE = { ...THEMES.phosphor.palette };


// ─── Utility ──────────────────────────────────────────────────────

// Shared circular particle texture (generated once)
const _particleTexture = (() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
})();

function parseColor(c) {
    if (c in PALETTE) return new THREE.Color(PALETTE[c]);
    return new THREE.Color(c);
}

function toVec3(arr) {
    if (!arr) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(arr[0] || 0, arr[1] || 0, arr[2] || 0);
}


// ─── Easing Functions ─────────────────────────────────────────────
const EASING = {
    linear:      t => t,
    sine:        t => (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2,
    'ease-in':   t => t * t,
    'ease-out':  t => t * (2 - t),
    'ease-in-out': t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    bounce:      t => {
        const n1 = 7.5625, d1 = 2.75;
        if (t < 1/d1) return n1*t*t;
        if (t < 2/d1) return n1*(t-=1.5/d1)*t+.75;
        if (t < 2.5/d1) return n1*(t-=2.25/d1)*t+.9375;
        return n1*(t-=2.625/d1)*t+.984375;
    },
    elastic:     t => t === 0 || t === 1 ? t :
                      -Math.pow(2, 10*(t-1)) * Math.sin((t-1.1)*5*Math.PI),
};

function getEasing(name) {
    return EASING[name] || EASING.sine;
}


// ─── Animation Presets ────────────────────────────────────────────
const ANIMATION_PRESETS = {
    'spin':       [{ type: 'rotate', axis: 'y', speed: 1.0 }],
    'slow-spin':  [{ type: 'rotate', axis: 'y', speed: 0.3 }],
    'pulse':      [{ type: 'pulse', property: 'emissive', min: 1, max: 3, period: 2, easing: 'sine' }],
    'glow':       [{ type: 'pulse', property: 'opacity', min: 0.3, max: 0.8, period: 2, easing: 'sine' }],
    'bob':        [{ type: 'bob', height: 1, period: 3, easing: 'sine' }],
    'breathe':    [{ type: 'pulse', property: 'scale', min: 0.9, max: 1.1, period: 3, easing: 'sine' }],
    'drift':      [{ type: 'drift', speed: 0.5, range: 2 }],
    'flow':       [{ type: 'flow', speed: 1.0, period: 3 }],
    'fast-flow':  [{ type: 'flow', speed: 1.0, period: 1.5, count: 2 }],
    'trace':      [{ type: 'trace', speed: 1.0, period: 3, length: 0.15 }],
    'fast-trace': [{ type: 'trace', speed: 1.0, period: 1.5, length: 0.1 }],
};


// ─── Animation Manager ───────────────────────────────────────────
class AnimationManager {
    constructor() {
        this.entries = [];     // { object, animations[], baseState }
    }

    register(object, animateSpec) {
        if (!object || !animateSpec) return;

        // Normalize to array of animation configs
        let animations;
        if (typeof animateSpec === 'string') {
            animations = ANIMATION_PRESETS[animateSpec];
            if (!animations) {
                console.warn(`Phosphor: unknown animation preset "${animateSpec}"`);
                return;
            }
        } else if (Array.isArray(animateSpec)) {
            animations = animateSpec;
        } else {
            // Object with named animation types: { rotate: {...}, pulse: {...} }
            animations = Object.entries(animateSpec).map(([type, config]) => ({
                type,
                ...config,
            }));
        }

        // Capture base state for relative animations
        const baseState = {
            position: object.position.clone(),
            rotation: object.rotation.clone(),
            scale: object.scale.clone(),
            emissive: object.material?.emissiveIntensity ?? 1,
            opacity: object.material?.opacity ?? 1,
        };

        // Per-animation state (for drift noise, etc.)
        const animStates = animations.map(a => ({
            // Drift uses random offsets
            driftOffset: new THREE.Vector3(
                Math.random() * 1000,
                Math.random() * 1000,
                Math.random() * 1000,
            ),
            // Phase offset so not everything syncs
            phaseOffset: Math.random() * Math.PI * 2,
        }));

        this.entries.push({ object, animations, baseState, animStates });
    }

    update(elapsed) {
        for (const entry of this.entries) {
            const { object, animations, baseState, animStates } = entry;

            for (let i = 0; i < animations.length; i++) {
                const anim = animations[i];
                const state = animStates[i];
                this._applyAnimation(object, anim, baseState, state, elapsed);
            }
        }
    }

    _applyAnimation(obj, anim, base, state, time) {
        const t = time + state.phaseOffset;

        switch (anim.type) {
            case 'rotate': {
                const speed = anim.speed ?? 1.0;
                const axis = anim.axis || 'y';
                obj.rotation[axis] = base.rotation[axis] + time * speed;
                break;
            }

            case 'pulse': {
                const period = anim.period || 2;
                const easing = getEasing(anim.easing);
                const min = anim.min ?? 0.5;
                const max = anim.max ?? 2.0;
                // Oscillate: 0→1→0 over period using sine-like wave
                const phase = (t % period) / period;
                const wave = easing(phase);
                const value = min + (max - min) * wave;

                switch (anim.property) {
                    case 'emissive':
                        if (obj.material) obj.material.emissiveIntensity = value;
                        break;
                    case 'opacity':
                        if (obj.material) obj.material.opacity = value;
                        break;
                    case 'scale':
                        obj.scale.setScalar(value);
                        break;
                }
                break;
            }

            case 'bob': {
                const height = anim.height ?? 1;
                const period = anim.period || 3;
                const easing = getEasing(anim.easing);
                const phase = (t % period) / period;
                const wave = easing(phase);
                obj.position.y = base.position.y + wave * height;
                break;
            }

            case 'orbit': {
                const radius = anim.radius ?? 5;
                const speed = anim.speed ?? 1.0;
                const axis = anim.axis || 'y';
                const center = anim.center ? toVec3(anim.center) : base.position.clone();

                if (axis === 'y') {
                    obj.position.x = center.x + radius * Math.cos(time * speed);
                    obj.position.z = center.z + radius * Math.sin(time * speed);
                    obj.position.y = center.y;
                } else if (axis === 'x') {
                    obj.position.y = center.y + radius * Math.cos(time * speed);
                    obj.position.z = center.z + radius * Math.sin(time * speed);
                    obj.position.x = center.x;
                } else if (axis === 'z') {
                    obj.position.x = center.x + radius * Math.cos(time * speed);
                    obj.position.y = center.y + radius * Math.sin(time * speed);
                    obj.position.z = center.z;
                }
                break;
            }

            case 'drift': {
                const speed = anim.speed ?? 0.5;
                const range = anim.range ?? 2;
                const off = state.driftOffset;
                obj.position.x = base.position.x + Math.sin(time * speed + off.x) * range;
                obj.position.y = base.position.y + Math.sin(time * speed * 0.7 + off.y) * range * 0.5;
                obj.position.z = base.position.z + Math.sin(time * speed * 0.9 + off.z) * range;
                break;
            }

            case 'flow': {
                // Flow moves along a stored path curve
                const curve = state.flowCurve;
                if (!curve) break;
                const speed = anim.speed ?? 1.0;
                const period = anim.period ?? 3;
                const progress = ((t * speed / period) % 1 + 1) % 1; // 0→1 looping, uses t (includes phaseOffset)
                const point = curve.getPointAt(progress);
                obj.position.copy(point);
                break;
            }

            case 'trace': {
                // Trace slides a glowing streak along a path
                const traceLines = state.traceLines;
                const pts = state.sampledPoints;
                if (!traceLines || !pts) break;
                const speed = anim.speed ?? 1.0;
                const period = anim.period ?? 3;
                const length = anim.length ?? 0.15;
                const total = state.loopLength || (state.sampleCount + 1);
                const progress = ((t * speed / period) % 1 + 1) % 1;

                if (state.isClosed) {
                    // Closed path (ring): modular wrapping for seamless loops
                    for (const { geo, layer } of traceLines) {
                        const layerLength = length * layer.lengthMul;
                        const headIdx = Math.floor(progress * total);
                        const streakSize = Math.max(2, Math.floor(layerLength * total));
                        const posAttr = geo.attributes.position;

                        for (let i = 0; i < streakSize; i++) {
                            const srcIdx = ((headIdx - streakSize + i) % total + total) % total;
                            const pt = pts[srcIdx];
                            posAttr.setXYZ(i, pt.x, pt.y, pt.z);
                        }
                        posAttr.needsUpdate = true;
                        geo.setDrawRange(0, streakSize);
                    }
                } else {
                    // Open path (line/edge): grow in → full sweep → drain out → repeat
                    for (const { geo, layer } of traceLines) {
                        const layerLength = length * layer.lengthMul;
                        const streakSize = Math.max(2, Math.floor(layerLength * total));
                        // Extend progress range so the tail has room to drain off the end
                        const fullRange = total + streakSize;
                        const headRaw = Math.floor(progress * fullRange);
                        // Clamp head to path bounds, let tail advance past
                        const headIdx = Math.min(headRaw, total - 1);
                        const tailIdx = Math.max(0, headRaw - streakSize);
                        const startIdx = Math.min(tailIdx, total - 1);
                        const endIdx = headIdx;
                        const count = Math.max(0, endIdx - startIdx);
                        const posAttr = geo.attributes.position;

                        for (let i = 0; i < count; i++) {
                            const pt = pts[startIdx + i];
                            posAttr.setXYZ(i, pt.x, pt.y, pt.z);
                        }
                        posAttr.needsUpdate = true;
                        geo.setDrawRange(0, count);
                    }
                }
                break;
            }
        }
    }

    /**
     * Register a flow animation — creates a glowing particle that travels along a path.
     * Called by the line/edge renderers when they detect animate.flow or animate: "flow".
     */
    registerFlow(pathPoints, flowConfig, scene) {
        const config = typeof flowConfig === 'object' ? flowConfig : {};
        const color = config.color ? parseColor(config.color) : new THREE.Color('#ffffff');
        const size = config.size ?? 0.2;
        const emissive = config.emissive ?? 3;
        const speed = config.speed ?? 1.0;
        const period = config.period ?? 3;
        const count = config.count ?? 1;

        // Build curve from path points
        const curve = pathPoints.length >= 3
            ? new THREE.CatmullRomCurve3(pathPoints)
            : new THREE.LineCurve3(pathPoints[0], pathPoints[pathPoints.length - 1]);

        for (let i = 0; i < count; i++) {
            const geo = new THREE.IcosahedronGeometry(size, 2);
            const mat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: emissive,
                roughness: 0.2,
                metalness: 0.8,
            });
            const particle = new THREE.Mesh(geo, mat);
            const startPoint = curve.getPointAt(0);
            particle.position.copy(startPoint);
            scene.add(particle);

            const baseState = {
                position: startPoint.clone(),
                rotation: particle.rotation.clone(),
                scale: particle.scale.clone(),
                emissive: emissive,
                opacity: 1,
            };

            const phaseOffset = (i / count) * period; // stagger multiple particles

            this.entries.push({
                object: particle,
                animations: [{ type: 'flow', speed, period }],
                baseState,
                animStates: [{
                    driftOffset: new THREE.Vector3(),
                    phaseOffset: phaseOffset,
                    flowCurve: curve,
                }],
            });
        }
    }

    /**
     * Register a trace animation — a glowing streak that slides along a line path.
     * Creates layered line segments with decreasing opacity for a fade tail.
     */
    registerTrace(pathPoints, traceConfig, scene) {
        const config = typeof traceConfig === 'object' ? traceConfig : {};
        const color = config.color ? parseColor(config.color) : new THREE.Color('#ffffff');
        const speed = config.speed ?? 1.0;
        const period = config.period ?? 3;
        const length = config.length ?? 0.15; // fraction of path that's lit

        // Build curve and pre-sample densely
        const curve = pathPoints.length >= 3
            ? new THREE.CatmullRomCurve3(pathPoints)
            : new THREE.LineCurve3(pathPoints[0], pathPoints[pathPoints.length - 1]);

        const sampleCount = 200;
        const sampledPoints = curve.getPoints(sampleCount);

        // Detect closed path (ring, etc.) — first and last points nearly identical
        const first = sampledPoints[0];
        const last = sampledPoints[sampledPoints.length - 1];
        const isClosed = first.distanceTo(last) < 0.5;

        const loopLength = sampleCount + 1;

        // Create layered streak lines with writable vertex buffers
        const layers = [
            { opacityMul: 1.0,  lengthMul: 0.4 },  // bright head
            { opacityMul: 0.6,  lengthMul: 0.7 },  // mid
            { opacityMul: 0.3,  lengthMul: 1.0 },  // faint tail
        ];

        // Max vertices any single layer streak could need
        const maxStreakVerts = Math.ceil(length * loopLength) + 4;

        const traceLines = [];

        for (const layer of layers) {
            // Pre-allocate writable buffer (filled each frame)
            const positions = new Float32Array(maxStreakVerts * 3);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setDrawRange(0, 0);

            const mat = new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: layer.opacityMul,
            });

            const line = new THREE.Line(geo, mat);
            scene.add(line);
            traceLines.push({ line, geo, layer });
        }

        // Store sampled points for per-frame vertex writing
        this.entries.push({
            object: null,
            animations: [{ type: 'trace', speed, period, length }],
            baseState: { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3(1,1,1), emissive: 1, opacity: 1 },
            animStates: [{
                driftOffset: new THREE.Vector3(),
                phaseOffset: Math.random() * Math.PI * 2,
                traceLines,
                sampleCount,
                traceLength: length,
                isClosed,
                loopLength,
                sampledPoints,
            }],
        });
    }
}


// ─── Engine ───────────────────────────────────────────────────────
export class PhosphorEngine {
    constructor(container) {
        this.container = container;
        this.clock = new THREE.Clock();
        this.animations = new AnimationManager();

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(PALETTE.void);

        // Add target — where new objects get added (scene by default, parent mesh for children)
        this._addTarget = this.scene;

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(30, 20, 30);
        this.camera.lookAt(0, 0, 0);

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        container.appendChild(this.renderer.domElement);

        // CSS2D Renderer (labels)
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.left = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        container.appendChild(this.labelRenderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 500;

        // Post-processing
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(container.clientWidth, container.clientHeight),
            1.5,   // strength
            0.4,   // radius
            0.1    // threshold
        );
        this.composer.addPass(this.bloomPass);

        // Ambient light (very dim — objects earn their visibility)
        this.scene.add(new THREE.AmbientLight(0x111111));

        // Click-to-focus: raycaster + double-click handler
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();
        this._flyAnim = null;
        this._trackTarget = null;           // mesh being tracked
        this._prevTrackPos = new THREE.Vector3(); // last frame's world position
        this._worldPos = new THREE.Vector3();     // reusable vec for getWorldPosition
        this.renderer.domElement.addEventListener('dblclick', (e) => this._onDoubleClick(e));

        // Camera path state
        this._cameraPath = null;  // { waypoints, loop, elapsed, segmentIndex, active }

        // Post-processing effects (stored for dashboard access)
        this._filmGrainPass = null;
        this._chromaticPass = null;
        this._scanlinesPass = null;

        // Element ID registry (for timeline addressing)
        this._elementsById = {};

        // Timeline state
        this._timeline = null;

        // Dashboard (hidden by default, toggle with Tab)
        this._dashboard = null;
        this._frameCount = 0;
        this._lastFpsTime = 0;
        this._createDashboard();

        // Resize handling
        window.addEventListener('resize', () => this._onResize());
    }

    // ─── Scene Loading ────────────────────────────────────────────
    loadScene(spec) {
        // Theme resolution: theme preset → scene palette overrides → scene atmosphere overrides
        if (spec.scene) {
            // 1. Load theme preset (resets palette to theme's palette)
            const themeName = spec.scene.theme || 'phosphor';
            const theme = THEMES[themeName];
            if (theme) {
                PALETTE = { ...THEMES.phosphor.palette, ...theme.palette };
                // Apply theme atmosphere as defaults
                const atm = theme.atmosphere || {};
                if (atm.background) this.scene.background = parseColor(atm.background);
                if (atm.ambient) {
                    this.scene.children = this.scene.children.filter(c => !(c instanceof THREE.AmbientLight));
                    this.scene.add(new THREE.AmbientLight(parseColor(atm.ambient)));
                }
                if (atm.bloom) {
                    if (atm.bloom.strength !== undefined) this.bloomPass.strength = atm.bloom.strength;
                    if (atm.bloom.radius !== undefined) this.bloomPass.radius = atm.bloom.radius;
                    if (atm.bloom.threshold !== undefined) this.bloomPass.threshold = atm.bloom.threshold;
                }
                if (atm.fog) {
                    this.scene.fog = new THREE.Fog(
                        parseColor(atm.fog.color || '#000000'),
                        atm.fog.near || 80,
                        atm.fog.far || 300
                    );
                }
            } else {
                console.warn(`Phosphor: unknown theme "${themeName}"`);
            }

            // 2. Scene-level palette overrides (merge on top of theme)
            if (spec.scene.palette) {
                Object.assign(PALETTE, spec.scene.palette);
            }

            // 3. Scene-level atmosphere overrides (win over theme)
            if (spec.scene.background) {
                this.scene.background = parseColor(spec.scene.background);
            }
            if (spec.scene.fog) {
                const f = spec.scene.fog;
                this.scene.fog = new THREE.Fog(
                    parseColor(f.color || '#000000'),
                    f.near || 80,
                    f.far || 300
                );
            }
            if (spec.scene.bloom) {
                const b = spec.scene.bloom;
                if (b.strength !== undefined) this.bloomPass.strength = b.strength;
                if (b.radius !== undefined) this.bloomPass.radius = b.radius;
                if (b.threshold !== undefined) this.bloomPass.threshold = b.threshold;
            }
            if (spec.scene.ambient) {
                this.scene.children = this.scene.children.filter(c => !(c instanceof THREE.AmbientLight));
                this.scene.add(new THREE.AmbientLight(parseColor(spec.scene.ambient)));
            }

            // Post-processing effects (added after bloom in the composer chain)
            if (spec.scene.effects) {
                const fx = spec.scene.effects;

                if (fx.chromatic) {
                    const pass = new ShaderPass(ChromaticAberrationShader);
                    const cfg = typeof fx.chromatic === 'number' ? { offset: fx.chromatic } : fx.chromatic;
                    pass.uniforms.offset.value = cfg.offset || 0.003;
                    this._chromaticPass = pass;
                    this.composer.addPass(pass);
                }

                if (fx.scanlines) {
                    const pass = new ShaderPass(ScanlinesShader);
                    const cfg = typeof fx.scanlines === 'boolean' ? {} : fx.scanlines;
                    if (cfg.count !== undefined) pass.uniforms.count.value = cfg.count;
                    if (cfg.opacity !== undefined) pass.uniforms.opacity.value = cfg.opacity;
                    this._scanlinesPass = pass;
                    this.composer.addPass(pass);
                }

                if (fx.filmGrain) {
                    const pass = new ShaderPass(FilmGrainShader);
                    const cfg = typeof fx.filmGrain === 'boolean' ? {} : fx.filmGrain;
                    if (cfg.intensity !== undefined) pass.uniforms.intensity.value = cfg.intensity;
                    this._filmGrainPass = pass;
                    this.composer.addPass(pass);
                }

            }
        }

        // Camera config
        if (spec.camera) {
            if (spec.camera.position) {
                this.camera.position.copy(toVec3(spec.camera.position));
            }
            if (spec.camera.target) {
                this.controls.target.copy(toVec3(spec.camera.target));
                this.controls.update();
            }
            let projDirty = false;
            if (spec.camera.fov) { this.camera.fov = spec.camera.fov; projDirty = true; }
            if (spec.camera.near) { this.camera.near = spec.camera.near; projDirty = true; }
            if (spec.camera.far) { this.camera.far = spec.camera.far; projDirty = true; }
            if (projDirty) this.camera.updateProjectionMatrix();

            // Camera path — auto-play cinematic flythrough
            if (spec.camera.path && spec.camera.path.length >= 2) {
                this._startCameraPath(spec.camera.path, !!spec.camera.pathLoop);
            }
        }

        // Elements
        if (spec.elements) {
            for (const el of spec.elements) {
                this._addElement(el);
            }
        }

        // Timeline (loaded after elements so IDs are registered)
        if (spec.timeline) {
            this._startTimeline(spec.timeline);
        }
    }

    _addElement(el) {
        // Group type: invisible transform container (like Unity's empty GameObject)
        if (el.type === 'group') {
            return this._addGroup(el);
        }

        const fn = {
            grid:      (e) => this._addGrid(e),
            node:      (e) => this._addNode(e),
            edge:      (e) => this._addEdge(e),
            graph:     (e) => this._addGraph(e),
            label:     (e) => this._addLabel(e),
            particles: (e) => this._addParticles(e),
            terrain:   (e) => this._addTerrain(e),
            volume:    (e) => this._addVolume(e),
            line:      (e) => this._addLine(e),
            ring:      (e) => this._addRing(e),
            light:     (e) => this._addLight(e),
        }[el.type];

        if (!fn) {
            console.warn(`Phosphor: unknown element type "${el.type}"`);
            return;
        }

        const object = fn(el);

        // Register element by ID for timeline addressing
        if (el.id && object) {
            this._elementsById[el.id] = object;
        }

        // Process children — nest under this element's mesh
        if (el.children && object) {
            this._processChildren(el.children, object);
        }

        // Register animations if specified
        if (el.animate && object) {
            this.animations.register(object, el.animate);
        }

        // Flow and trace animations need special handling — they create/manage objects on a path
        if (el.animate) {
            const pathInfo = this._getElementPath(el);
            if (pathInfo && pathInfo.points.length >= 2) {
                // If local, add flow/trace as children of the element mesh; otherwise add to scene
                const parent = pathInfo.local && object ? object : this.scene;

                const flowConfig = this._extractPathAnimConfig(el.animate, 'flow');
                if (flowConfig) {
                    this.animations.registerFlow(pathInfo.points, flowConfig, parent);
                }

                const traceConfig = this._extractPathAnimConfig(el.animate, 'trace');
                if (traceConfig) {
                    this.animations.registerTrace(pathInfo.points, traceConfig, parent);
                }
            }
        }
    }

    // ─── Primitives ───────────────────────────────────────────────

    _addGrid(el) {
        const size = el.size || 100;
        const divisions = el.divisions || 20;
        const color = parseColor(el.color || 'grid');
        const opacity = el.opacity !== undefined ? el.opacity : 0.4;
        const pos = toVec3(el.position);

        const grid = new THREE.GridHelper(size, divisions, color, color);
        grid.material.opacity = opacity;
        grid.material.transparent = true;
        grid.material.depthWrite = false;
        grid.position.copy(pos);
        if (el.rotation) {
            grid.rotation.set(
                (el.rotation[0] || 0) * Math.PI / 180,
                (el.rotation[1] || 0) * Math.PI / 180,
                (el.rotation[2] || 0) * Math.PI / 180
            );
        }
        this._addTarget.add(grid);
        return grid;
    }

    _addNode(el) {
        const color = parseColor(el.color || 'orange');
        const size = el.size || 0.5;
        const pos = toVec3(el.position);
        const emissiveIntensity = el.emissive !== undefined ? el.emissive : 2.0;

        const geo = new THREE.IcosahedronGeometry(size, 2);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: emissiveIntensity,
            roughness: 0.2,
            metalness: 0.8,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        this._addTarget.add(mesh);

        // Optional point light to enhance glow
        if (el.glow !== false) {
            const light = new THREE.PointLight(color, el.glowIntensity || 1, el.glowRange || 10);
            light.position.copy(pos);
            this._addTarget.add(light);
        }

        return mesh;
    }

    _addEdge(el) {
        const color = parseColor(el.color || 'cyan');
        const opacity = el.opacity !== undefined ? el.opacity : 0.7;
        const from = toVec3(el.from);
        const to = toVec3(el.to);

        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const mat = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            linewidth: 1,
        });
        if (el.emissive) mat.color.multiplyScalar(el.emissive);
        const line = new THREE.Line(geo, mat);
        this._addTarget.add(line);
        return line;
    }

    _addGraph(el) {
        const nodes = el.nodes || [];
        const edges = el.edges || [];
        const basePos = toVec3(el.position);
        const nodeColor = el.nodeColor || 'orange';
        const edgeColor = el.edgeColor || 'cyan';
        const nodeSize = el.nodeSize || 0.4;
        const layout = el.layout || 'manual';

        // Position nodes
        const positions = [];
        if (layout === 'manual') {
            for (const n of nodes) {
                const p = toVec3(n.position).add(basePos);
                positions.push(p);
                this._addNode({
                    position: [p.x, p.y, p.z],
                    color: n.color || nodeColor,
                    size: n.size || nodeSize,
                    emissive: n.emissive,
                    glow: n.glow,
                    glowIntensity: n.glowIntensity || 0.3,
                    glowRange: n.glowRange || 5,
                });
                if (n.label) {
                    this._addLabel({
                        text: n.label,
                        position: [p.x, p.y + (n.size || nodeSize) + 0.8, p.z],
                        color: n.labelColor || n.color || nodeColor,
                        style: n.labelStyle || 'bracket',
                    });
                }
            }
        } else if (layout === 'tree') {
            this._layoutTree(nodes, edges, basePos, positions, nodeColor, nodeSize);
        }

        // Draw edges (routed through _addElement so flow animations work)
        // Only flow is supported on graph edges — trace is filtered out
        // because graph edges are too thin for trace streaks to read visually.
        const edgeAnimate = el.edgeAnimate || null;
        for (const e of edges) {
            const fromPos = positions[e.from] || toVec3(e.fromPos).add(basePos);
            const toPos = positions[e.to] || toVec3(e.toPos).add(basePos);
            const edgeSpec = {
                type: 'edge',
                from: [fromPos.x, fromPos.y, fromPos.z],
                to: [toPos.x, toPos.y, toPos.z],
                color: e.color || edgeColor,
                opacity: e.opacity,
            };
            // Per-edge animate overrides graph-level edgeAnimate (flow only, no trace)
            // Set animate: false on an edge to opt out of graph-level edgeAnimate
            const rawAnim = e.animate !== undefined ? e.animate : edgeAnimate;
            const anim = rawAnim === false ? null : this._filterGraphAnim(rawAnim);
            if (anim) edgeSpec.animate = anim;
            this._addElement(edgeSpec);
        }
    }

    _layoutTree(nodes, edges, basePos, positions, nodeColor, nodeSize) {
        // Simple tree layout: root at bottom, branches upward
        const adj = new Map();
        const hasParent = new Set();
        for (const e of edges) {
            if (!adj.has(e.from)) adj.set(e.from, []);
            adj.get(e.from).push(e.to);
            hasParent.add(e.to);
        }
        // Find roots
        const roots = [];
        for (let i = 0; i < nodes.length; i++) {
            if (!hasParent.has(i)) roots.push(i);
        }

        const levelHeight = nodes[0]?.levelHeight || 4;
        const spread = nodes[0]?.spread || 3;

        const layoutNode = (idx, x, z, level) => {
            const y = level * levelHeight;
            const pos = new THREE.Vector3(x + basePos.x, y + basePos.y, z + basePos.z);
            positions[idx] = pos;
            const n = nodes[idx] || {};
            this._addNode({
                position: [pos.x, pos.y, pos.z],
                color: n.color || nodeColor,
                size: n.size || nodeSize,
                emissive: n.emissive,
                glow: n.glow,
                glowIntensity: n.glowIntensity || 0.3,
                glowRange: n.glowRange || 5,
            });

            const children = adj.get(idx) || [];
            const totalWidth = (children.length - 1) * spread;
            children.forEach((child, i) => {
                const cx = x - totalWidth / 2 + i * spread;
                const cz = z + (Math.random() - 0.5) * spread * 0.3;
                layoutNode(child, cx, cz, level + 1);
            });
        };

        roots.forEach((r, i) => {
            layoutNode(r, i * spread * 3, 0, 0);
        });
    }

    _addLabel(el) {
        const text = el.text || '';
        const color = parseColor(el.color || 'red');
        const pos = toVec3(el.position);
        const style = el.style || 'default';

        const div = document.createElement('div');
        div.className = `phosphor-label style-${style}`;
        div.textContent = text;
        div.style.color = `#${color.getHexString()}`;
        if (style === 'default') {
            div.style.borderColor = `#${color.getHexString()}`;
        }

        const label = new CSS2DObject(div);
        label.position.copy(pos);
        this._addTarget.add(label);
        return label;
    }

    _addParticles(el) {
        const count = el.count || 500;
        const spread = el.spread || 100;
        const color = parseColor(el.color || 'white');
        const size = el.size || 0.15;
        const opacity = el.opacity !== undefined ? el.opacity : 0.6;
        const pos = toVec3(el.position);

        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * spread + pos.x;
            positions[i * 3 + 1] = (Math.random() - 0.5) * spread + pos.y;
            positions[i * 3 + 2] = (Math.random() - 0.5) * spread + pos.z;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: color,
            size: size,
            map: _particleTexture,
            transparent: true,
            opacity: opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geo, mat);
        this._addTarget.add(points);
        return points;
    }

    _addTerrain(el) {
        const width = el.width || 50;
        const depth = el.depth || 50;
        const segW = el.segments?.[0] || 40;
        const segD = el.segments?.[1] || 40;
        const color = parseColor(el.color || 'cyan');
        const opacity = el.opacity !== undefined ? el.opacity : 0.6;
        const pos = toVec3(el.position);
        const heightScale = el.heightScale || 5;
        const heightData = el.heights || null;

        const geo = new THREE.PlaneGeometry(width, depth, segW, segD);
        geo.rotateX(-Math.PI / 2);

        const verts = geo.attributes.position;
        for (let i = 0; i < verts.count; i++) {
            let h = 0;
            if (heightData && heightData[i] !== undefined) {
                h = heightData[i] * heightScale;
            } else {
                // Procedural rolling terrain
                const x = verts.getX(i);
                const z = verts.getZ(i);
                h = (Math.sin(x * 0.15) * Math.cos(z * 0.15) * 2 +
                     Math.sin(x * 0.3 + 1) * Math.cos(z * 0.2 + 2) * 1.5) * heightScale * 0.3;
            }
            verts.setY(i, h);
        }
        geo.computeVertexNormals();

        const wireframe = el.wireframe !== undefined ? el.wireframe : true;
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            wireframe: wireframe,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        this._addTarget.add(mesh);
        return mesh;
    }

    _addVolume(el) {
        const shape = el.shape || 'sphere';
        const color = parseColor(el.color || 'violet');
        const opacity = el.opacity !== undefined ? el.opacity : 0.1;
        const pos = toVec3(el.position);
        const size = el.size || 5;

        let geo;
        if (shape === 'sphere') {
            geo = new THREE.SphereGeometry(size, 32, 32);
        } else if (shape === 'box') {
            const s = Array.isArray(el.size) ? el.size : [size, size, size];
            geo = new THREE.BoxGeometry(s[0], s[1], s[2]);
        } else {
            geo = new THREE.SphereGeometry(size, 32, 32);
        }

        const mat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        this._addTarget.add(mesh);

        // Wireframe overlay (child of main mesh so it inherits animation transforms)
        if (el.wireframe !== false) {
            const wireMat = new THREE.MeshBasicMaterial({
                color: color,
                wireframe: true,
                transparent: true,
                opacity: opacity * 2,
            });
            const wireframe = new THREE.Mesh(geo.clone(), wireMat);
            mesh.add(wireframe);
        }

        return mesh;
    }

    _addLine(el) {
        const color = parseColor(el.color || 'cyan');
        const opacity = el.opacity !== undefined ? el.opacity : 0.8;
        const points = (el.points || []).map(p => toVec3(p));

        if (points.length < 2) return;

        let curve;
        if (el.curve && points.length >= 3) {
            curve = new THREE.CatmullRomCurve3(points);
            const curvePoints = curve.getPoints(el.segments || 50);
            const geo = new THREE.BufferGeometry().setFromPoints(curvePoints);
            const mat = new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: opacity,
            });
            if (el.emissive) mat.color.multiplyScalar(el.emissive);
            const line = new THREE.Line(geo, mat);
            this._addTarget.add(line);
            return line;
        } else {
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: opacity,
            });
            if (el.emissive) mat.color.multiplyScalar(el.emissive);
            const line = new THREE.Line(geo, mat);
            this._addTarget.add(line);
            return line;
        }
    }

    _addRing(el) {
        const color = parseColor(el.color || 'cyan');
        const innerRadius = el.innerRadius || 4.5;
        const outerRadius = el.outerRadius || 5;
        const opacity = el.opacity !== undefined ? el.opacity : 0.6;
        const pos = toVec3(el.position);
        const segments = el.segments || 64;

        const geo = new THREE.RingGeometry(innerRadius, outerRadius, segments);
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);

        // Default: horizontal ring (rotate to XZ plane)
        const rot = el.rotation || [-90, 0, 0];
        mesh.rotation.set(
            rot[0] * Math.PI / 180,
            rot[1] * Math.PI / 180,
            rot[2] * Math.PI / 180
        );

        this._addTarget.add(mesh);

        // Optional: add a torus (child of main mesh so it inherits animation transforms)
        if (el.tube) {
            const torusGeo = new THREE.TorusGeometry(
                (innerRadius + outerRadius) / 2,
                el.tube,
                16,
                segments
            );
            const torusMat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 1.0,
                transparent: true,
                opacity: opacity,
            });
            const torus = new THREE.Mesh(torusGeo, torusMat);
            mesh.add(torus);
        }

        return mesh;
    }

    _addLight(el) {
        const color = parseColor(el.color || 'white');
        const intensity = el.intensity || 1;
        const pos = toVec3(el.position);
        const kind = el.kind || 'point';

        let light;
        if (kind === 'point') {
            light = new THREE.PointLight(color, intensity, el.range || 50);
        } else if (kind === 'spot') {
            light = new THREE.SpotLight(color, intensity);
            light.angle = (el.angle || 30) * Math.PI / 180;
            light.penumbra = el.penumbra || 0.5;
            if (el.target) {
                light.target.position.copy(toVec3(el.target));
                this._addTarget.add(light.target);
            }
        } else if (kind === 'directional') {
            light = new THREE.DirectionalLight(color, intensity);
        }

        if (light) {
            light.position.copy(pos);
            this._addTarget.add(light);
        }

        // Optional visible helper sphere
        if (el.visible) {
            this._addNode({
                position: [pos.x, pos.y, pos.z],
                color: el.color || 'white',
                size: 0.2,
                emissive: 3,
                glow: false,
            });
        }

        return light;
    }

    // ─── Hierarchy ─────────────────────────────────────────────────

    /**
     * Group: invisible transform container (like Unity's empty GameObject).
     * Position, rotation, and animate apply to all children.
     */
    _addGroup(el) {
        const group = new THREE.Group();
        group.position.copy(toVec3(el.position));
        if (el.rotation) {
            group.rotation.set(
                (el.rotation[0] || 0) * Math.PI / 180,
                (el.rotation[1] || 0) * Math.PI / 180,
                (el.rotation[2] || 0) * Math.PI / 180
            );
        }
        this._addTarget.add(group);

        // Register element by ID for timeline addressing
        if (el.id) {
            this._elementsById[el.id] = group;
        }

        // Register group animations (spin, bob, orbit, etc.)
        if (el.animate) {
            this.animations.register(group, el.animate);
        }

        // Process children with group as their parent
        if (el.children) {
            this._processChildren(el.children, group);
        }

        return group;
    }

    /**
     * Process children — temporarily swap _addTarget so all child elements
     * get added to the parent mesh/group instead of the scene.
     */
    _processChildren(children, parent) {
        const prevTarget = this._addTarget;
        this._addTarget = parent;
        for (const child of children) {
            this._addElement(child);
        }
        this._addTarget = prevTarget;
    }

    // ─── Animation Helpers ──────────────────────────────────────────

    /**
     * Extract a path from any element type that has a natural path.
     * Returns { points, local } where:
     *   - points: array of Vector3
     *   - local: if true, points are in the element's local space (flow/trace should be children of the mesh)
     * Returns null if the element has no path concept.
     */
    _getElementPath(el) {
        switch (el.type) {
            case 'line':
                return { points: (el.points || []).map(p => toVec3(p)), local: false };
            case 'edge':
                return { points: [toVec3(el.from), toVec3(el.to)], local: false };
            case 'ring': {
                // Generate circular path in the ring's LOCAL space (XY plane, centered at origin)
                // Flow/trace objects will be children of the ring mesh, inheriting its position + rotation
                const r = ((el.innerRadius || 4.5) + (el.outerRadius || 5)) / 2;
                const segments = 64;
                const points = [];

                for (let i = 0; i <= segments; i++) {
                    const theta = (i / segments) * Math.PI * 2;
                    // Slight z offset (0.1) to float above the ring face and avoid z-fighting
                    points.push(new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), 0.1));
                }
                return { points, local: true };
            }
            default:
                return null;
        }
    }

    /**
     * Filter animation spec for graph edges — only flow is allowed, trace is stripped.
     * Returns the filtered spec, or null if nothing remains.
     */
    _filterGraphAnim(anim) {
        if (!anim) return null;
        // String presets
        if (typeof anim === 'string') {
            if (anim === 'trace' || anim === 'fast-trace') return null;
            return anim;
        }
        // Array format: filter out trace entries
        if (Array.isArray(anim)) {
            const filtered = anim.filter(a => a.type !== 'trace');
            return filtered.length > 0 ? filtered : null;
        }
        // Object format: remove trace key
        if (typeof anim === 'object') {
            if (anim.trace && !anim.flow) return null;
            if (anim.trace) {
                const { trace, ...rest } = anim;
                return Object.keys(rest).length > 0 ? rest : null;
            }
            return anim;
        }
        return anim;
    }

    _extractPathAnimConfig(animateSpec, type) {
        if (animateSpec === type) return {};
        if (typeof animateSpec === 'string' && ANIMATION_PRESETS[animateSpec]) {
            const presetAnims = ANIMATION_PRESETS[animateSpec];
            const match = presetAnims.find(a => a.type === type);
            return match || null;
        }
        if (Array.isArray(animateSpec)) {
            const match = animateSpec.find(a => a.type === type);
            return match || null;
        }
        if (typeof animateSpec === 'object' && animateSpec[type]) {
            return animateSpec[type];
        }
        return null;
    }

    // ─── Dashboard ─────────────────────────────────────────────

    _createDashboard() {
        // Inject CSS
        const style = document.createElement('style');
        style.textContent = `
            .ph-dash {
                position: absolute; right: 0; top: 0; bottom: 0; width: 280px;
                background: rgba(5,5,15,0.92); backdrop-filter: blur(12px);
                border-left: 1px solid rgba(255,255,255,0.08);
                transform: translateX(100%); transition: transform 0.3s ease;
                overflow-y: auto; overflow-x: hidden;
                font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
                color: #888; font-size: 11px; z-index: 10000;
                scrollbar-width: thin; scrollbar-color: #333 transparent;
            }
            .ph-dash.open { transform: translateX(0); }
            .ph-dash::-webkit-scrollbar { width: 4px; }
            .ph-dash::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
            .ph-dash-inner { padding: 12px 14px 20px; }
            .ph-section { margin-bottom: 16px; }
            .ph-section-title {
                font-size: 10px; font-weight: 600; letter-spacing: 1.5px;
                text-transform: uppercase; color: #555; margin-bottom: 8px;
                cursor: pointer; user-select: none;
                display: flex; align-items: center; gap: 6px;
            }
            .ph-section-title::before { content: '\\25BE'; font-size: 8px; color: #444; transition: transform 0.2s; }
            .ph-section.collapsed .ph-section-title::before { transform: rotate(-90deg); }
            .ph-section.collapsed .ph-section-body { display: none; }
            .ph-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
            .ph-label { color: #666; font-size: 10px; }
            .ph-value { color: #aaa; font-size: 10px; text-align: right; }
            .ph-slider-row { margin-bottom: 8px; }
            .ph-slider-header { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .ph-slider {
                -webkit-appearance: none; width: 100%; height: 3px;
                background: #1a1a2e; border-radius: 2px; outline: none;
            }
            .ph-slider::-webkit-slider-thumb {
                -webkit-appearance: none; width: 10px; height: 10px;
                background: #00ffff; border-radius: 50%; cursor: pointer;
            }
            .ph-slider::-moz-range-thumb {
                width: 10px; height: 10px; border: none;
                background: #00ffff; border-radius: 50%; cursor: pointer;
            }
            .ph-btn {
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                color: #aaa; font-family: inherit; font-size: 10px;
                padding: 6px 12px; min-height: 28px; min-width: 28px;
                border-radius: 3px; cursor: pointer;
                transition: background 0.15s, border-color 0.15s;
                display: inline-flex; align-items: center; justify-content: center;
            }
            .ph-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
            .ph-btn.active { border-color: #00ffff; color: #00ffff; }
            .ph-el-row {
                display: flex; align-items: center; gap: 6px;
                padding: 3px 0; cursor: pointer; transition: color 0.15s;
            }
            .ph-el-row:hover { color: #00ffff; }
            .ph-el-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
            .ph-el-name { font-size: 10px; flex: 1; }
            .ph-el-toggle { font-size: 9px; color: #444; cursor: pointer; padding: 2px 4px; }
            .ph-el-toggle:hover { color: #888; }
            .ph-timeline-bar {
                width: 100%; height: 6px; background: #1a1a2e;
                border-radius: 3px; margin: 6px 0; cursor: pointer; position: relative;
            }
            .ph-timeline-fill {
                height: 100%; background: #00ffff; border-radius: 3px;
                transition: width 0.1s linear; pointer-events: none;
            }
            .ph-timeline-controls { display: flex; gap: 6px; align-items: center; }
            .ph-hint {
                position: absolute; bottom: 12px; right: 12px; z-index: 9999;
                font-family: 'SF Mono', monospace; font-size: 10px; color: #333;
                pointer-events: none; transition: opacity 0.3s;
            }
            .ph-dash.open ~ .ph-hint { opacity: 0; }
            .ph-sep { height: 1px; background: rgba(255,255,255,0.05); margin: 12px 0; }
            .ph-info { color: #444; font-size: 10px; line-height: 1.5; }
        `;
        document.head.appendChild(style);

        // Build DOM
        const dash = document.createElement('div');
        dash.className = 'ph-dash';
        dash.innerHTML = `<div class="ph-dash-inner">
            <div class="ph-section" id="ph-info-section">
                <div class="ph-section-title">Info</div>
                <div class="ph-section-body">
                    <div class="ph-row"><span class="ph-label">FPS</span><span class="ph-value" id="ph-fps">--</span></div>
                    <div class="ph-row"><span class="ph-label">Elements</span><span class="ph-value" id="ph-el-count">--</span></div>
                    <div class="ph-row"><span class="ph-label">Camera</span><span class="ph-value" id="ph-cam-pos" style="font-size:9px">--</span></div>
                    <div style="margin-top:6px"><button class="ph-btn" id="ph-copy-cam">Copy Camera JSON</button></div>
                </div>
            </div>
            <div class="ph-sep"></div>
            <div class="ph-section" id="ph-bloom-section">
                <div class="ph-section-title">Bloom</div>
                <div class="ph-section-body">
                    <div class="ph-slider-row">
                        <div class="ph-slider-header"><span class="ph-label">Strength</span><span class="ph-value" id="ph-bloom-str-val"></span></div>
                        <input type="range" class="ph-slider" id="ph-bloom-str" min="0" max="5" step="0.1">
                    </div>
                    <div class="ph-slider-row">
                        <div class="ph-slider-header"><span class="ph-label">Radius</span><span class="ph-value" id="ph-bloom-rad-val"></span></div>
                        <input type="range" class="ph-slider" id="ph-bloom-rad" min="0" max="2" step="0.05">
                    </div>
                    <div class="ph-slider-row">
                        <div class="ph-slider-header"><span class="ph-label">Threshold</span><span class="ph-value" id="ph-bloom-thr-val"></span></div>
                        <input type="range" class="ph-slider" id="ph-bloom-thr" min="0" max="1" step="0.01">
                    </div>
                </div>
            </div>
            <div class="ph-sep"></div>
            <div class="ph-section" id="ph-fx-section">
                <div class="ph-section-title">Effects</div>
                <div class="ph-section-body" id="ph-fx-body"></div>
            </div>
            <div class="ph-sep"></div>
            <div class="ph-section" id="ph-tl-section" style="display:none">
                <div class="ph-section-title">Timeline</div>
                <div class="ph-section-body">
                    <div class="ph-timeline-controls">
                        <button class="ph-btn" id="ph-tl-play">&#9654;</button>
                        <button class="ph-btn" id="ph-tl-restart">&#8634;</button>
                        <span class="ph-value" id="ph-tl-time" style="flex:1;text-align:center">0.0s</span>
                        <span class="ph-value" id="ph-tl-dur"></span>
                    </div>
                    <div class="ph-timeline-bar" id="ph-tl-bar">
                        <div class="ph-timeline-fill" id="ph-tl-fill"></div>
                    </div>
                    <div class="ph-row">
                        <span class="ph-label">Speed</span>
                        <div style="display:flex;gap:4px">
                            <button class="ph-btn ph-speed" data-speed="0.25">0.25x</button>
                            <button class="ph-btn ph-speed" data-speed="0.5">0.5x</button>
                            <button class="ph-btn ph-speed active" data-speed="1">1x</button>
                            <button class="ph-btn ph-speed" data-speed="2">2x</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="ph-sep" id="ph-el-sep"></div>
            <div class="ph-section" id="ph-el-section">
                <div class="ph-section-title">Elements</div>
                <div class="ph-section-body" id="ph-el-list"></div>
            </div>
        </div>`;
        this.container.appendChild(dash);
        this._dashboard = dash;

        // Hint
        const hint = document.createElement('div');
        hint.className = 'ph-hint';
        hint.textContent = 'Tab \u2192 Dashboard';
        this.container.appendChild(hint);
        this._dashHint = hint;

        // Toggle with Tab
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                dash.classList.toggle('open');
                if (dash.classList.contains('open')) this._populateDashboard();
            }
        });

        // Section collapse
        dash.querySelectorAll('.ph-section-title').forEach(title => {
            title.addEventListener('click', () => {
                title.parentElement.classList.toggle('collapsed');
            });
        });

        // Bloom sliders
        const wire = (sliderId, valId, getter, setter) => {
            const slider = dash.querySelector(`#${sliderId}`);
            const valEl = dash.querySelector(`#${valId}`);
            slider.addEventListener('input', () => {
                const v = parseFloat(slider.value);
                setter(v);
                valEl.textContent = v.toFixed(2);
            });
        };
        wire('ph-bloom-str', 'ph-bloom-str-val', () => this.bloomPass.strength, v => { this.bloomPass.strength = v; });
        wire('ph-bloom-rad', 'ph-bloom-rad-val', () => this.bloomPass.radius, v => { this.bloomPass.radius = v; });
        wire('ph-bloom-thr', 'ph-bloom-thr-val', () => this.bloomPass.threshold, v => { this.bloomPass.threshold = v; });

        // Copy camera JSON
        dash.querySelector('#ph-copy-cam').addEventListener('click', () => {
            const p = this.camera.position;
            const t = this.controls.target;
            const json = JSON.stringify({
                position: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
                target: [+t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1)],
                fov: this.camera.fov
            }, null, 2);
            navigator.clipboard.writeText(json).then(() => {
                const btn = dash.querySelector('#ph-copy-cam');
                btn.textContent = 'Copied!';
                setTimeout(() => { btn.textContent = 'Copy Camera JSON'; }, 1500);
            });
        });

        // Timeline controls
        dash.querySelector('#ph-tl-play').addEventListener('click', () => {
            if (this._timeline) {
                if (this._timeline._paused) {
                    this._timeline._paused = false;
                    this.controls.enabled = false;
                } else {
                    this._timeline._paused = true;
                    this.controls.enabled = true;
                }
            }
        });
        dash.querySelector('#ph-tl-restart').addEventListener('click', () => {
            if (this._timeline) {
                this._timeline.elapsed = 0;
                this._timeline.firedSet.clear();
                this._timeline.activeTweens = [];
                this._timeline._paused = false;
                this.controls.enabled = false;
                // Re-hide fadeIn elements
                for (const e of this._timeline.events) {
                    if (e.type === 'fadeIn' && e.element) {
                        const obj = this._elementsById[e.element];
                        if (obj) this._setObjectOpacity(obj, 0);
                    }
                }
            }
        });

        // Timeline scrub bar
        dash.querySelector('#ph-tl-bar').addEventListener('click', (e) => {
            if (!this._timeline) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            this._timeline.elapsed = pct * this._timeline.totalDuration;
            this._timeline.firedSet.clear();
            this._timeline.activeTweens = [];
        });

        // Speed buttons
        this._timelineSpeed = 1;
        dash.querySelectorAll('.ph-speed').forEach(btn => {
            btn.addEventListener('click', () => {
                this._timelineSpeed = parseFloat(btn.dataset.speed);
                dash.querySelectorAll('.ph-speed').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    _populateDashboard() {
        const dash = this._dashboard;

        // Bloom values
        dash.querySelector('#ph-bloom-str').value = this.bloomPass.strength;
        dash.querySelector('#ph-bloom-str-val').textContent = this.bloomPass.strength.toFixed(2);
        dash.querySelector('#ph-bloom-rad').value = this.bloomPass.radius;
        dash.querySelector('#ph-bloom-rad-val').textContent = this.bloomPass.radius.toFixed(2);
        dash.querySelector('#ph-bloom-thr').value = this.bloomPass.threshold;
        dash.querySelector('#ph-bloom-thr-val').textContent = this.bloomPass.threshold.toFixed(2);

        // Effects sliders (dynamically built based on which passes exist)
        const fxBody = dash.querySelector('#ph-fx-body');
        fxBody.innerHTML = '';
        const addFxSlider = (label, value, min, max, step, onChange) => {
            const id = 'ph-fx-' + label.toLowerCase().replace(/\s+/g, '-');
            const row = document.createElement('div');
            row.className = 'ph-slider-row';
            row.innerHTML = `<div class="ph-slider-header"><span class="ph-label">${label}</span><span class="ph-value" id="${id}-val">${value.toFixed(3)}</span></div>
                <input type="range" class="ph-slider" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">`;
            fxBody.appendChild(row);
            row.querySelector(`#${id}`).addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                onChange(v);
                row.querySelector(`#${id}-val`).textContent = v.toFixed(3);
            });
        };

        if (this._chromaticPass) addFxSlider('Chromatic', this._chromaticPass.uniforms.offset.value, 0, 0.02, 0.001, v => { this._chromaticPass.uniforms.offset.value = v; });
        if (this._scanlinesPass) {
            addFxSlider('Scanline Count', this._scanlinesPass.uniforms.count.value, 0, 800, 10, v => { this._scanlinesPass.uniforms.count.value = v; });
            addFxSlider('Scanline Opacity', this._scanlinesPass.uniforms.opacity.value, 0, 0.3, 0.005, v => { this._scanlinesPass.uniforms.opacity.value = v; });
        }
        if (this._filmGrainPass) addFxSlider('Film Grain', this._filmGrainPass.uniforms.intensity.value, 0, 0.2, 0.005, v => { this._filmGrainPass.uniforms.intensity.value = v; });
        if (!this._chromaticPass && !this._scanlinesPass && !this._filmGrainPass) {
            fxBody.innerHTML = '<div class="ph-info">No effects active. Add "effects" to scene config.</div>';
        }

        // Timeline section
        const tlSection = dash.querySelector('#ph-tl-section');
        if (this._timeline) {
            tlSection.style.display = '';
            dash.querySelector('#ph-tl-dur').textContent = this._timeline.totalDuration.toFixed(1) + 's';
        }

        // Elements list
        const elList = dash.querySelector('#ph-el-list');
        elList.innerHTML = '';
        const ids = Object.keys(this._elementsById);
        if (ids.length === 0) {
            elList.innerHTML = '<div class="ph-info">No elements have IDs. Add "id" to elements.</div>';
            dash.querySelector('#ph-el-sep').style.display = 'none';
        } else {
            ids.forEach(id => {
                const obj = this._elementsById[id];
                const row = document.createElement('div');
                row.className = 'ph-el-row';
                row.innerHTML = `<div class="ph-el-dot" style="background:${obj.visible ? '#00ffff' : '#333'}"></div>
                    <span class="ph-el-name">${id}</span>
                    <span class="ph-el-toggle" title="Toggle visibility">${obj.visible ? '&#9673;' : '&#9675;'}</span>`;
                // Click name to focus
                row.querySelector('.ph-el-name').addEventListener('click', () => {
                    if (obj.isObject3D) this._focusOn(obj, obj.position);
                });
                // Click toggle for visibility
                row.querySelector('.ph-el-toggle').addEventListener('click', (e) => {
                    e.stopPropagation();
                    obj.visible = !obj.visible;
                    row.querySelector('.ph-el-dot').style.background = obj.visible ? '#00ffff' : '#333';
                    row.querySelector('.ph-el-toggle').innerHTML = obj.visible ? '&#9673;' : '&#9675;';
                });
                elList.appendChild(row);
            });
        }

        // Element count
        let count = 0;
        this.scene.traverse(() => count++);
        dash.querySelector('#ph-el-count').textContent = count;
    }

    _updateDashboardLive() {
        if (!this._dashboard || !this._dashboard.classList.contains('open')) return;

        // Camera position (every frame)
        const camEl = this._dashboard.querySelector('#ph-cam-pos');
        if (camEl) {
            const p = this.camera.position;
            camEl.textContent = `${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`;
        }

        // Timeline progress (every frame)
        if (this._timeline) {
            const timeEl = this._dashboard.querySelector('#ph-tl-time');
            const fillEl = this._dashboard.querySelector('#ph-tl-fill');
            const playBtn = this._dashboard.querySelector('#ph-tl-play');
            if (timeEl) timeEl.textContent = this._timeline.elapsed.toFixed(1) + 's';
            if (fillEl) fillEl.style.width = (this._timeline.elapsed / this._timeline.totalDuration * 100) + '%';
            // Only update play button when state changes (avoid per-frame innerHTML rewrite)
            if (playBtn) {
                const icon = this._timeline._paused ? '\u25B6' : '\u23F8';
                if (playBtn.textContent !== icon) playBtn.textContent = icon;
            }
        }
    }

    _updateDashboard(frameCount) {
        if (!this._dashboard) return;
        const fpsEl = this._dashboard.querySelector('#ph-fps');
        if (fpsEl) fpsEl.textContent = frameCount;
    }

    // ─── Render Loop ──────────────────────────────────────────────
    animate() {
        const loop = () => {
            requestAnimationFrame(loop);
            const delta = this.clock.getDelta();
            const elapsed = this.clock.elapsedTime;
            this.animations.update(elapsed);

            // Timeline playback (takes priority over camera path)
            this._updateTimeline(delta);

            // Camera path playback (only if no timeline active)
            if (!this._timeline) this._updateCameraPath(delta);

            // Track target: translate camera + controls by the object's frame delta
            // OrbitControls rotation works on top, so the user can orbit freely
            if (this._trackTarget) {
                this._trackTarget.getWorldPosition(this._worldPos);
                const dx = this._worldPos.x - this._prevTrackPos.x;
                const dy = this._worldPos.y - this._prevTrackPos.y;
                const dz = this._worldPos.z - this._prevTrackPos.z;
                this.controls.target.x += dx;
                this.controls.target.y += dy;
                this.controls.target.z += dz;
                this.camera.position.x += dx;
                this.camera.position.y += dy;
                this.camera.position.z += dz;
                this._prevTrackPos.copy(this._worldPos);
            }

            // Update time-dependent effects
            if (this._filmGrainPass) {
                this._filmGrainPass.uniforms.time.value = elapsed;
            }

            this.controls.update();
            this.composer.render();
            this.labelRenderer.render(this.scene, this.camera);

            // Dashboard updates (timeline/camera every frame, FPS every second)
            this._frameCount++;
            this._updateDashboardLive();
            if (elapsed - this._lastFpsTime >= 1) {
                this._updateDashboard(this._frameCount, elapsed);
                this._frameCount = 0;
                this._lastFpsTime = elapsed;
            }
        };
        loop();
    }

    // ─── Resize ───────────────────────────────────────────────────
    _onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.labelRenderer.setSize(w, h);
        this.composer.setSize(w, h);
        this.bloomPass.resolution.set(w, h);
    }

    // ─── Click-to-Focus ──────────────────────────────────────────

    _onDoubleClick(event) {
        // If camera path is active, break out of it first
        if (this._cameraPath && this._cameraPath.active) {
            this._cameraPath.active = false;
            this.controls.enabled = true;
            return;
        }

        // Convert mouse position to normalized device coordinates (-1 to +1)
        const rect = this.renderer.domElement.getBoundingClientRect();
        this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this._raycaster.setFromCamera(this._mouse, this.camera);
        const intersects = this._raycaster.intersectObjects(this.scene.children, true);

        // Find the first visible mesh (skip helpers, invisible objects, lines)
        let focused = false;
        for (const hit of intersects) {
            const obj = hit.object;
            if (!obj.visible) continue;
            if (obj instanceof THREE.Points) continue; // skip particle fields
            if (obj instanceof THREE.Line) continue;   // skip edges/lines

            this._focusOn(obj, hit.point);
            focused = true;
            break;
        }

        // Double-click empty space: break tracking
        if (!focused) {
            this._trackTarget = null;
        }
    }

    _focusOn(object, hitPoint) {
        // Calculate bounding radius for orbit distance
        const box = new THREE.Box3().setFromObject(object);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        const distance = Math.max(sphere.radius * 3, 2);

        // Clear any existing tracking/fly
        this._trackTarget = null;
        if (this._flyAnim) cancelAnimationFrame(this._flyAnim);

        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime = performance.now();
        const duration = 1.5;
        const center = new THREE.Vector3();
        const dir = new THREE.Vector3();

        const animate = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            const t = Math.min(elapsed / duration, 1);
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            // Recalculate target from object's CURRENT world position each frame
            const liveBox = new THREE.Box3().setFromObject(object);
            liveBox.getCenter(center);

            dir.subVectors(startPos, center).normalize();
            if (dir.lengthSq() < 0.001) dir.set(1, 0.5, 1).normalize();
            const camDest = center.clone().add(dir.clone().multiplyScalar(distance));

            this.camera.position.lerpVectors(startPos, camDest, ease);
            this.controls.target.lerpVectors(startTarget, center, ease);
            this.controls.update();

            if (t < 1) {
                this._flyAnim = requestAnimationFrame(animate);
            } else {
                this._flyAnim = null;
                this._trackTarget = object;
                object.getWorldPosition(this._prevTrackPos);
            }
        };
        animate();
    }

    // ─── Timeline ─────────────────────────────────────────────

    _startTimeline(spec) {
        const events = (spec.events || []).map(e => ({ ...e }));
        events.sort((a, b) => a.time - b.time);

        // Calculate total duration (latest event end)
        let totalDuration = 0;
        for (const e of events) {
            const end = e.time + (e.duration || 0);
            if (end > totalDuration) totalDuration = end;
        }

        this._timeline = {
            events,
            loop: !!spec.loop,
            elapsed: 0,
            totalDuration,
            firedSet: new Set(),
            activeTweens: [],
        };

        // Scan for fadeIn events and hide those elements at load
        for (const e of events) {
            if (e.type === 'fadeIn' && e.element) {
                const obj = this._elementsById[e.element];
                if (obj) this._setObjectOpacity(obj, 0);
            }
        }

        // Disable controls during timeline playback
        this.controls.enabled = false;

        // Any user interaction pauses the timeline (dashboard can resume)
        const pauseTimeline = () => {
            if (this._timeline && !this._timeline._paused) {
                this._timeline._paused = true;
                this.controls.enabled = true;
            }
        };
        this.renderer.domElement.addEventListener('pointerdown', pauseTimeline);
        this.renderer.domElement.addEventListener('wheel', pauseTimeline);
    }

    _updateTimeline(delta) {
        const tl = this._timeline;
        if (!tl || tl._paused) return;

        tl.elapsed += delta * (this._timelineSpeed || 1);

        // Fire events that have been reached
        for (let i = 0; i < tl.events.length; i++) {
            const e = tl.events[i];
            if (e.time <= tl.elapsed && !tl.firedSet.has(i)) {
                tl.firedSet.add(i);
                this._fireTimelineEvent(e, tl);
            }
        }

        // Update active tweens
        for (let i = tl.activeTweens.length - 1; i >= 0; i--) {
            const tw = tl.activeTweens[i];
            const t = Math.min((tl.elapsed - tw.startTime) / tw.duration, 1);
            const ease = getEasing(tw.easing)(t);
            tw.update(ease);
            if (t >= 1) {
                if (tw.onComplete) tw.onComplete();
                tl.activeTweens.splice(i, 1);
            }
        }

        // Check completion
        if (tl.elapsed >= tl.totalDuration && tl.activeTweens.length === 0) {
            if (tl.loop) {
                tl.elapsed = 0;
                tl.firedSet.clear();
                // Re-hide fadeIn elements for loop
                for (const e of tl.events) {
                    if (e.type === 'fadeIn' && e.element) {
                        const obj = this._elementsById[e.element];
                        if (obj) this._setObjectOpacity(obj, 0);
                    }
                }
            } else {
                tl._paused = true;
                this.controls.enabled = true;
            }
        }
    }

    _fireTimelineEvent(e, tl) {
        switch (e.type) {
            case 'camera': {
                const toPos = toVec3(e.position);
                const toTarget = toVec3(e.target);
                const dur = e.duration || 0;
                if (dur <= 0) {
                    this.camera.position.copy(toPos);
                    this.controls.target.copy(toTarget);
                    this.controls.update();
                } else {
                    const fromPos = this.camera.position.clone();
                    const fromTarget = this.controls.target.clone();
                    tl.activeTweens.push({
                        startTime: e.time,
                        duration: dur,
                        easing: e.easing || 'ease-in-out',
                        update: (ease) => {
                            this.camera.position.lerpVectors(fromPos, toPos, ease);
                            this.controls.target.lerpVectors(fromTarget, toTarget, ease);
                            this.controls.update();
                        },
                    });
                }
                break;
            }

            case 'set': {
                const obj = this._elementsById[e.element];
                if (!obj) break;
                if (e.property === 'visible') obj.visible = e.value;
                else if (e.property === 'opacity') this._setObjectOpacity(obj, e.value);
                else if (e.property === 'emissive') this._setObjectEmissive(obj, e.value);
                else if (e.property === 'position') obj.position.copy(toVec3(e.value));
                break;
            }

            case 'animate': {
                const from = e.from;
                const to = e.to;

                // Engine property target (bloom, effects)
                if (e.target) {
                    const setter = this._resolveTarget(e.target);
                    if (!setter) break;
                    tl.activeTweens.push({
                        startTime: e.time,
                        duration: e.duration || 1,
                        easing: e.easing || 'ease-in-out',
                        update: (ease) => setter(from + (to - from) * ease),
                    });
                    break;
                }

                // Element property
                const obj = this._elementsById[e.element];
                if (!obj) break;
                tl.activeTweens.push({
                    startTime: e.time,
                    duration: e.duration || 1,
                    easing: e.easing || 'ease-in-out',
                    update: (ease) => {
                        const val = from + (to - from) * ease;
                        if (e.property === 'opacity') this._setObjectOpacity(obj, val);
                        else if (e.property === 'emissive') this._setObjectEmissive(obj, val);
                        else if (e.property === 'scale') obj.scale.setScalar(val);
                    },
                });
                break;
            }

            case 'fadeIn': {
                const obj = this._elementsById[e.element];
                if (!obj) break;
                const dur = e.duration || 1;
                tl.activeTweens.push({
                    startTime: e.time,
                    duration: dur,
                    easing: e.easing || 'ease-in-out',
                    update: (ease) => this._setObjectOpacity(obj, ease),
                });
                break;
            }

            case 'fadeOut': {
                const obj = this._elementsById[e.element];
                if (!obj) break;
                const dur = e.duration || 1;
                tl.activeTweens.push({
                    startTime: e.time,
                    duration: dur,
                    easing: e.easing || 'ease-in-out',
                    update: (ease) => this._setObjectOpacity(obj, 1 - ease),
                    onComplete: () => { obj.visible = false; },
                });
                break;
            }
        }
    }

    // Set opacity on an object and all its descendant materials
    _setObjectOpacity(obj, value) {
        obj.traverse(child => {
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                for (const mat of mats) {
                    mat.transparent = true;
                    mat.opacity = value;
                }
            }
        });
        if (value > 0) obj.visible = true;
    }

    // Set emissive intensity on an object and all its descendant materials
    _setObjectEmissive(obj, value) {
        obj.traverse(child => {
            if (child.material && child.material.emissiveIntensity !== undefined) {
                child.material.emissiveIntensity = value;
            }
        });
    }

    // Resolve a target string like "bloom.strength" to a setter function
    _resolveTarget(target) {
        const targets = {
            'bloom.strength':    v => { this.bloomPass.strength = v; },
            'bloom.radius':      v => { this.bloomPass.radius = v; },
            'bloom.threshold':   v => { this.bloomPass.threshold = v; },
            'chromatic.offset':  v => { if (this._chromaticPass) this._chromaticPass.uniforms.offset.value = v; },
            'chromatic':         v => { if (this._chromaticPass) this._chromaticPass.uniforms.offset.value = v; },
            'scanlines.count':   v => { if (this._scanlinesPass) this._scanlinesPass.uniforms.count.value = v; },
            'scanlines.opacity': v => { if (this._scanlinesPass) this._scanlinesPass.uniforms.opacity.value = v; },
            'filmGrain':         v => { if (this._filmGrainPass) this._filmGrainPass.uniforms.intensity.value = v; },
            'filmGrain.intensity': v => { if (this._filmGrainPass) this._filmGrainPass.uniforms.intensity.value = v; },
        };
        const setter = targets[target];
        if (!setter) console.warn(`Phosphor: unknown animate target "${target}"`);
        return setter || null;
    }

    // ─── Camera Path ───────────────────────────────────────────

    _startCameraPath(waypoints, loop) {
        // Parse waypoints into internal format
        const parsed = waypoints.map(wp => ({
            position: toVec3(wp.position),
            target: toVec3(wp.target),
            duration: wp.duration || 3,
            easing: wp.easing || 'ease-in-out',
        }));

        this._cameraPath = {
            waypoints: parsed,
            loop,
            segmentIndex: 0,
            segmentElapsed: 0,
            active: true,
        };

        // Snap camera to first waypoint
        this.camera.position.copy(parsed[0].position);
        this.controls.target.copy(parsed[0].target);
        this.controls.update();

        // Disable orbit controls during path playback
        this.controls.enabled = false;

        // Any user interaction breaks out of the path
        const breakPath = () => {
            if (this._cameraPath && this._cameraPath.active) {
                this._cameraPath.active = false;
                this.controls.enabled = true;
            }
            this.renderer.domElement.removeEventListener('pointerdown', breakPath);
            this.renderer.domElement.removeEventListener('wheel', breakPath);
        };
        this.renderer.domElement.addEventListener('pointerdown', breakPath);
        this.renderer.domElement.addEventListener('wheel', breakPath);
    }

    _updateCameraPath(delta) {
        const path = this._cameraPath;
        if (!path || !path.active) return;

        const wp = path.waypoints;
        const idx = path.segmentIndex;

        // We're interpolating from wp[idx] to wp[idx + 1]
        if (idx >= wp.length - 1) {
            if (path.loop) {
                path.segmentIndex = 0;
                path.segmentElapsed = 0;
                return;
            }
            // Path complete — hand control back
            path.active = false;
            this.controls.enabled = true;
            return;
        }

        const from = wp[idx];
        const to = wp[idx + 1];
        const dur = to.duration;

        path.segmentElapsed += delta;
        const rawT = dur > 0 ? Math.min(path.segmentElapsed / dur, 1) : 1;
        const ease = getEasing(to.easing)(rawT);

        this.camera.position.lerpVectors(from.position, to.position, ease);
        this.controls.target.lerpVectors(from.target, to.target, ease);
        this.controls.update();

        if (rawT >= 1) {
            path.segmentIndex++;
            path.segmentElapsed = 0;
        }
    }

    _flyTo(targetPosition, targetLookAt, duration, onComplete) {
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime = performance.now();

        if (this._flyAnim) cancelAnimationFrame(this._flyAnim);

        const animate = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            const t = Math.min(elapsed / duration, 1);
            // Smooth ease-in-out
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            this.camera.position.lerpVectors(startPos, targetPosition, ease);
            this.controls.target.lerpVectors(startTarget, targetLookAt, ease);
            this.controls.update();

            if (t < 1) {
                this._flyAnim = requestAnimationFrame(animate);
            } else {
                this._flyAnim = null;
                if (onComplete) onComplete();
            }
        };
        animate();
    }
}
