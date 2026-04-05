# Phosphor

!!! ON GREETING, ALWAYS READ PHOSPHOR-GUIDE.md FIRST AND DEEPLY INGEST THE COMPOSITION MINDSET'S PRINCIPLES !!!

3D scene engine. Models describe scenes in JSON, the engine renders navigable 3D spaces with bloom, orbit controls, and a dark void aesthetic baked in as the default.

```
JSON spec  -->  PhosphorEngine.loadScene()  -->  WebGL + Bloom + CSS2D Labels
```

## In this repo

- **Engine:** `phosphor.js` — all 11 primitive renderers, post-processing pipeline, camera controls, palette system.
- **Entry point:** `index.html` — loads engine, fetches scene JSON from `?scene=` URL param.
- **CLI:** `phosphor` — opens scenes in browser, lists examples, exports self-contained HTML.
- **Docs:** `PHOSPHOR-GUIDE.md` (full composition guide + primitive reference), `README.md` (public-facing)
- **Examples:** `examples/` (JSON scene specs)
- **Tests/scratch:** `tmp/` (gitignored)

### Running

```bash
python3 -m http.server 8888
# http://localhost:8888                          (loads examples/hello.json)
# http://localhost:8888?scene=examples/foo.json  (loads specific scene)
```

### Exporting

```bash
./phosphor --export examples/sacred.json > sacred.html   # full path
./phosphor --export glitch > glitch.html                  # shorthand name
```

Produces a single HTML file with engine + scene inlined. Three.js loads from CDN (needs internet). Works standalone — double-click to open.

### When editing the engine

- Every primitive is a method on `PhosphorEngine`: `_addGrid()`, `_addNode()`, etc. Adding a new primitive means adding a renderer method and registering it in `_addElement()`.
- All positions are `[x, y, z]` arrays. Y is up.
- Colors accept hex strings or palette names (see `PALETTE` const at top of file).
- Emissive materials drive the bloom aesthetic. The `emissive` property on nodes controls glow intensity through the `UnrealBloomPass`.
- The CSS2D label renderer is a separate render pass overlaid on the WebGL canvas. Labels are HTML elements that always face the camera.
- After changes, reload the browser and verify `examples/hello.json` still renders correctly.

## Creative approach

**Start from the idea.** When building a new scene, begin with the vision — what does this scene want to be? What's the vibe, the subject, the feeling? Compose from Phosphor's primitives directly. Write a one-off script if the math demands it (helices, orbits, calculated layouts), but freestyle the composition. Imagine the scene first, then choose the tools. The best scenes (ICE, NERV, glitch, angel attack) were pure freestyles that emerged from creative exploration. 

**Use what serves the idea.** Phosphor has a large feature set — primitives, animations, effects, camera paths, timelines, element IDs, dashboard controls. The question for each feature is whether it serves the vision. A packed scene where every element earns its place is as valid as a quiet composition with only a few pieces. Choose features because the scene asks for them. Let the idea dictate the scope.

**Freestyle over templates.** Compose scenes by hand. Place each element with intention — why is this node here, what does this ring represent, why does this line curve this way? The weird specific details are what make scenes alive: pulsing red eye-nodes on Seele monoliths, HP bars on a .hack party, hand-placed RGB splits on a dimensional breach. Procedural scattering (`random.uniform()` to place 40 nodes) reads as exactly what it is. A scene with 30 hand-placed elements beats one with 200 randomly scattered ones.

## Composition mindset

Every element in a Phosphor scene exists in relationship to the space it holds within the void and every other element. Objects earn their visibility through emission, explicit lighting, and iconic layout design. 

Before placing anything, consider: does it add meaning?

Practically, this means:
- **The void is your canvas.** Black is active — it's the contrast that makes everything glow. Let objects float in it. Negative space is what makes the lit elements feel alive. Make color choices that will stand out against the darkness.
- **Bloom is the visibility system.** In a dark scene, bloom determines what feels present and what fades into the void. Elements that participate in bloom — nodes, tubes, particles, lines with emissive — carry visual weight. When placing an element, the first question is whether it needs bloom participation, and if so, give it a path: `emissive` on lines/edges, `tube` on rings.
- **Start from glow, dial back to taste.** Start with emissive 2 and opacity 0.4, then pull back until the element sits at the right level in the hierarchy. You find the right value faster from above than from below.
- **Color value and opacity are different tools.** Opacity controls presence — how much the element occupies the scene. Emissive controls energy — how alive it feels. A reference line at `opacity: 0.3, emissive: 2` has moderate presence but real energy. One at `opacity: 0.6` has strong presence but feels dead. Use both levers: opacity for how solid, emissive for how alive.
- **Saturate your colors for the void.** Desaturated colors (`#669966`, `#8899bb`) lose their identity against black even at decent opacity. Push saturation up (`#88cc88`, `#aabbdd`) — the void desaturates everything visually, so over-saturate at the source.
- **Hierarchy comes from emissive contrast.** A capital pin at emissive 2 next to a secondary pin at emissive 0 creates the same kind of read as a large node next to a small one — through glow as well as geometry. Layer both: size + emissive = clear hierarchy.
- **Color is information.** Use the palette semantically. Warm colors for important or active elements. Cool colors for structure, connections, boundaries. Green for organic or terrain. Consistency makes scenes readable.
- **Layers create depth.** Grid floor (ground reference), main elements (nodes, graphs), ambient fill (particles, volumes), framing (rings, lights). Each layer at a different opacity creates natural depth while keeping the scene clean.
- **Labels are overlays.** They always face the camera and stay at fixed size regardless of distance. Place them slightly above their associated node.

## Key architectural details

### Rendering pipeline
1. WebGL renderer (ACES filmic tone mapping, antialiasing)
2. EffectComposer: RenderPass → UnrealBloomPass → [optional effects: chromatic, scanlines, filmGrain]
3. CSS2DRenderer (HTML label overlay, separate pass)
4. OrbitControls (damped orbit, pan, zoom — disabled during camera path playback)

### Default aesthetic
- Background: pure black
- Ambient light: `#111111` (very dim — objects earn visibility)
- Bloom: strength 1.5, radius 0.4, threshold 0.1
- Nodes: IcosahedronGeometry with emissive MeshStandardMaterial + point light
- Particles: additive blending, depth write disabled
- Grid: transparent, low opacity, depth write disabled

### The 11 primitives
`grid`, `node`, `edge`, `graph`, `label`, `particles`, `terrain`, `volume`, `line`, `ring`, `light`

### Animation
Any element can have an `animate` property. String presets: `"spin"`, `"slow-spin"`, `"pulse"`, `"glow"`, `"bob"`, `"breathe"`, `"drift"`, `"flow"`, `"fast-flow"`, `"trace"`, `"fast-trace"`. Object/array format for full control over axis, speed, easing, period, min/max. Seven animation types: `rotate`, `pulse`, `bob`, `orbit`, `drift`, `flow`, `trace`. Seven easing functions: `linear`, `sine`, `ease-in`, `ease-out`, `ease-in-out`, `bounce`, `elastic`. Flow creates particles traveling along paths. Trace creates glowing streaks that sweep along paths. Both work on lines, edges, and rings. Rings loop seamlessly; open paths clamp. Full reference in PHOSPHOR-GUIDE.md § Animation.

### Graph layouts
- `"manual"` — each node has an explicit `position`
- `"tree"` — edges define parent-child. Roots at bottom, children branch upward. Control via `levelHeight` and `spread`.

### Hierarchy
Any element can have a `children` array — children inherit parent transforms. The `group` type is an invisible container (Unity's empty GameObject). Nesting is unlimited; animations compose at every level. Use `group` to spin/bob/orbit a collection of elements together.

### Flow on graph edges
Graph edges support flow animations via `edgeAnimate` (graph-level default) or per-edge `animate` (selective). Per-edge overrides graph-level. Trace is filtered out on graph edges — flow is the supported type because trace streaks lose legibility against thin lines.

### Themes and palette
Five built-in themes: `phosphor` (default), `ocean`, `forest`, `sunset`, `monochrome`. Set via `"theme": "ocean"` in the scene config. Each theme bundles a palette and atmosphere. Use palette names (`"cyan"`, `"orange"`, etc.) in elements to make them theme-aware. Hardcoded hex is absolute. Scene-level `palette`, `background`, `bloom`, `ambient` override the theme. Available palette names: `void`, `grid`, `cyan`, `orange`, `magenta`, `violet`, `green`, `red`, `blue`, `yellow`, `white`, `pink`.

### Camera paths
`camera.path` is an array of waypoints with `position`, `target`, `duration`, and optional `easing`. Auto-plays on load. `camera.pathLoop` for looping. OrbitControls disabled during playback. Any user interaction (click, scroll, double-click) breaks out and returns manual control. First waypoint `duration: 0` snaps to start position. Full reference in PHOSPHOR-GUIDE.md § Camera Paths.

### Post-processing effects
Three ShaderPass effects in `scene.effects`: `chromatic` (RGB channel offset, lens distortion), `scanlines` (CRT horizontal lines), `filmGrain` (animated noise). All optional, all stackable. Shorthand supported: `"chromatic": 0.003` or `"scanlines": true`. Applied after bloom in the composer chain. Full reference in PHOSPHOR-GUIDE.md § Effects.

### Timeline
Cinematic event system in `timeline` top-level key. Array of timed events that auto-play on load. Five event types: `camera` (fly to position/target), `set` (instant property change), `animate` (tween property from/to), `fadeIn` (auto-hides at load, fades in at time), `fadeOut` (fades to invisible). Elements referenced by `id` property. Animate events also accept `target` for engine properties (bloom.strength, chromatic.offset, scanlines.opacity, etc.) — keyframe post-processing over time with full easing. User interaction pauses (dashboard resumes). Loop support resets all state. Timeline takes priority over camera paths. Full reference in PHOSPHOR-GUIDE.md § Timeline.

### Element IDs
Any element can have an `"id"` string property. The engine stores a map of id → THREE.Object3D. Used by the timeline and dashboard to address specific elements for fades, property animation, visibility changes, and click-to-focus. Works on all element types including groups.

### Dashboard
Interactive control panel, hidden by default. Press `Tab` to toggle. Sections: Info (FPS, element count, camera position, Copy Camera JSON), Bloom (3 sliders), Effects (dynamic sliders for active post-processing passes), Timeline (play/pause/restart/scrub/speed 0.25x-2x — only shown if scene has a timeline), Elements (ID list with visibility toggles and click-to-focus). Dark translucent design with backdrop blur. Zero overhead when closed. Full reference in PHOSPHOR-GUIDE.md § Dashboard.

## Keeping docs in sync

When you change the engine (new primitives, new props, rendering behavior), update in order:
1. `PHOSPHOR-GUIDE.md` — full reference
2. `README.md` — only if the public pitch changes
