# Phosphor

A 3D scene engine. JSON in, navigable 3D scene out.

Models describe **what** to render. Phosphor handles **how** it looks: WebGL rendering, bloom post-processing, orbit controls, and a dark void aesthetic baked in as the default.

## Quick start

```bash
python3 -m http.server 8888
# Open http://localhost:8888
# Or: http://localhost:8888?scene=examples/hello.json
```

## What you can build

- **Data visualizations.** Network topologies, directory trees as flower meadows
- **Sci-fi environments.** Cyberspace, command centers, orbital maps
- **Abstract compositions.** Sacred geometry, armillary rings, interacting volumes
- **Cinematic sequences.** Camera paths, timeline keyframes, post-processing effects

## Primitives

11 element types compose freely with scene graph hierarchy and unlimited nesting:

| Category | Types |
|----------|-------|
| **Structure** | `grid`, `terrain`, `volume` |
| **Objects** | `node`, `edge`, `graph`, `ring`, `line` |
| **Overlay** | `label`, `particles`, `light` |

## Features

- **Animation.** Rotate, pulse, bob, orbit, drift, flow, trace. String presets or full object control with easing.
- **Post-processing.** Chromatic aberration, scanlines, film grain. Configurable in scene JSON.
- **Camera paths.** Waypoint flythroughs with position, target, duration, easing.
- **Timeline.** Cinematic event sequences with camera moves, fades, property animation.
- **Dashboard.** Real-time tuning panel (Tab to toggle). Bloom sliders, effect controls, timeline scrub.
- **Themes.** Five built-in palettes (phosphor, ocean, forest, sunset, monochrome).
- **Export.** Bundle any scene into a single self-contained HTML file.

## CLI

```bash
./phosphor                              # open default scene
./phosphor examples/sacred.json         # open a scene
./phosphor --example glitch             # open a built-in example
./phosphor --list                       # list all examples
./phosphor --export sacred > sacred.html  # export self-contained HTML
```

## Documentation

- **[Composition Guide](PHOSPHOR-GUIDE.md).** Full primitive reference, animation system, effects, camera paths, timeline, and lessons from building dozens of scenes

## License

Apache 2.0
