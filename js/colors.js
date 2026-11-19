// Palettes and colour scales. The hex values live in tokens.js (generated from tokens.json).
import { TOKENS } from "./tokens.js";
import { log10 } from "./format.js";

/** Series colours in their fixed order; use them in order, never by picking. */
export const SERIES = TOKENS.series;
/** Twelve colours for categories that have no colour of their own. */
export const CATEGORICAL = TOKENS.categorical;
/** Light to dark blue, for magnitudes. */
export const SEQUENTIAL = TOKENS.sequential;
/** Dark to light blue, for distance bands, nearest first. */
export const BAND_COLORS = TOKENS.bands;
/** Lithology colours after common geologic-map conventions. */
export const LITHOLOGY_COLORS = TOKENS.lithology;

/** The colour of a logged lithology; grey for one that is not in the table. */
export const lithologyColor = (name) => LITHOLOGY_COLORS[name] ?? TOKENS["lithology-fallback"];

/**
 * A function giving each new value the next colour of the palette, and the same value the same
 * colour every time. Past the end of the palette the colours repeat, so always show the name
 * as well (legend, tooltip): colour must not be the only cue.
 */
export function categoricalScale(palette = CATEGORICAL, known = {}) {
  const seen = new Map();
  return (value) => {
    const key = String(value);
    if (known[key]) return known[key];
    if (!seen.has(key)) seen.set(key, palette[seen.size % palette.length]);
    return seen.get(key);
  };
}

/** A Plotly colorscale from a list of colours: [[0, c0], …, [1, cn]]. */
export const colorscale = (steps = SEQUENTIAL) => steps.map((c, i) => [steps.length === 1 ? 0 : i / (steps.length - 1), c]);

/** The Plotly colorscale for a correlation: negative, neutral, positive. */
export const divergingColorscale = (theme) => [[0, theme.divergeNeg], [0.5, theme.divergeMid], [1, theme.divergePos]];

/**
 * A colour and size scale on log10 of the values, between two quantiles (5th and 95th by default)
 * so a few extreme values do not wash out the rest. Returns null when no value is positive.
 *
 *   const scale = quantileLogScale(values);
 *   scale.t(v)        position 0–1 (null for a missing or non-positive value)
 *   scale.color(t)    the colour at a position; `missing` for null
 *   scale.colorOf(v)  color(t(v))
 *   scale.value(t)    the value at a position, for legend labels
 */
export function quantileLogScale(values, { steps = SEQUENTIAL, low = 0.05, high = 0.95, missing = "#898781" } = {}) {
  const logs = values.map(log10).filter((v) => v != null).sort((a, b) => a - b);
  if (!logs.length) return null;
  const q = (p) => logs[Math.min(logs.length - 1, Math.floor(p * (logs.length - 1)))];
  const lo = q(low), hi = Math.max(q(high), lo + 1e-9);
  const t = (v) => { const l = log10(v); return l == null ? null : Math.min(1, Math.max(0, (l - lo) / (hi - lo))); };
  const color = (pos) => (pos == null ? missing : steps[Math.round(pos * (steps.length - 1))]);
  return { lo, hi, flat: hi - lo <= 1e-6, t, color, colorOf: (v) => color(t(v)), value: (pos) => 10 ** (lo + pos * (hi - lo)) };
}
