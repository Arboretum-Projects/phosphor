# Phosphor — Progress & Roadmap

## What's Built

### Engine
- `phosphor.js` — 11 primitive renderers, animation system (7 types, 11 presets, 7 easings), bloom + effects post-processing (chromatic, scanlines, grain), camera paths, timeline/keyframe sequences, interactive dashboard (Tab toggle), orbit controls, click-to-focus, CSS2D labels
- `index.html` — loads scenes from `?scene=` URL param
- `phosphor` — CLI wrapper (opens scenes in browser)
- `PHOSPHOR-GUIDE.md` — full composition guide with primitive reference + 10 lessons
- `CLAUDE.md` — agent boot instructions

### Primitives (all 11 implemented)
- `grid` — reference planes, supports rotation for walls/ceilings
- `node` — glowing icosahedron with emissive material + optional point light
- `edge` — line between two points
- `graph` — collection of nodes + edges with manual or tree layout
- `label` — CSS2D HTML overlay (default, bracket, minimal styles)
- `particles` — ambient point fields with additive blending
- `terrain` — heightmap surface (procedural or custom data)
- `volume` — translucent sphere or box with optional wireframe
- `line` — straight or Catmull-Rom curved paths
- `ring` — flat ring or 3D torus tube
- `light` — point, spot, or directional

### Examples (33 scenes)
| Example | What it demonstrates |
|---------|---------------------|
| `hello` | First scene — graph, grid, terrain, rings, particles |
| `sprout` | Cyberpunk tree with glowing nodes and branches |
| `sprout-lines` | Same tree, tiny nodes, focus on branch structure |
| `sprout-animated` | Living tree — trace on trunk, flow on branches, energy circulation |
| `abyss` | Deep sea jellyfish — volumes, stacked rings, curved tentacles |
| `sacred` | Star tetrahedron with armillary sphere rings |
| `meadow` | Flowers growing through wireframe terrain |
| `bouquet` | Same flowers floating in pure void |
| `projector-meadow` | Data-driven: Projector repo files as flowers |
| `command` | Enclosed space — floor/ceiling/wall grids, core system |
| `command-v2` | Same command center with brighter visible grids |
| `wormhole` | Torus tunnel converging on singularity |
| `dna` | DNA double helix — curved backbone strands, color-coded base pairs |
| `circuit` | PCB layout — MCU, VREG, crystal, LEDs, copper traces, vias |
| `ice` | Neuromancer cyberspace — ICE fortress, corporate nodes, intrusion path |
| `nerv` | Evangelion Third Impact — NERV pyramid, Seele monoliths, Lance, crosses |
| `network` | Arboretum topology — instances, MCP, compute cluster, Tailscale mesh |
| `solar` | Solar system — sun, 8 planets, Saturn's rings, asteroid belt, Moon |
| `abstract` | Pure composition — armillary rings, floating volumes, spirals, color gradient |
| `theworld` | .hack// — corrupted field, Aura, Data Drain vortex, AIDA, Twilight Gate |
| `theworld-v2` | .hack// — Mac Anu root town, Chaos Gate, party, dungeon, Data Bug |
| `empire` | Intergalactic territory map — 4 factions above/below galactic plane, fleets, trade routes |
| `empire-light` | Same empire map on light background — inverted aesthetic, minimal bloom |
| `convergence` | Dimensional nexus — all 11 primitives, all 7 animation types in one scene |
| `primitive-tests` | Feature showroom — nebula clusters, spot lights, heightmaps, box rooms, torus compositions |
| `solar-live` | Living solar system — hierarchy-driven orbits, 16 moons, Saturn's rings as children |
| `circuit-animated` | PCB with flowing signals, pulsing LEDs, breathing MCU |
| `angel-attack` | Evangelion — Ramiel descending on Tokyo-3, AT Field, Eva launch sequence, particle beam |
| `flatland` | Dimensional hierarchy — Pointland through N-land, communities passing Jenny's message |
| `glitch` | Dimensional membrane breach — chromatic aberration, RGB splits, ghost echoes, scan lines |
| `terminal-dogma` | Evangelion — Lilith crucified, Lance of Longinus, MAGI trinity, LCL cavern, AT Field |
| `nerv-ops` | Evangelion — Command bridge during Angel engagement, holographic tactical display, operator stations |

### Generators
| Generator | What it does |
|-----------|--------------|
| `generators/dir-meadow.py` | Scans a directory tree, generates a meadow scene. Color = file type, height = file size, directory clustering. |

---

## What's Next

### Scenes to explore
- [x] **Solar system** — central star, torus rings as orbits at different angles, planet nodes, asteroid particle belt
- [x] **DNA helix** — two intertwined curved lines spiraling upward, cross-link edges, nodes at base pairs
- [x] **Circuit board** — grid as PCB, nodes as components, edges as traces, labels as part numbers
- [x] **Abstract composition** — pure interplay of rings, volumes, light, and color as form alone
- [x] **Network topology** — Arboretum network visualized (instances as nodes, communication as edges)

### Primitive features to push
- [x] Dense particle clusters as nebulae or energy fields
- [x] Spot lights with targeted dramatic beams
- [x] Custom terrain heightmaps (data-driven, beyond procedural)
- [x] More complex box volume compositions (rooms, corridors)
- [x] Torus ring compositions beyond tunnels

### Generator ideas
- [ ] Git history meadow — commits as flowers, branches as stems, authors as colors
- [ ] Network graph — JSON topology in, 3D node graph out
- [ ] Markdown structure — headings as tall flowers, links as edges between them
- [ ] Live data feeds — watch a directory and regenerate on change

### Engine features (shipped)
- [x] Animation hooks — rotation, pulse, bob, orbit, drift, flow (6 types, 9 presets, 7 easings)
- [x] Flow on graphs — data flowing along graph edges via `edgeAnimate` or per-edge `animate`
- [x] Scene graph hierarchy — `group` type + `children` on any element, nested transforms compose
- [x] Interaction — double-click any mesh to fly camera into orbit around it
- [x] Theme presets — palette + atmosphere bundles (phosphor, ocean, forest, sunset, monochrome)

### Engine features (next)
- [x] **Camera paths** — waypoints in `camera.path` with position, target, duration, easing. Auto-play flythrough on load. Loop option. User interaction breaks out.
- [x] **Post-processing toolkit** — ShaderPass effects in scene config: chromatic aberration, scanlines, film grain. Shorthand and object formats.
- [x] **Self-contained HTML export** — bundle engine + scene into a single HTML file using CDN importmap. Send to anyone, they double-click, it opens. CLI: `./phosphor --export scene.json > scene.html`.
- [x] **Timeline / keyframe sequences** — timed events: camera, set, animate, fadeIn, fadeOut. Element IDs for addressing. Animate targets for engine properties (bloom, chromatic, scanlines, filmGrain) with full easing. Auto-play on load with loop support. Pause/resume via dashboard.
- [x] **Interactive dashboard** — Tab to toggle. Bloom/effects sliders, timeline controls (play/pause/restart/scrub/speed), element visibility toggles, camera JSON copy, FPS counter.
