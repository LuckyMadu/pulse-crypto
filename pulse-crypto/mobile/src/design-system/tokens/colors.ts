/**
 * Colour tokens, hand-authored from the Figma style guide at node `1:469`
 * (rendered to `design/style-guide.png`).
 *
 * The style guide is a pasted raster image rather than live layers, so the file
 * exposes no Figma Variables - `get_variable_defs` returns empty. The ramps
 * below were sampled out of the image and reconciled against the two
 * implemented screens.
 *
 * The structure matters more than the values: the guide declares four named
 * hues with a tonal ramp each, so the semantic tokens are defined as
 * **references into those ramps** rather than as a flat list of loose hexes.
 * That is what makes "the bid colour and the brand colour are the same family,
 * two steps apart" expressible instead of coincidental.
 */

/** Pure neutral. Type and dividers. */
export const grey = [
  "#000000",
  "#191c21",
  "#2e3037",
  "#3b3e45",
  "#53555d",
  "#74777f",
  "#8e9099",
  "#a9abb3",
  "#c4c6cf",
] as const;

/** Blue-tinted neutral. Every surface in the app. Base #1e2633 "Neutral". */
export const slate = [
  "#141d28",
  "#29313e",
  "#3a424f",
  "#515967",
  "#6f7787",
  "#8991a1",
  "#a3abbc",
  "#bfc7d8",
] as const;

/** Bids, price up, brand. Base #00c57a "Secondary". */
export const green = [
  "#002714",
  "#00391f",
  "#005230",
  "#007646",
  "#008954",
  "#00aa68",
  "#00c479",
  "#3fe092",
] as const;

/** Asks, price down. Base #ff3b69 "Tertiary". */
export const pink = [
  "#460314",
  "#670020",
  "#910030",
  "#c30646",
  "#e42457",
  "#fc4870",
  "#ff8797",
  "#ffb2ba",
] as const;

/**
 * Semantic aliases. Feature code uses these names only - a component should
 * never reach for `green[7]` directly, because "the bid text colour" is the
 * thing that might change, not "the seventh green".
 */
export const colors = {
  bg: {
    /** The near-black canvas the style guide calls "Primary". */
    root: "#0b0e14",
    topbar: "#060e1b",
    base: "#0b1420",
    elevated: slate[0],
    row: "#19212e",
    /** Pressed/hover state on rows and tiles. */
    rowActive: slate[1],
    /** For a `Surface` that only wants the padding and radius, not a fill. */
    transparent: "transparent",
  },

  text: {
    primary: "#dbe3f4",
    secondary: "#c6c6cb",
    /** Uppercase micro-labels and de-emphasised values. */
    muted: slate[5],
    inverted: "#0b0e14",
  },

  border: {
    subtle: "#45474b",
    strong: slate[2],
  },

  /** Price up / bid side. */
  up: {
    text: green[7],
    base: green[6],
    /** Depth overlay behind bid rows; alpha keeps the text readable. */
    fill: "rgba(63,224,146,0.1)",
    depth: "#0f3631",
  },

  /** Price down / ask side. */
  down: {
    text: "#ea295b",
    base: pink[4],
    fill: "rgba(234,41,91,0.1)",
    depth: "#3c1e2d",
  },

  brand: green[6],

  status: {
    live: green[6],
    /** A pair that has not ticked recently while the socket is healthy. */
    stale: slate[3],
    /** Reconnecting, and the per-row dots while the socket is down. */
    offline: pink[4],
    warning: "#f5a623",
    /** `warning` at 12%, for chip and banner backgrounds behind warning text. */
    warningFill: "rgba(245,166,35,0.12)",
  },
} as const;

export type Colors = typeof colors;
