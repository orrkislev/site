// Every knob in one place. Nothing here imports anything — pure numbers and names.

// ── what the figure wears ────────────────────────────────────────────────────
export const WITH_EYE = false;
export const WITH_SHIRT = true;
export const WITH_SLEEVES = true;
export const WITH_SHORTS = true;
export const WITH_SOCKS = true;

// ── palette ──────────────────────────────────────────────────────────────────
export const BG = 0xfcfbf8;
export const SHADOW_OPACITY = 0.18;
export const SKIN_INDEX = 0;              // into PALETTE
export const SHORTS_COLOR = 'tomato';
export const SHIRT_COLOR = 'cornflowerblue';
export const EYE_COLOR = 0x2b2622;

export const PALETTE = [
  [246, 178, 147], [244, 214, 141], [166, 214, 178], [151, 191, 224],
  [196, 172, 224], [240, 168, 190], [156, 210, 208], [225, 197, 160],
];

// ── body ─────────────────────────────────────────────────────────────────────
// thickness, as a fraction of the hips-to-crown span
export const R_TORSO = 0.42, R_ARMS = 0.11, R_LEGS = 0.13;
export const TUBE_SEG = 96, TUBE_SIDES = 20;

export const FLOOR_LIFT = 0.05;   // raises the floor toward the feet, x span. Raise it if the figure still floats

export const ARM_T =0.2;   // where along the torso the arms sit (0 = seat, 1 = crown)

export const EYE_OUT = 1.0;               // eye's distance from the head centre, x torso radius
export const EYE_R = 0.1;                 // x torso radius

// ── clothing ─────────────────────────────────────────────────────────────────
// [start, end] along the part's curve, and a radius as a multiple of the part's own
const shortsLength = .2;
export const SHORTS_SPAN = [.5 - shortsLength, .5 + shortsLength], SHORTS_R = 1.8, SEAT_R = 1.06;
export const SHIRT_SPAN = [0.08, 0.65], SHIRT_R = 1.07;
const sleeveLength = .19;
export const SLEEVE_L_SPAN = [.5 - sleeveLength, .5], SLEEVE_R_SPAN = [.5, .5 + sleeveLength], SLEEVE_R = 1.5;
// socks: stripes stacked up from each end of the leg chain, one tube per colour
export const SOCK_COLORS = ['grey', 'black'];
export const SOCK_LEN = 0.04, SOCK_R = 1.01;

// ── line-drawing mode ────────────────────────────────────────────────────────
// Every material goes flat background-white and each mesh gets a slightly fatter back-facing
// twin, so all that survives is the outline. Same geometry either way.
export const STROKES = false;
// STROKE_W is a distance, not a factor — a factor draws a fat line round the torso and a hairline
// round the arms. Same units as the scene, so ~1/140 of the figure's height.
export const STROKE_W = 0.012, STROKE_COLOR = 0x1a1a1a;

// ── playback ─────────────────────────────────────────────────────────────────
export const XFADE = 1;                 // seconds to fade the hand-off between clips
