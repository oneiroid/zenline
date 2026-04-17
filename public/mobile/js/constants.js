// ── Layout ────────────────────────────────────────────────
export const TIMELINE_MARGIN = { top: 16, right: 18, bottom: 18, left: 18 };
export const MIN_GROUP_SPACING = 150;        // px of vertical content per group (min)
export const RADIUS_MIN = 26;
export const RADIUS_MAX_ABS = 94;             // hard ceiling for circle radius
export const RADIUS_MAX_WIDTH_FRACTION = 0.22; // also limited by viewport width
export const DOMAIN_PADDING_FRACTION = 0.02;   // extra time-domain padding above/below
export const SIDE_PADDING = 8;                 // px from svg edge to circle edge

// ── Force simulation ──────────────────────────────────────
export const FORCE_X_STRENGTH = 0.15;
export const COLLISION_STRENGTH = 0.95;
export const SIM_TICKS = 300;

// ── Pulsation (per-group breath) ──────────────────────────
export const PULSE_PERIOD_MIN = 4200;          // ms
export const PULSE_PERIOD_MAX = 12000;          // ms
export const PULSE_MIN = 0.7;                  // scale at trough
export const PULSE_MAX = 1.32;                 // scale at peak
export const PULSE_PEAK_THRESHOLD = 0.85;      // wave value to trigger grid morph
export const PULSE_TROUGH_THRESHOLD = 0.15;    // wave value to trigger single morph

// ── Focal scroll-zoom ─────────────────────────────────────
export const FOCAL_MAX = 1.18;                 // scale at viewport center
export const FOCAL_MIN = 0.52;                 // scale at edge
export const FOCAL_RANGE = FOCAL_MAX - FOCAL_MIN;
export const FOCAL_FALLOFF_FRACTION = 0.4;    // fraction of viewport height for falloff

// ── Touch feedback ────────────────────────────────────────
export const TAP_SCALE = 0.94;

// ── Boundary breath (circle ripple racing ahead of pulse) ─
export const BOUNDARY_EXPANSION = 0.9;         // extra radius fraction at peak (atop pulse scale)
export const BOUNDARY_GROWTH_POWER = 3;        // wave^P → accelerating outward growth
export const BOUNDARY_FADE_POWER = 1.6;        // wave^P → accelerating fade to 0

// ── Wobble (in-place oscillation) ─────────────────────────
export const WOBBLE_PERIOD_MIN = 2800;         // ms
export const WOBBLE_PERIOD_MAX = 5200;         // ms
export const WOBBLE_AMPLITUDE_PX = 5;          // ± px translation
export const WOBBLE_ROTATION_DEG = 1.4;        // ± degrees rotation

// ── Axis focal (tick labels + grid lines) ─────────────────
export const AXIS_FOCAL_MAX = 1.72;
export const AXIS_FOCAL_MIN = 0.55;
export const AXIS_FOCAL_RANGE = AXIS_FOCAL_MAX - AXIS_FOCAL_MIN;
export const AXIS_LINE_OPACITY_MIN = 0.2;

// ── Collision padding (DERIVED — do not duplicate) ────────
// Must accommodate worst-case combined scale of focal × pulse plus a wobble allowance
// (additive px, expressed here as a fraction of the smallest radius), plus a safety margin.
// Touching PULSE_MAX, FOCAL_MAX, WOBBLE_AMPLITUDE_PX, or RADIUS_MIN auto-updates this.
export const COLLISION_SAFETY = 1.05;
export const WOBBLE_RADIUS_BUFFER = (WOBBLE_AMPLITUDE_PX * 2) / RADIUS_MIN;
export const COLLISION_PADDING =
    (PULSE_MAX * FOCAL_MAX + WOBBLE_RADIUS_BUFFER) * COLLISION_SAFETY;

// ── Grid morph ────────────────────────────────────────────
export const GRID_DIM = 2;                     // NxN mini-grid at peak
export const GRID_CELL_INSET = 1;              // px gap between cells
export const MORPH_OUT_DURATION = 420;         // single → grid expand
export const MORPH_IN_DURATION = 360;          // grid → single collapse
export const MORPH_CELL_STAGGER_OUT = 50;
export const MORPH_CELL_STAGGER_IN = 30;
export const MORPH_SINGLE_FADE_DELAY = 150;
export const MORPH_SINGLE_FADE_DURATION = 500;

// ── Entrance ──────────────────────────────────────────────
export const ENTRANCE_STAGGER = 60;
export const ENTRANCE_DURATION = 700;
export const ENTRANCE_OVERSHOOT = 1.3;
export const LABEL_ENTRANCE_DELAY = 500;
export const LABEL_ENTRANCE_DURATION = 400;

// ── Lifeline ──────────────────────────────────────────────
export const LIFELINE_DRAW_DURATION = 1500;
export const LIFELINE_CURVE_ALPHA = 0.5;       // Catmull-Rom tension

// ── Misc ──────────────────────────────────────────────────
export const RESIZE_DEBOUNCE_MS = 250;
export const SCROLL_FOCUS_INIT_DELAY = 50;
export const AXIS_LABEL_X_OFFSET = -8;

// ── Palette ───────────────────────────────────────────────
export const PALETTE = {
    bg: '#fdf4e8',
    circle_stroke: '#e08a5a',
    label: '#a8754c',
    lifeline: '#e08a5a',
    lifeline_start: '#f4b860',
    lifeline_end: '#d4604a',
    preloader: '#f4b860',
};

// ── Preloader (thumbnail loading shimmer) ────────────────
export const PRELOADER_FADE_MS = 320;
