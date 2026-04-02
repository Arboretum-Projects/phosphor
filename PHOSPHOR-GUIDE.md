# Phosphor Composition Guide

> The layer between raw signal and visible light.
> JSON in, navigable 3D scene out.

---

## How It Works

Phosphor is a 3D scene engine built on Three.js. You describe a scene in JSON, and the engine renders it as a navigable 3D space with orbit controls, bloom post-processing, and a dark void aesthetic baked in as the default.

**The intelligence/execution split:** The model (or human) provides the creative intelligence: what to place, where, what color, how bright. The engine provides the execution: WebGL rendering, camera math, shading, bloom, depth, interaction. The model works entirely in JSON; the engine handles shaders and quaternions.

### Architecture

```
JSON spec
    |
    v
PhosphorEngine.loadScene(spec)
    |
    ├── Scene config (background, fog, bloom, ambient)
    ├── Camera config (position, target, fov)
    └── Elements[] --> _addElement() dispatcher
            |
            ├── grid      --> THREE.GridHelper
            ├── node      --> THREE.IcosahedronGeometry + emissive material + point light
            ├── edge      --> THREE.Line (BufferGeometry)
            ├── graph     --> collection of nodes + edges with layout
            ├── label     --> CSS2DObject (HTML overlay)
            ├── particles --> THREE.Points (additive blending)
            ├── terrain   --> THREE.PlaneGeometry (displaced vertices)
            ├── volume    --> THREE.SphereGeometry/BoxGeometry (transparent)
            ├── line      --> THREE.Line or CatmullRomCurve3
            ├── ring      --> THREE.RingGeometry (+ optional torus)
            └── light     --> THREE.PointLight/SpotLight/DirectionalLight
```

### Rendering Pipeline

1. **WebGL Renderer**. ACES filmic tone mapping, antialiasing, device pixel ratio
2. **Post-processing**. EffectComposer with RenderPass + UnrealBloomPass
3. **CSS2D Renderer**. HTML labels overlaid on the 3D scene (separate render pass)
4. **OrbitControls.** Damped camera interaction (orbit, pan, zoom)

The bloom pass is what makes the aesthetic work. Objects with high emissive intensity glow naturally. The dark scene forces everything to earn its visibility.

### Running

```bash
python3 -m http.server 8888
# Open http://localhost:8888
# Or:  http://localhost:8888?scene=examples/hello.json
```

### Exporting

Bundle a scene into a single, self-contained HTML file:

```bash
./phosphor --export examples/sacred.json > sacred.html
./phosphor --export glitch > glitch.html        # shorthand name
./phosphor -x hello > hello.html                # short flag
```

The exported file embeds the engine and scene JSON inline. Three.js loads from the CDN at runtime, so the recipient needs an internet connection. No local server required — double-click to open.

---

## JSON Spec Structure

Every Phosphor scene is a JSON object with four optional top-level keys:

```json
{
    "scene": { ... },
    "camera": { ... },
    "elements": [ ... ],
    "timeline": { ... }
}
```

### Scene Config

Controls the global environment.

```json
"scene": {
    "background": "#000000",
    "fog": { "color": "#000000", "near": 60, "far": 200 },
    "bloom": { "strength": 1.8, "radius": 0.4, "threshold": 0.1 },
    "ambient": "#111111"
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `theme` | string | `"phosphor"` | Theme preset: `"phosphor"`, `"ocean"`, `"forest"`, `"sunset"`, `"monochrome"` |
| `palette` | object | none | Override specific palette colors on top of the theme (e.g. `{"cyan": "#00dddd"}`) |
| `background` | color | theme default | Scene background color |
| `fog.color` | color | theme default | Fog color (use black for depth fade) |
| `fog.near` | number | `80` | Distance where fog starts |
| `fog.far` | number | `300` | Distance where fog is fully opaque |
| `bloom.strength` | number | theme default | Bloom intensity (higher = more glow) |
| `bloom.radius` | number | theme default | Bloom spread radius |
| `bloom.threshold` | number | theme default | Minimum brightness for bloom to kick in |
| `ambient` | color | theme default | Global ambient light color |

**Themes** bundle a palette (color name remapping) and an atmosphere (background, ambient, bloom, fog). Resolution order: theme preset → scene-level `palette` overrides → scene-level atmosphere overrides → element-level properties. Use palette names (`"cyan"`, `"orange"`) in elements to make them theme-aware. Hardcoded hex colors (`"#ff6600"`) are absolute and unaffected by themes.

| Theme | Character |
|-------|-----------|
| `phosphor` | Default. Neon on black, high bloom, the void canvas. |
| `ocean` | Deep blues and teals. Softer bloom, fog-heavy. |
| `forest` | Greens and amber. Earthy warmth, moderate fog. |
| `sunset` | Warm oranges and purples. High bloom, dramatic. |
| `monochrome` | Whites and grays. Clean, minimal. |

**Creating a custom theme from a scene:** Override the full palette and atmosphere without editing the engine. Start from any base theme and replace everything:

```json
"scene": {
    "theme": "phosphor",
    "palette": {
        "cyan": "#00ccaa", "orange": "#ee8833", "magenta": "#cc44aa",
        "violet": "#7755bb", "green": "#33cc66", "red": "#dd4444",
        "blue": "#3366bb", "yellow": "#ddaa33", "white": "#ddeedd",
        "pink": "#cc7799", "grid": "#112233"
    },
    "background": "#020808",
    "ambient": "#0a1210",
    "bloom": { "strength": 1.3, "radius": 0.5, "threshold": 0.12 }
}
```

**Adding a named theme to the engine:** Add an entry to the `THEMES` object in `phosphor.js`. Each theme has two keys:

- `palette` — remaps the 12 color names (`void`, `grid`, `cyan`, `orange`, `magenta`, `violet`, `green`, `red`, `blue`, `yellow`, `white`, `pink`)
- `atmosphere` — default `background`, `ambient`, `bloom` (`strength`, `radius`, `threshold`), and optional `fog` (`color`, `near`, `far`)

The phosphor theme's palette is the baseline. A new theme only needs to include colors that differ, but providing the full set keeps things explicit.

**Bloom tip:** `strength` is the main lever. 1.0 is subtle, 2.0 is dramatic, 3.0+ is overwhelming. Keep `threshold` low (0.1) so emissive materials bloom naturally.

### Camera Config

```json
"camera": {
    "position": [35, 25, 35],
    "target": [0, 5, 0],
    "fov": 60
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | [x, y, z] | `[30, 20, 30]` | Camera start position |
| `target` | [x, y, z] | `[0, 0, 0]` | Point the camera looks at (orbit center) |
| `fov` | number | `60` | Field of view in degrees |
| `path` | waypoint[] | none | Camera path waypoints for cinematic flythrough |
| `pathLoop` | boolean | `false` | Whether the camera path loops |

**Camera tip:** Position the camera at roughly 1.5x the scene radius, elevated at ~30-45 degrees. The user can orbit freely from there.

### Camera Paths

Define a sequence of waypoints and the camera auto-flies through them on load. Each waypoint specifies where the camera moves to and what it looks at.

```json
"camera": {
    "path": [
        { "position": [50, 30, 50], "target": [0, 10, 0], "duration": 0 },
        { "position": [0, 15, 40], "target": [0, 20, 0], "duration": 5, "easing": "ease-in-out" },
        { "position": [-30, 10, 20], "target": [0, 5, 0], "duration": 4, "easing": "ease-in-out" },
        { "position": [50, 30, 50], "target": [0, 10, 0], "duration": 5, "easing": "ease-in-out" }
    ],
    "pathLoop": true
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | [x,y,z] | required | Camera position at this waypoint |
| `target` | [x,y,z] | required | Point the camera looks at |
| `duration` | number | `3` | Seconds to travel from the previous waypoint to this one. `0` snaps instantly. |
| `easing` | string | `"ease-in-out"` | Easing function for the transition |

During path playback, OrbitControls are disabled. Click, scroll, or double-click anywhere to break out and take manual control. The path requires at least 2 waypoints.

**Path tip:** Set the first waypoint's `duration` to `0` to establish the starting position. End with the same position as the start for smooth looping.

### Effects

Post-processing effects applied after bloom. Configure via `scene.effects`.

```json
"scene": {
    "effects": {
        "chromatic": { "offset": 0.003 },
        "scanlines": { "count": 300, "opacity": 0.08 },
        "filmGrain": { "intensity": 0.05 }
    }
}
```

All effects are optional and stack in order: chromatic aberration → scanlines → film grain.

#### `chromatic`

RGB channel separation that increases toward the edges. Creates a lens distortion / broken monitor look.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `offset` | number | `0.003` | Separation strength. 0.002 is subtle, 0.005+ is aggressive. |

Shorthand: `"chromatic": 0.003` sets the offset directly.

#### `scanlines`

Horizontal CRT-style scan lines across the screen.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `count` | number | `300` | Number of lines across the screen height |
| `opacity` | number | `0.08` | Line darkness (0 = invisible, 0.2 = heavy) |

Shorthand: `"scanlines": true` uses defaults.

#### `filmGrain`

Animated noise overlay. Updates every frame for a living texture.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `intensity` | number | `0.05` | Noise strength. 0.03 is subtle, 0.1+ is heavy. |

Shorthand: `"filmGrain": true` uses defaults.

**Effects tip:** Chromatic aberration + scanlines + film grain creates a convincing retro CRT monitor look. For the glitch aesthetic, use aggressive chromatic (0.005+) with scanlines.

---

## Primitives

All positions are `[x, y, z]` arrays. Y is up. Colors accept hex strings (`"#ff6600"`) or palette names (`"cyan"`, `"orange"`, etc.). Any element can have an `id` property for timeline addressing (see § Timeline).

### Built-in Palette

| Name | Hex | Use for |
|------|-----|---------|
| `cyan` | `#00ffff` | Edges, rings, cool accents |
| `orange` | `#ff6600` | Primary nodes, warm accents |
| `magenta` | `#ff00ff` | Highlights, energy |
| `violet` | `#aa44ff` | Secondary structures, volumes |
| `green` | `#00ff88` | Terrain, organic elements |
| `red` | `#ff2244` | Alerts, outliers |
| `blue` | `#4488ff` | Calm nodes, relays |
| `yellow` | `#ffdd00` | Data points, small nodes |
| `pink` | `#ff88cc` | Soft accents |
| `white` | `#ffffff` | Particles, ambient |
| `grid` | `#1a1a4e` | Grid lines |

---

### grid

A flat wireframe reference plane. Grounds the scene.

```json
{
    "type": "grid",
    "size": 80,
    "divisions": 20,
    "color": "#1a1a6e",
    "opacity": 0.35,
    "position": [0, 0, 0],
    "rotation": [0, 0, 0]
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `size` | number | `100` | Total grid size (width and depth) |
| `divisions` | number | `20` | Number of grid cells per side |
| `color` | color | `"grid"` | Line color |
| `opacity` | number | `0.4` | Line transparency |
| `position` | [x,y,z] | `[0,0,0]` | Grid center position |
| `rotation` | [x,y,z] | `[0,0,0]` | Rotation in degrees |

**Tip:** Keep grid opacity low (0.2-0.4). It grounds the scene best when it's subtle.

---

### node

A glowing sphere in 3D space. The core visual primitive.

```json
{
    "type": "node",
    "position": [0, 5, 0],
    "color": "#ff6600",
    "size": 0.5,
    "emissive": 2.0,
    "glow": true,
    "glowIntensity": 1.0,
    "glowRange": 10
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | [x,y,z] | `[0,0,0]` | Node center |
| `color` | color | `"orange"` | Node color (also used for emissive) |
| `size` | number | `0.5` | Sphere radius |
| `emissive` | number | `2.0` | Emissive intensity (drives bloom glow) |
| `glow` | boolean | `true` | Whether to add a point light at the node |
| `glowIntensity` | number | `1.0` | Point light intensity |
| `glowRange` | number | `10` | Point light range |

**Tip:** `emissive` is what makes nodes glow through bloom. Values of 1-2 are standard, 3+ creates a hot spot. Set `glow: false` on dense clusters to avoid lighting overload.

---

### edge

A line connecting two points.

```json
{
    "type": "edge",
    "from": [0, 5, 0],
    "to": [10, 8, -5],
    "color": "#00ffff",
    "opacity": 0.7
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `from` | [x,y,z] | required | Start point |
| `to` | [x,y,z] | required | End point |
| `color` | color | `"cyan"` | Line color |
| `opacity` | number | `0.7` | Line transparency |
| `emissive` | number | none | Color intensity multiplier. Values above 1 push the line into bloom range — start with 2. |

---

### graph

A collection of nodes and edges, with optional automatic layout.

```json
{
    "type": "graph",
    "position": [0, 0, 0],
    "nodeColor": "#ff6600",
    "edgeColor": "#00cccc",
    "nodeSize": 0.4,
    "layout": "manual",
    "nodes": [
        { "position": [0, 0, 0], "color": "#ff6600", "size": 0.7, "label": "CORE", "emissive": 3 },
        { "position": [6, 3, 2], "color": "#00ff88", "label": "ALPHA" }
    ],
    "edges": [
        { "from": 0, "to": 1 }
    ]
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | [x,y,z] | `[0,0,0]` | Base position (offsets all nodes) |
| `nodeColor` | color | `"orange"` | Default node color |
| `edgeColor` | color | `"cyan"` | Default edge color |
| `nodeSize` | number | `0.4` | Default node size |
| `layout` | string | `"manual"` | Layout mode: `"manual"` or `"tree"` |
| `edgeAnimate` | animate | none | Default flow animation for all edges (flow only, trace is filtered) |

**Node properties** (inside `nodes` array):

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | [x,y,z] | required (manual) | Position relative to graph base |
| `color` | color | graph's `nodeColor` | Override color |
| `size` | number | graph's `nodeSize` | Override size |
| `label` | string | none | Text label above node |
| `labelColor` | color | node color | Label color override |
| `labelStyle` | string | `"bracket"` | Label style: `"default"`, `"bracket"`, `"minimal"` |
| `emissive` | number | `2.0` | Emissive intensity |

**Edge properties** (inside `edges` array):

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `from` | number | required | Source node index |
| `to` | number | required | Target node index |
| `color` | color | graph's `edgeColor` | Override color |
| `opacity` | number | `0.7` | Line transparency |
| `animate` | animate | graph's `edgeAnimate` | Per-edge flow animation (overrides graph-level `edgeAnimate`) |

**Flow on graph edges:** Graph edges support flow animations (glowing particles traveling along the edge). Set `edgeAnimate` on the graph for a default across all edges, or `animate` on individual edges for selective control. Set `"animate": false` on an edge to opt out of the graph-level default. Trace is not supported on graph edges because the streaks don't read visually against thin lines.

```json
{
    "type": "graph",
    "edgeAnimate": { "flow": { "color": "#44ffaa", "speed": 0.5, "period": 5 } },
    "edges": [
        { "from": 0, "to": 1 },
        { "from": 1, "to": 2, "animate": { "flow": { "color": "#ff6600" } } },
        { "from": 2, "to": 3, "animate": false }
    ]
}
```

**Tree layout:** Set `layout: "tree"`. Edges define parent-child relationships. Roots (nodes with no incoming edges) start at the base. Children branch upward. Control spacing via `levelHeight` and `spread` on the first node.

---

### label

Text anchored in 3D space, rendered as an HTML overlay.

```json
{
    "type": "label",
    "text": "OUTPOST",
    "position": [20, 2, -15],
    "color": "#ff2244",
    "style": "bracket"
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `text` | string | `""` | Label text |
| `position` | [x,y,z] | `[0,0,0]` | Position in 3D space |
| `color` | color | `"red"` | Text and border color |
| `style` | string | `"default"` | `"default"` (bordered), `"bracket"` (corner brackets), `"minimal"` (text only) |

**Tip:** Labels are HTML overlays rendered on top of the 3D scene. They always face the camera and stay at fixed size regardless of distance. Place them slightly above their associated node.

---

### particles

An ambient field of glowing points. Stars, dust, data streams.

```json
{
    "type": "particles",
    "count": 400,
    "spread": 120,
    "color": "#ffffff",
    "size": 0.08,
    "opacity": 0.4,
    "position": [0, 30, 0]
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `count` | number | `500` | Number of particles |
| `spread` | number | `100` | Size of the volume particles fill |
| `color` | color | `"white"` | Particle color |
| `size` | number | `0.15` | Particle size |
| `opacity` | number | `0.6` | Particle transparency |
| `position` | [x,y,z] | `[0,0,0]` | Center of the particle volume |

**Tip:** Use additive blending (built in) to create light accumulation. White particles at low opacity look like stars. Colored particles at higher opacity look like data streams.

---

### terrain

A heightmap surface rendered as wireframe or solid.

```json
{
    "type": "terrain",
    "position": [-30, -0.5, -20],
    "width": 25,
    "depth": 25,
    "segments": [40, 40],
    "heightScale": 2,
    "color": "#00ff88",
    "opacity": 0.3,
    "wireframe": true,
    "heights": null
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | [x,y,z] | `[0,0,0]` | Terrain center |
| `width` | number | `50` | Terrain width (X axis) |
| `depth` | number | `50` | Terrain depth (Z axis) |
| `segments` | [w, d] | `[40, 40]` | Grid resolution |
| `heightScale` | number | `5` | Height multiplier |
| `color` | color | `"cyan"` | Surface color |
| `opacity` | number | `0.6` | Surface transparency |
| `wireframe` | boolean | `true` | Wireframe vs solid rendering |
| `heights` | number[] | `null` | Custom heightmap data (one value per vertex). If null, procedural rolling terrain is generated. |

**Tip:** Wireframe terrain with low opacity and a green or cyan color gives a topographic/contour look. Pair with a grid floor for depth reference.

---

### volume

A translucent region boundary. Use to define zones, fields, or containment areas.

```json
{
    "type": "volume",
    "shape": "sphere",
    "position": [0, 6, 0],
    "size": 14,
    "color": "#1a1a4e",
    "opacity": 0.04,
    "wireframe": true
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `shape` | string | `"sphere"` | `"sphere"` or `"box"` |
| `position` | [x,y,z] | `[0,0,0]` | Volume center |
| `size` | number or [w,h,d] | `5` | Radius (sphere) or dimensions (box) |
| `color` | color | `"violet"` | Volume color |
| `opacity` | number | `0.1` | Volume transparency |
| `wireframe` | boolean | `true` | Whether to add a wireframe overlay |

**Tip:** Very low opacity (0.02-0.08) creates a subtle containment field. The wireframe overlay at 2x opacity adds visible structure while preserving translucency.

---

### line

A standalone line or curved path through 3D space.

```json
{
    "type": "line",
    "points": [[0, 0, 0], [5, 10, 3], [10, 5, 8], [15, 12, 2]],
    "color": "#00ffff",
    "opacity": 0.8,
    "curve": true,
    "segments": 50
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `points` | [x,y,z][] | required | Array of 3D points |
| `color` | color | `"cyan"` | Line color |
| `opacity` | number | `0.8` | Line transparency |
| `emissive` | number | none | Color intensity multiplier. Values above 1 push the line into bloom range — start with 2. |
| `curve` | boolean | `false` | If true, interpolates a smooth Catmull-Rom curve through the points |
| `segments` | number | `50` | Curve smoothness (only used with `curve: true`) |

---

### ring

A circular element: orbits, halos, scan rings.

```json
{
    "type": "ring",
    "position": [0, 0.5, 0],
    "innerRadius": 11,
    "outerRadius": 11.3,
    "color": "#00ffff",
    "opacity": 0.25,
    "rotation": [-90, 0, 0],
    "tube": 0.05
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | [x,y,z] | `[0,0,0]` | Ring center |
| `innerRadius` | number | `4.5` | Inner edge radius |
| `outerRadius` | number | `5` | Outer edge radius |
| `color` | color | `"cyan"` | Ring color |
| `opacity` | number | `0.6` | Ring transparency |
| `rotation` | [x,y,z] | `[-90, 0, 0]` | Rotation in degrees (default: horizontal) |
| `segments` | number | `64` | Circle smoothness |
| `tube` | number | none | If set, adds a glowing torus tube at this thickness |

**Tip:** Thin rings (inner ~= outer) look like scan lines. Add `tube` for a glowing 3D torus. Stack multiple rings at different heights and radii for an orbital rig.

---

### light

A light source. Illuminates nearby objects.

```json
{
    "type": "light",
    "kind": "point",
    "position": [0, 20, 0],
    "color": "#222244",
    "intensity": 0.5,
    "range": 60,
    "visible": false
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `kind` | string | `"point"` | `"point"`, `"spot"`, or `"directional"` |
| `position` | [x,y,z] | `[0,0,0]` | Light position |
| `color` | color | `"white"` | Light color |
| `intensity` | number | `1` | Light intensity |
| `range` | number | `50` | Falloff range (point lights) |
| `angle` | number | `30` | Cone angle in degrees (spot lights) |
| `penumbra` | number | `0.5` | Soft edge factor (spot lights) |
| `target` | [x,y,z] | none | Spot light aim point |
| `visible` | boolean | `false` | If true, renders a small glowing node at the light position |

**Tip:** The scene starts with very dim ambient light (`#111111`). Everything earns its visibility through emissive materials and explicit lights. Keep scene lighting dark and let bloom do the work.

---

## Hierarchy

Any element can have a `children` array. Children are positioned relative to the parent and inherit all parent transforms — when the parent moves, rotates, or scales, children follow. Animations compose: a parent spinning and a child bobbing produce a child that bobs while orbiting.

### group

An invisible transform container. Position, rotation, and animation with no visible geometry.

```json
{
    "type": "group",
    "position": [0, 5, 0],
    "rotation": [0, 0, 0],
    "animate": "slow-spin",
    "children": [
        { "type": "node", "position": [0, 0, 0], "color": "orange", "size": 0.8 },
        { "type": "ring", "position": [0, 0, 0], "innerRadius": 3, "outerRadius": 3.1, "color": "cyan" },
        { "type": "node", "position": [5, 0, 0], "color": "cyan", "animate": "pulse" }
    ]
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | [x,y,z] | `[0,0,0]` | Group origin in parent space |
| `rotation` | [x,y,z] | `[0,0,0]` | Rotation in degrees |
| `animate` | animate | none | Animation applied to the group (children inherit the transform) |
| `children` | element[] | `[]` | Child elements positioned relative to the group |

### children on any element

Any visible element can also have children. The element's mesh becomes the parent.

```json
{
    "type": "node",
    "position": [0, 5, 0],
    "size": 1,
    "animate": "slow-spin",
    "children": [
        { "type": "node", "position": [4, 0, 0], "size": 0.3, "animate": "pulse",
            "children": [
                { "type": "node", "position": [2, 0, 0], "size": 0.15, "animate": "bob" }
            ]
        }
    ]
}
```

Nesting is unlimited. Three levels deep, each with its own animation, all composing naturally: the innermost node bobs while pulsing while orbiting.

---

## Animation

Any element can be animated by adding an `animate` property. Animations loop continuously and can be combined.

### Quick start

```json
{"type": "ring", "position": [0, 5, 0], "animate": "spin"}
```

### Three formats

**String preset.** Shortcut for common animations:
```json
{"type": "node", "animate": "pulse"}
```

**Object.** Named animation types with full control:
```json
{"type": "node", "animate": {
    "rotate": {"axis": "y", "speed": 0.5},
    "pulse": {"property": "emissive", "min": 1, "max": 4, "period": 2, "easing": "sine"}
}}
```

**Array.** Stack multiple animations:
```json
{"type": "ring", "animate": [
    {"type": "rotate", "axis": "y", "speed": 1},
    {"type": "bob", "height": 1, "period": 3}
]}
```

### Presets

| Preset | What it does |
|--------|-------------|
| `"spin"` | Rotate around Y axis at speed 1 rad/s |
| `"slow-spin"` | Rotate around Y axis at speed 0.3 rad/s |
| `"pulse"` | Emissive intensity oscillates between 1 and 3, period 2s, sine easing |
| `"glow"` | Opacity oscillates between 0.3 and 0.8, period 2s, sine easing |
| `"bob"` | Float up and down 1 unit, period 3s, sine easing |
| `"breathe"` | Scale oscillates between 0.9 and 1.1, period 3s, sine easing |
| `"drift"` | Slow random wander, speed 0.5, range 2 units |
| `"flow"` | A glowing particle travels along the line/edge/ring path, period 3s |
| `"fast-flow"` | Two particles traveling the path, period 1.5s |
| `"trace"` | A glowing streak slides along the path, period 3s, 15% lit |
| `"fast-trace"` | Faster streak, period 1.5s, 10% lit |

### Animation types

#### `rotate`

Continuous rotation around an axis.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `axis` | string | `"y"` | Rotation axis: `"x"`, `"y"`, or `"z"` |
| `speed` | number | `1.0` | Speed in radians per second |

#### `pulse`

Oscillate a numeric property between min and max values.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `property` | string | *required* | What to pulse: `"emissive"`, `"opacity"`, or `"scale"` |
| `min` | number | `0.5` | Minimum value |
| `max` | number | `2.0` | Maximum value |
| `period` | number | `2` | Seconds per full cycle |
| `easing` | string | `"sine"` | Easing function name |

#### `bob`

Vertical float up and down.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `height` | number | `1` | Distance to float (units) |
| `period` | number | `3` | Seconds per full cycle |
| `easing` | string | `"sine"` | Easing function name |

#### `orbit`

Move in a circle around a center point.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `center` | [x,y,z] | element's initial position | Center of the orbit |
| `radius` | number | `5` | Orbit radius |
| `speed` | number | `1.0` | Angular speed |
| `axis` | string | `"y"` | Which plane to orbit in: `"x"`, `"y"`, or `"z"` |

#### `drift`

Slow random wander using layered sine waves.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `speed` | number | `0.5` | Wander speed |
| `range` | number | `2` | Maximum displacement from origin (units) |

#### `flow`

A glowing particle that travels along a path. Works on `line`, `edge`, and `ring` elements. The particle is a separate object created automatically. On rings, the particle orbits the circumference.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `color` | hex string | `"#ffffff"` | Flow particle color |
| `size` | number | `0.2` | Particle radius |
| `emissive` | number | `3` | Glow intensity |
| `speed` | number | `1.0` | Travel speed multiplier |
| `period` | number | `3` | Seconds per full trip along the path |
| `count` | number | `1` | Number of particles (evenly staggered) |

#### `trace`

A glowing streak that slides along a path: the line itself lights up as the pulse travels. Works on `line`, `edge`, and `ring` elements. Creates layered line segments (bright head, fading tail) that sweep along the path. On closed paths (rings), the streak loops seamlessly. On open paths (lines, edges), it sweeps from start to end.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `color` | hex string | `"#ffffff"` | Streak color |
| `speed` | number | `1.0` | Travel speed multiplier |
| `period` | number | `3` | Seconds per full sweep |
| `length` | number | `0.15` | Fraction of path that's lit (0.1 = 10%, 0.3 = 30%) |

**Tip:** Pair trace with a dim base line (`opacity: 0.15`) so the streak reads as a pulse traveling through a cable. Combine with `rotate` on rings for scanning effects.

### Path animations on different elements

`flow` and `trace` extract a natural path from each element type:

| Element | Path | Closed? |
|---------|------|---------|
| `line` | The line's points (curved if `curve: true`) | Open |
| `edge` | Straight line from `from` to `to` | Open |
| `ring` | Circumference of the ring, respecting position and rotation | Closed |

On closed paths, trace wraps seamlessly with zero visual discontinuity. On open paths, the streak slides from start to end and resets.

Flow and trace on rings are children of the ring mesh, so they follow any other animations (spin, bob) applied to the ring.

### Easing functions

All timed animations (`pulse`, `bob`) accept an `easing` property:

| Easing | Character |
|--------|-----------|
| `"linear"` | Constant speed |
| `"sine"` | Smooth oscillation (default) |
| `"ease-in"` | Start slow, accelerate |
| `"ease-out"` | Start fast, decelerate |
| `"ease-in-out"` | Smooth acceleration and deceleration |
| `"bounce"` | Bouncy settle at the end |
| `"elastic"` | Springy overshoot |

### Stacking and phasing

When multiple animations are combined on one element, they all apply every frame. Rotation sets the angle, bob sets the Y position, pulse sets the emissive. They compose cleanly because each affects a different property.

Each animated element gets a random phase offset so identical animations on different elements feel organic. Two nodes with `"pulse"` breathe at the same rate but peak at different times.

### Wireframe and overlay behavior

Wireframe overlays and torus tube overlays on volumes and rings are children of the main mesh. When the parent animates (spin, bob, orbit), the wireframe follows automatically.

---

## Lessons from the Field

These are hard-won lessons from building Phosphor scenes.

### 1. Dark colors are invisible in a dark scene

Grid and terrain colors like `#0a0a3e` disappear against a `#000000` background, even at reasonable opacity. The bloom pass only amplifies emissive content above the threshold, so low-saturation dark colors never cross it. **Use bright, saturated colors at low opacity.** A grid at `#1144aa` / 0.2 reads clearly. A grid at `#0a0a3e` / 0.4 disappears.

### 2. Emissive intensity drives bloom

A node with `color: "#ff6600"` and `emissive: 1` looks warm. The same node with `emissive: 4` becomes a blinding hot spot. Bloom amplifies emissive materials exponentially. For dense scenes, keep most nodes at emissive 1.3-1.8. One hot node in a field of gentle ones creates hierarchy. Ten hot nodes create a wall of white.

### 3. Glow point lights compound fast

Every node with `glow: true` adds a point light. In a scene with 30+ nodes, that's 30 lights all additive blending. The scene washes out. **Disable glow on most nodes** (`glow: false`) and only enable it on the 3-5 most important elements. The emissive material + bloom handles the visual glow; the point light is for casting light on neighbors.

### 4. Stems need to start below terrain

If flowers or structures grow from terrain, the stem base must start well below the surface (y = -2 to -3). The procedural terrain has peaks around y = 1-2. A stem starting at y = 0.5 floats above the surface. Start deep and curve upward through the wireframe mesh.

### 5. Rank-based sizing beats log-scale for visual variety

File sizes span orders of magnitude. `log(size)` compresses a 100-byte file and a 100KB file into nearly the same visual height. Rank-based normalization (sort all sizes, map position in the sorted list to 0..1) spreads visual properties evenly across the full range regardless of absolute values.

### 6. Each primitive does what it's good at

The graph primitive excels at tree-like structures. Jellyfish, flowers, circuits, and abstract forms come alive through individual primitives: curved lines for tendrils, stacked rings for bells, volumes for bodies. Matching the primitive vocabulary to the subject produces the best results.

### 7. Enclosed spaces need bright grid colors

When using grids as walls and ceilings, the grid lines define the space while the content inside stays prominent. Use saturated colors (`#1144aa`, `#0e3388`) at moderate opacity (0.12-0.25). The enclosure should be felt as atmosphere.

### 8. Light backgrounds need inverted thinking

On dark backgrounds, emissive drives visibility: objects glow their way into existence. On light backgrounds, **opacity and color saturation** drive visibility. Bloom creates watercolor blobs on white instead of halos on black. The rules: low bloom (strength ≤ 0.4), high threshold (≥ 0.7) so only capitals/key nodes glow, low emissive on most elements (≤ 0.3), off-white background (`#e8e8ee`) for contrast instead of pure white, `minimal` label style (bracket has dark backgrounds that clash), and ambient light at `#888888` for 3D definition through shadows instead of emission. It's a fundamentally different mode.

### 9. Organic scenes fight the void

The engine's default aesthetic (dark background, emissive glow, neon colors) favors abstract, cyberpunk, and sci-fi compositions. Earthy browns and forest greens vanish into the void without brighter shades / emission. Organic and natural scenes work best with bright saturated versions of natural colors (`#00e676` for terrain, `#69f0ae` for trees). The brighter the source color, the more the bloom has to work with.

### 10. Write one-off scripts for calculated geometry

Scenes with mathematical structure (helices, orbits, PCB traces) benefit from one-off Python scripts. A DNA helix needs 100+ trig-calculated coordinates. A solar system needs orbital positions. Write the script for the specific scene, keep it in `tmp/`, and freestyle the composition within it. The script handles the math; the creative decisions are still yours.

---

## Data Generators

### `generators/dir-meadow.py`. Directory tree to flower meadow

```bash
python3 generators/dir-meadow.py ~/Documents/my-project > tmp/meadow.json
```

Scans a directory tree. Each file becomes a flower. Color = file extension, height = file size (rank-based), files cluster by parent directory. Takes a directory path as argument.

---

## Timeline

The timeline is a cinematic event system. Define a sequence of timed events (camera movements, element fades, property animations) and the engine plays them automatically on load.

### Structure

```json
"timeline": {
    "loop": false,
    "events": [
        { "time": 0, "type": "camera", "position": [40, 25, 40], "target": [0, 5, 0], "duration": 0 },
        { "time": 2, "type": "fadeIn", "element": "ring1", "duration": 1.5 },
        { "time": 3, "type": "camera", "position": [20, 10, 25], "target": [0, 5, 0], "duration": 4, "easing": "ease-in-out" },
        { "time": 5, "type": "animate", "element": "core", "property": "emissive", "from": 1, "to": 5, "duration": 3 },
        { "time": 10, "type": "fadeOut", "element": "ring1", "duration": 1.5 }
    ]
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `loop` | boolean | `false` | Whether the timeline loops after all events complete |
| `events` | event[] | required | Array of timed events (sorted by `time` automatically) |

During timeline playback, OrbitControls are disabled. Click, scroll, or double-click to break out and take manual control. When both a timeline and a camera path are present, the timeline takes priority.

### Element IDs

Timeline events reference elements by ID. Add an `id` property to any element:

```json
{ "type": "node", "id": "core", "position": [0, 5, 0], "color": "#ff6600" }
{ "type": "ring", "id": "ring1", "position": [0, 5, 0], "innerRadius": 6, "outerRadius": 6.1 }
{ "type": "group", "id": "angel", "position": [0, 40, 0], "children": [...] }
```

IDs work on all element types including groups.

### Event Types

#### `camera`

Move the camera to a new position and look target.

```json
{ "time": 3, "type": "camera", "position": [20, 10, 25], "target": [0, 5, 0], "duration": 4, "easing": "ease-in-out" }
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `time` | number | required | When to start (seconds from timeline begin) |
| `position` | [x,y,z] | required | Camera destination |
| `target` | [x,y,z] | required | Look-at destination |
| `duration` | number | `0` | Seconds to fly there. `0` snaps instantly. |
| `easing` | string | `"ease-in-out"` | Easing function |

#### `set`

Instantly set a property on an element.

```json
{ "time": 5, "type": "set", "element": "core", "property": "visible", "value": false }
```

| Property | Type | Description |
|----------|------|-------------|
| `element` | string | Element ID |
| `property` | string | `"visible"`, `"opacity"`, `"emissive"`, or `"position"` |
| `value` | any | The value to set (boolean, number, or [x,y,z] for position) |

#### `animate`

Tween a numeric property from one value to another over a duration. Can target scene elements (by `element` ID) or engine properties (by `target`).

**Element animation:**
```json
{ "time": 2, "type": "animate", "element": "core", "property": "emissive", "from": 1, "to": 5, "duration": 3, "easing": "sine" }
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `element` | string | *required* | Element ID |
| `property` | string | *required* | `"opacity"`, `"emissive"`, or `"scale"` |
| `from` | number | *required* | Starting value |
| `to` | number | *required* | Ending value |
| `duration` | number | `1` | Seconds |
| `easing` | string | `"ease-in-out"` | Easing function |

**Engine property animation:**
```json
{ "time": 0, "type": "animate", "target": "bloom.strength", "from": 0.5, "to": 3.0, "duration": 4, "easing": "ease-in" },
{ "time": 3, "type": "animate", "target": "chromatic", "from": 0, "to": 0.008, "duration": 2, "easing": "ease-in-out" },
{ "time": 5, "type": "animate", "target": "scanlines.opacity", "from": 0, "to": 0.15, "duration": 3, "easing": "sine" }
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `target` | string | *required* | Engine property path (see table below) |
| `from` | number | *required* | Starting value |
| `to` | number | *required* | Ending value |
| `duration` | number | `1` | Seconds |
| `easing` | string | `"ease-in-out"` | Easing function |

**Available targets:**

| Target | What it controls |
|--------|-----------------|
| `bloom.strength` | Bloom intensity |
| `bloom.radius` | Bloom spread |
| `bloom.threshold` | Minimum brightness for bloom |
| `chromatic` or `chromatic.offset` | Chromatic aberration strength |
| `scanlines.count` | Number of scan lines |
| `scanlines.opacity` | Scan line darkness |
| `filmGrain` or `filmGrain.intensity` | Film grain strength |

#### `fadeIn`

Fade an element from invisible to visible. Elements with `fadeIn` events are automatically hidden at scene load.

```json
{ "time": 4, "type": "fadeIn", "element": "ring1", "duration": 1.5, "easing": "ease-in-out" }
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `element` | string | *required* | Element ID |
| `duration` | number | `1` | Fade duration in seconds |
| `easing` | string | `"ease-in-out"` | Easing function |

#### `fadeOut`

Fade an element to invisible. Sets `visible: false` on completion.

```json
{ "time": 10, "type": "fadeOut", "element": "ring1", "duration": 1.5 }
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `element` | string | *required* | Element ID |
| `duration` | number | `1` | Fade duration in seconds |
| `easing` | string | `"ease-in-out"` | Easing function |

### Timeline tips

- Multiple events can fire at the same `time`. Stagger fades by 0.5s for a cascading reveal.
- Camera events compose with element events. Fly the camera while fading in elements for cinematic reveals.
- `fadeIn` auto-hides elements at load, so you can define elements at their final state and let the timeline reveal them.
- Use `target` on animate events to keyframe engine properties over time. Bloom ramping up while chromatic aberration creeps in and scanlines intensify — all with easing.
- When looping, all state resets: fired events re-fire, fadeIn elements re-hide, tweens restart.
- Total duration is calculated from the latest `time + duration` across all events.

---

*The model is the intelligence. Phosphor is the light.*
