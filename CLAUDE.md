# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zenline is a D3.js-based interactive timeline photo gallery with 3D model (GLB) viewing support. Images are grouped chronologically into clusters displayed as circles on a force-directed SVG timeline. Clicking a group opens a grid view; images with paired `.glb` files open a Three.js 3D viewer.

## Commands

```bash
npm install              # Install dependencies
npm run generate         # Regenerate public/data/images.json from public/imgs/
npm start                # Start Express server on port 3000 (also regenerates images.json)
```

After adding/removing images in `public/imgs/`, either run `npm run generate` or just restart the dev server — it regenerates on startup.

## Architecture

### Shared grouping module (`lib/grouping.js`)

Single source of truth for image scanning and date-based grouping logic. Exports:
- `scanImages(imgDir, options)` — scans directory, groups by month, merges small/nearby groups, detects paired `.glb` files
- `serializeGroups(groups)` — converts Moment objects to ISO strings for JSON output

Default constants: `MIN_GROUP_SIZE=6`, `MAX_MONTHS_DISTANCE=4`. Overridable via `options`.

### Two entry points using the shared module

1. **`generate-static.js`** — production path. Generates `public/data/images.json` for static hosting (e.g., Render).
2. **`app.js`** — dev server. Auto-regenerates `images.json` on startup, then serves static files from `public/`.

Both use identical grouping logic from `lib/grouping.js`.

### Frontend (`public/`)

Single-page app using ES modules. Libraries loaded via CDN + importmap (D3 v7, Three.js 0.128.0, jQuery, Lightbox2, Moment.js).

**`public/js/gallery.js`** exports three classes + helper functions:
- **`Timeline`** — fetches image groups, creates SVG, runs D3 force simulation to position group circles without overlap, handles resize
- **`TimelineGroup`** — renders a single circle with rotating thumbnail, hover preview grid (3x3), scale animations, click-to-open
- **`ModelViewer`** — Three.js WebGL renderer for GLB models with OrbitControls, shown in a custom lightbox overlay

**`public/index.html`** imports from `gallery.js` and handles initialization + back-button wiring.

**View switching**: `timeline-view` and `group-view` toggled via `.active` CSS class. No router.

### Image grouping algorithm

`lib/grouping.js` implements:
- Parse image filenames to extract YYYY-MM dates
- Group by month, then merge adjacent groups that are too small (below threshold) or close enough in time
- Detect paired `.glb` files by matching base filenames
- Calculate center dates for timeline positioning

### Image naming convention

Files in `public/imgs/` must follow: `YYYY-MM-DD[-N].ext` (e.g., `2019-05-24.jpg`, `2019-05-24-1.jpg`). GLB files use the same base name as their paired image (e.g., `2019-10-06-5.glb` pairs with `2019-10-06-5.jpg`).

## `mobile` branch (current)

This branch is a mobile-first rewrite of the timeline UX. Desktop hover affordances are intentionally absent. Key differences from `main`:

- **Vertical orientation**: timeline scrolls top-to-bottom (`overflow-y: auto`). Date maps to Y, force simulation balances X. `touch-action: pan-y` on the SVG so vertical scroll never fights gestures.
- **No hover**: `mouseenter`/`mouseleave` and the on-hover preview card are gone. Tap feedback uses `touchstart`/`touchend` (`tapScale` in `timelineGroup.js`).
- **Pulsation loop**: each `TimelineGroup` runs its own `requestAnimationFrame` pulse with random phase + period (`PULSE_PERIOD_MIN`..`MAX`, `PULSE_MIN`..`MAX` in `timelineGroup.js`). Amplitude is bounded so the maximum visible scale (focal × pulse) stays under the force-collision padding (`radius * 1.45` in `timeline.js`) — circles never overlap at peak.
- **Pulse-synced grid morph**: at the peak of each pulse cycle the single thumbnail morphs into a 2×2 mini-grid (`GRID_DIM`); at the trough it collapses back into a fresh single image. Triggered by sine-wave thresholds (`wave > 0.85` / `< 0.15`) with a `gridShown` latch so each cycle does exactly one expand/collapse.
- **Focal scroll-zoom**: `Timeline.attachScrollFocus` listens to container scroll and scales each group by distance from viewport center (1.18× at center, 0.82× at edges). Combined multiplicatively with `pulseScale` and `tapScale` in `applyTransform`.

When editing this branch, do NOT reintroduce hover-driven behavior or horizontal-scroll assumptions. Do not merge from `main` without re-applying these decisions.

## Key details

- Backend uses CommonJS (`require`); frontend uses ES modules (`import`)
- Grouping logic lives in `lib/grouping.js` — single source of truth for both entry points
- No build step, no bundler, no TypeScript, no linter, no tests
- Frontend libraries are CDN-only (`d3` and `lightbox2` are NOT in `package.json`)
- `moment` is the only shared dependency (used server-side in grouping)
- D3 force simulation runs 300 ticks synchronously to compute layout positions
