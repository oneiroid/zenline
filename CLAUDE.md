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

### Entry points using the shared module

1. **`generate-static.js`** — regenerates `public/data/images.json` on demand.
2. **`app.js`** — dev server. Auto-regenerates `images.json` on startup, then serves `public/` at port 3000 (the whole tree, including the device router at `/`).
3. **`scripts/build.js`** — production build. Regenerates `images.json`, bundles each variant's JS/CSS with esbuild into `dist/{desktop,mobile}/`, copies shared `imgs/` and `data/` to `dist/` root, rewrites `/imgs/` and `/data/` references in bundles to `../imgs/` and `../data/` (so they resolve against the shared root regardless of deployment subpath), and copies the router HTML to `dist/index.html`. The GitHub Pages workflow (`.github/workflows/deploy-pages.yml`) publishes `./dist`.

All three use identical grouping logic from `lib/grouping.js`.

### Frontend (`public/`)

Single-page app using ES modules. Libraries loaded via CDN + importmap (D3 v7, Three.js 0.128.0, jQuery, Lightbox2, Moment.js).

**Dual variants**: this branch ships both a desktop-optimized UI and a mobile-optimized UI, selected at runtime.

```
public/
  index.html         # router — detects device and redirects to ./desktop/ or ./mobile/
  imgs/              # shared (source of truth for images)
  data/              # shared, generated (images.json)
  desktop/
    index.html, css/style.css, js/*.js   # desktop UX (hover previews, horizontal layout)
  mobile/
    index.html, css/style.css, js/*.js   # mobile UX (pulsation, vertical scroll, no hover)
```

`gallery.js` and `modelViewer.js` are duplicated into each variant. They are identical today but kept separate so either variant can evolve independently.

Each variant's `js/*.js` exports:
- **`Timeline`** — fetches image groups, creates SVG, runs D3 force simulation to position group circles without overlap, handles resize
- **`TimelineGroup`** — renders a single circle with rotating thumbnail, scale animations, click-to-open (desktop also has hover preview grid; mobile has pulsation + grid morph)
- **`ModelViewer`** — Three.js WebGL renderer for GLB models with OrbitControls, shown in a custom lightbox overlay

**View switching**: `timeline-view` and `group-view` toggled via `.active` CSS class. No SPA router.

### Device detection (`public/index.html`)

The root `index.html` is a tiny router that redirects to `./desktop/` or `./mobile/` based on:
1. `?v=desktop` / `?v=mobile` query override (sticky for the session via `sessionStorage`)
2. UA regex (`/Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i`)
3. `matchMedia('(pointer: coarse)')`
4. `window.innerWidth < 900`

Uses `location.replace()` so Back doesn't bounce users back to the router.

### Image grouping algorithm

`lib/grouping.js` implements:
- Parse image filenames to extract YYYY-MM dates
- Group by month, then merge adjacent groups that are too small (below threshold) or close enough in time
- Detect paired `.glb` files by matching base filenames
- Calculate center dates for timeline positioning

### Image naming convention

Files in `public/imgs/` must follow: `YYYY-MM-DD[-N].ext` (e.g., `2019-05-24.jpg`, `2019-05-24-1.jpg`). GLB files use the same base name as their paired image (e.g., `2019-10-06-5.glb` pairs with `2019-10-06-5.jpg`).

## Mobile variant (`public/mobile/`)

The mobile variant is a mobile-first rewrite of the timeline UX. Desktop hover affordances are intentionally absent. Key differences from the desktop variant:

- **Vertical orientation**: timeline scrolls top-to-bottom (`overflow-y: auto`). Date maps to Y, force simulation balances X. `touch-action: pan-y` on the SVG so vertical scroll never fights gestures.
- **No hover**: `mouseenter`/`mouseleave` and the on-hover preview card are gone. Tap feedback uses `touchstart`/`touchend` (`tapScale` in `timelineGroup.js`).
- **Pulsation loop**: each `TimelineGroup` runs its own `requestAnimationFrame` pulse with random phase + period (`PULSE_PERIOD_MIN`..`MAX`, `PULSE_MIN`..`MAX` in `timelineGroup.js`). Amplitude is bounded so the maximum visible scale (focal × pulse) stays under the force-collision padding (`radius * 1.45` in `timeline.js`) — circles never overlap at peak.
- **Pulse-synced grid morph**: at the peak of each pulse cycle the single thumbnail morphs into a 2×2 mini-grid (`GRID_DIM`); at the trough it collapses back into a fresh single image. Triggered by sine-wave thresholds (`wave > 0.85` / `< 0.15`) with a `gridShown` latch so each cycle does exactly one expand/collapse.
- **Focal scroll-zoom**: `Timeline.attachScrollFocus` listens to container scroll and scales each group by distance from viewport center (1.18× at center, 0.82× at edges). Combined multiplicatively with `pulseScale` and `tapScale` in `applyTransform`.

When editing `public/mobile/`, do NOT reintroduce hover-driven behavior or horizontal-scroll assumptions — those belong in the desktop variant.

## Commands (updated)

```bash
npm run build            # Produces dist/{index.html, desktop/, mobile/, imgs/, data/}
```

Force a variant while developing: `http://localhost:3000/?v=desktop` or `?v=mobile` (sticky per session).

## Key details

- Backend uses CommonJS (`require`); frontend uses ES modules (`import`)
- Grouping logic lives in `lib/grouping.js` — single source of truth for both entry points
- No build step, no bundler, no TypeScript, no linter, no tests
- Frontend libraries are CDN-only (`d3` and `lightbox2` are NOT in `package.json`)
- `moment` is the only shared dependency (used server-side in grouping)
- D3 force simulation runs 300 ticks synchronously to compute layout positions
