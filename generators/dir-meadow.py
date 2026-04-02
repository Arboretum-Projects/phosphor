#!/usr/bin/env python3
"""
Generate a Phosphor meadow scene from a directory tree.
Each file becomes a flower. Color = file type. Height = file size.
Files cluster by parent directory.

Usage:
    python3 generators/dir-meadow.py ~/Documents/some-project > tmp/project.json
    ./phosphor tmp/project.json
"""

import os
import sys
import json
import math
import hashlib

# ─── Color mapping by extension ───────────────────────────────────
EXT_COLORS = {
    '.py':    '#00ff88',   '.js':    '#ffdd00',   '.ts':    '#4488ff',
    '.jsx':   '#ffaa00',   '.tsx':   '#4488ff',   '.rs':    '#ff6644',
    '.go':    '#00ddcc',   '.rb':    '#ff2244',   '.java':  '#ff6600',
    '.c':     '#8888ff',   '.cpp':   '#6666dd',   '.h':     '#aaaaff',
    '.swift': '#ff4488',   '.sh':    '#00cc77',   '.zsh':   '#00cc77',
    '.bash':  '#00cc77',   '.html':  '#ff6644',   '.css':   '#44aaff',
    '.scss':  '#cc66aa',   '.vue':   '#44bb88',   '.svelte':'#ff4400',
    '.json':  '#ffcc44',   '.yaml':  '#ffcc44',   '.yml':   '#ffcc44',
    '.toml':  '#ffaa66',   '.xml':   '#cc8844',   '.csv':   '#88cc44',
    '.sql':   '#ff88cc',   '.env':   '#666666',   '.md':    '#ff88cc',
    '.txt':   '#cccccc',   '.rst':   '#cc88aa',   '.pdf':   '#ff4444',
    '.png':   '#aa44ff',   '.jpg':   '#aa44ff',   '.jpeg':  '#aa44ff',
    '.svg':   '#cc66ff',   '.gif':   '#ff44ff',   '.lock':  '#444444',
    '.gitignore': '#444444',
}
DEFAULT_COLOR = '#88aacc'


def color_for_file(name):
    _, ext = os.path.splitext(name.lower())
    if name.lower() in EXT_COLORS:
        return EXT_COLORS[name.lower()]
    return EXT_COLORS.get(ext, DEFAULT_COLOR)


def generate_meadow(root_dir, max_files=120):
    root_dir = os.path.abspath(root_dir)
    project_name = os.path.basename(root_dir)

    # ─── Collect files grouped by directory ────────────────────────
    dir_files = {}
    all_files = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if not d.startswith('.') and d not in (
            'node_modules', '__pycache__', '.git', 'dist', 'build', '.next', 'venv', '.venv'
        )]
        for f in filenames:
            if f.startswith('.') and f not in ('.env', '.gitignore'):
                continue
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, root_dir)
            rel_dir = os.path.relpath(dirpath, root_dir)
            if rel_dir == '.':
                rel_dir = '/'
            try:
                size = os.path.getsize(full)
            except OSError:
                size = 0
            entry = (rel, rel_dir, size)
            all_files.append(entry)
            dir_files.setdefault(rel_dir, []).append(entry)

    if len(all_files) > max_files:
        all_files.sort(key=lambda f: f[2], reverse=True)
        all_files = all_files[:max_files]
        # Rebuild dir_files from capped list
        dir_files = {}
        for entry in all_files:
            dir_files.setdefault(entry[1], []).append(entry)

    if not all_files:
        print(f"No files found in {root_dir}", file=sys.stderr)
        sys.exit(1)

    sizes = [s for _, _, s in all_files]
    max_size = max(sizes) or 1
    min_size = min(s for s in sizes if s > 0) if any(s > 0 for s in sizes) else 1
    spread = min(55, max(25, len(all_files) * 0.7))
    dir_count = len(dir_files)

    # ─── Assign directory cluster positions ────────────────────────
    dir_positions = {}
    dirs_sorted = sorted(dir_files.keys())
    angle_step = (2 * math.pi) / max(dir_count, 1)
    for i, d in enumerate(dirs_sorted):
        if d == '/':
            # Root files cluster at center
            dir_positions[d] = (0, 0)
        else:
            depth = d.count(os.sep) + 1
            radius = spread * 0.25 + depth * spread * 0.15
            angle = i * angle_step + 0.3  # slight offset
            dir_positions[d] = (
                math.cos(angle) * radius,
                math.sin(angle) * radius
            )

    # ─── Size normalization (rank-based for variety) ───────────────
    ranked = sorted(set(sizes))
    rank_map = {s: i for i, s in enumerate(ranked)}
    max_rank = len(ranked) - 1 or 1

    def size_to_t(size):
        """Normalize size to 0..1 based on rank for maximum visual spread."""
        return rank_map.get(size, 0) / max_rank

    elements = []

    # ─── Terrain ───────────────────────────────────────────────────
    elements.append({
        "type": "terrain",
        "position": [0, 0, 0],
        "width": spread * 1.5,
        "depth": spread * 1.5,
        "segments": [40, 40],
        "heightScale": 1.5,
        "color": "#00ff66",
        "opacity": 0.12,
        "wireframe": True
    })

    # ─── Particles ─────────────────────────────────────────────────
    elements.append({
        "type": "particles",
        "count": min(len(all_files) * 3, 400),
        "spread": spread * 1.5,
        "color": "#ffdd88",
        "size": 0.04,
        "opacity": 0.18,
        "position": [0, 10, 0]
    })
    elements.append({
        "type": "particles",
        "count": min(len(all_files), 80),
        "spread": spread,
        "color": "#ff88cc",
        "size": 0.05,
        "opacity": 0.2,
        "position": [0, 5, 0]
    })

    # ─── Directory labels ──────────────────────────────────────────
    for d, (dx, dz) in dir_positions.items():
        label_text = d if d != '/' else project_name
        dir_color = "#00ff88" if d == '/' else "#22ccaa"
        elements.append({
            "type": "label",
            "text": label_text,
            "position": [dx, 0.8, dz],
            "color": dir_color,
            "style": "bracket" if d == '/' else "default"
        })
        # Small ground marker node for each directory
        elements.append({
            "type": "node",
            "position": [dx, 0.2, dz],
            "color": dir_color,
            "size": 0.12,
            "emissive": 2,
            "glow": False
        })
        # Faint ring around directory cluster
        file_count = len(dir_files.get(d, []))
        ring_radius = 2 + file_count * 0.4
        elements.append({
            "type": "ring",
            "position": [dx, 0.1, dz],
            "innerRadius": ring_radius,
            "outerRadius": ring_radius + 0.03,
            "color": dir_color,
            "opacity": 0.1
        })

    # ─── Flowers ───────────────────────────────────────────────────
    for rel_path, rel_dir, size in all_files:
        name = os.path.basename(rel_path)
        color = color_for_file(name)
        t = size_to_t(size)  # 0 = smallest, 1 = largest

        # Per-file random jitter from hash for organic variation
        jitter_h = hashlib.md5((rel_path + '_h').encode()).hexdigest()
        height_jitter = (int(jitter_h[:8], 16) / 0xFFFFFFFF - 0.5) * 4  # +/- 2 units

        # Height: base from rank, then jitter for variety
        height = 2 + t * 12 + height_jitter
        height = max(1.5, min(height, 16))

        # Bloom size: 0.06 (tiny sprout) to 0.35 (large bloom)
        bloom_size = 0.06 + t * 0.29

        # Emissive: toned down so big files don't blow out
        emissive = 1.5 + t * 2.5

        # Position: cluster around parent directory
        dx, dz = dir_positions.get(rel_dir, (0, 0))
        h = hashlib.md5(rel_path.encode()).hexdigest()
        scatter = 4 + len(dir_files.get(rel_dir, [])) * 0.6
        ox = (int(h[:8], 16) / 0xFFFFFFFF - 0.5) * scatter
        oz = (int(h[8:16], 16) / 0xFFFFFFFF - 0.5) * scatter
        x = dx + ox
        z = dz + oz

        # Stem — slight organic curve
        sway_x = (int(h[16:20], 16) / 0xFFFF - 0.5) * 0.8
        sway_z = (int(h[20:24], 16) / 0xFFFF - 0.5) * 0.8
        elements.append({
            "type": "line",
            "points": [
                [x, -3, z],
                [x + sway_x * 0.2, -1, z + sway_z * 0.2],
                [x + sway_x, height * 0.5, z + sway_z],
                [x + sway_x * 0.5, height, z + sway_z * 0.5]
            ],
            "color": "#00aa44",
            "opacity": 0.25 + t * 0.2,
            "curve": True
        })

        # Bloom node
        elements.append({
            "type": "node",
            "position": [x + sway_x * 0.5, height, z + sway_z * 0.5],
            "color": color,
            "size": bloom_size,
            "emissive": emissive,
            "glow": t > 0.5,
            "glowIntensity": 0.15 + t * 0.25,
            "glowRange": 2 + t * 4
        })

        # File name label
        elements.append({
            "type": "label",
            "text": name,
            "position": [x + sway_x * 0.5, height + bloom_size + 0.6, z + sway_z * 0.5],
            "color": color,
            "style": "minimal"
        })

        # Big files get extra detail
        if t > 0.7:
            # Ring halo
            elements.append({
                "type": "ring",
                "position": [x + sway_x * 0.5, height - 0.5, z + sway_z * 0.5],
                "innerRadius": bloom_size * 2,
                "outerRadius": bloom_size * 2 + 0.04,
                "color": color,
                "opacity": 0.15
            })

        if t > 0.85:
            # Leaf branches for the biggest files
            elements.append({
                "type": "line",
                "points": [
                    [x + sway_x * 0.7, height * 0.6, z + sway_z * 0.7],
                    [x + sway_x + 1.5, height * 0.7, z + sway_z + 0.5]
                ],
                "color": "#116633",
                "opacity": 0.3
            })
            elements.append({
                "type": "node",
                "position": [x + sway_x + 1.5, height * 0.7, z + sway_z + 0.5],
                "color": color,
                "size": bloom_size * 0.3,
                "emissive": emissive * 0.6,
                "glow": False
            })

    # ─── Project title ─────────────────────────────────────────────
    max_height = max((1.5 + size_to_t(s) * 14.5) for _, _, s in all_files)
    elements.append({
        "type": "label",
        "text": project_name.upper(),
        "position": [0, max_height + 3, 0],
        "color": "#ffffff",
        "style": "bracket"
    })

    # ─── Ambient light ─────────────────────────────────────────────
    elements.append({
        "type": "light",
        "kind": "point",
        "position": [0, max_height + 2, 0],
        "color": "#222233",
        "intensity": 0.3,
        "range": spread
    })

    return {
        "scene": {
            "background": "#000308",
            "fog": {"color": "#000308", "near": spread * 0.6, "far": spread * 2.5},
            "bloom": {"strength": 1.6, "radius": 0.4, "threshold": 0.1},
            "ambient": "#080810"
        },
        "camera": {
            "position": [spread * 0.5, spread * 0.3, spread * 0.5],
            "target": [0, 5, 0]
        },
        "elements": elements
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 generators/dir-meadow.py <directory> [max_files]")
        print("\nGenerates a Phosphor meadow scene from a directory tree.")
        print("Each file becomes a flower. Color = file type. Height = file size.")
        sys.exit(1)

    target = sys.argv[1]
    max_files = int(sys.argv[2]) if len(sys.argv) > 2 else 120

    if not os.path.isdir(target):
        print(f"Not a directory: {target}", file=sys.stderr)
        sys.exit(1)

    spec = generate_meadow(target, max_files)
    print(json.dumps(spec, indent=4))
