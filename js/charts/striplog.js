// Strip log: tracks side by side against depth, the standard view of a drill hole.
import { currentTheme } from "../theme.js";
import { axis, baseLayout, onPointClick } from "../plotting.js";
import { esc } from "../format.js";

const base = (iv) => iv.to ?? iv.from;
const mid = (iv) => (iv.from + base(iv)) / 2;

/**
 * Each interval as a flat step from its top to its base: { x: values, y: depths }. A missing
 * value or a gap between intervals breaks the line (a null pair), so nothing is drawn across
 * depths that were not sampled.
 */
export function stepSeries(intervals, tolerance = 1e-6) {
  const x = [], y = [];
  let last = null;
  for (const iv of intervals) {
    if (iv.value == null) { x.push(null); y.push(null); last = null; continue; }
    if (last != null && Math.abs(last - iv.from) > tolerance) { x.push(null); y.push(null); }
    x.push(iv.value, iv.value); y.push(iv.from, base(iv)); last = base(iv);
  }
  return { x, y };
}

/**
 * A strip log.
 *
 * tracks: left to right, each one of
 *   { type: "category", title, intervals: [{ from, to, label, detail? }], color: (label) => css }
 *       coloured bands, e.g. lithology; `detail` is added to the tooltip
 *   { type: "value", title, name?, intervals: [{ from, to, value, note? }],
 *     log?: false, range?: [min, max], color?, width?: 1 }
 *       a filled step curve; `note` (e.g. "below detection") is added to the tooltip. A log axis
 *       is used only when every value is positive. `width` is relative to the other tracks.
 * options:
 *   depthTitle   y-axis title, default "Depth"
 *   selected     a depth to mark with a line across all tracks
 *   maxTracks    keep only this many value tracks (for narrow screens); category tracks stay
 *   theme        default: the page's
 *
 * Returns { data, layout, config } for draw(). Depth increases downward. Use onDepthPick() to
 * react to clicks.
 */
export function stripLog(tracks, { depthTitle = "Depth", selected = null, maxTracks = Infinity, theme = currentTheme() } = {}) {
  let kept = 0;
  tracks = tracks.filter((t) => t.type === "category" || kept++ < maxTracks);
  const all = tracks.flatMap((t) => t.intervals);
  const bottom = all.length ? Math.max(...all.map(base)) : 1;
  const top = all.length ? Math.min(...all.map((iv) => iv.from)) : 0;
  const pad = Math.max(1, (bottom - top) * 0.01);
  const layout = baseLayout({ margin: { l: 58, r: 8, t: 34, b: 30 }, showlegend: false, hovermode: "y unified", dragmode: "zoom", bargap: 0 }, theme);
  layout.yaxis = axis({ range: [bottom + pad, Math.min(0, top) - pad], zeroline: false, title: depthTitle,
    showspikes: true, spikemode: "across", spikethickness: 1, spikecolor: theme.muted, spikedash: "solid" }, theme);

  const widths = tracks.map((t) => t.width ?? (t.type === "category" ? 0.7 : 1));
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  const gap = 0.012;
  const data = [];
  let x0 = 0;
  tracks.forEach((t, i) => {
    const xa = i === 0 ? "x" : `x${i + 1}`, key = i === 0 ? "xaxis" : `xaxis${i + 1}`;
    const w = widths[i] / total;
    layout[key] = axis({ domain: [x0, Math.min(1, x0 + w - gap)], anchor: "y", side: "top", fixedrange: true,
      title: { text: esc(t.title), font: { size: 11, color: theme.ink }, standoff: 4 }, tickfont: { size: 10, color: theme.ink2 } }, theme);
    x0 += w;
    if (t.type === "category") {
      Object.assign(layout[key], { showticklabels: false, range: [0, 1], showgrid: false, zeroline: false });
      const rows = t.intervals.filter((iv) => iv.label != null && iv.label !== "");
      data.push({ type: "bar", orientation: "h", xaxis: xa, yaxis: "y", x: rows.map(() => 1), y: rows.map(mid),
        width: rows.map((iv) => (base(iv) - iv.from) || 1),
        marker: { color: rows.map((iv) => t.color(iv.label)), line: { width: 0 } },
        customdata: rows.map((iv) => esc(iv.detail ? `${iv.label}, ${iv.detail}` : iv.label)),
        hovertemplate: "%{customdata}<extra></extra>" });
      return;
    }
    const color = t.color ?? theme.series[0];
    if (t.range) layout[key].range = t.range;
    const values = t.intervals.map((iv) => iv.value).filter((v) => v != null);
    if (t.log && values.length && values.every((v) => v > 0)) layout[key].type = "log";
    const steps = stepSeries(t.intervals);
    data.push({ type: "scatter", mode: "lines", xaxis: xa, yaxis: "y", x: steps.x, y: steps.y,
      line: { color, width: 1.5 }, fill: "tozerox", fillcolor: withAlpha(color, 0.2), hoverinfo: "skip" });
    // invisible markers at interval mid-points carry the tooltip
    data.push({ type: "scatter", mode: "markers", xaxis: xa, yaxis: "y", x: t.intervals.map((iv) => iv.value), y: t.intervals.map(mid),
      marker: { size: 8, opacity: 0 }, customdata: t.intervals.map((iv) => (iv.note ? ` (${esc(iv.note)})` : "")),
      hovertemplate: `${esc(t.name ?? t.title)} %{x}%{customdata}<extra></extra>` });
  });
  if (selected != null) {
    layout.shapes = [{ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: selected, y1: selected, line: { color: theme.divergePos, width: 2 } }];
  }
  return { data, layout, config: { scrollZoom: false } };
}

/** #rrggbb with an alpha channel; other colour formats are returned unchanged. */
function withAlpha(color, alpha) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  return color + Math.round(alpha * 255).toString(16).padStart(2, "0");
}

/**
 * Call `handler(depth)` when the strip log is clicked. `step` rounds the depth (0.5 → nearest
 * half unit). Safe to call after every redraw.
 */
export function onDepthPick(el, handler, { step = 0.01 } = {}) {
  onPointClick(el, (p) => { if (p.y != null) handler(Math.round(p.y / step) * step); });
}

/** A sensible chart height for a strip log of `n` intervals. */
export const stripLogHeight = (n) => Math.min(1400, Math.max(560, 14 * n + 120));

/**
 * The interval that contains a depth, else the one whose top is nearest. null for no intervals.
 */
export function intervalAt(intervals, depth) {
  return intervals.find((iv) => iv.from <= depth && depth < base(iv))
    ?? intervals.reduce((best, iv) => (!best || Math.abs(iv.from - depth) < Math.abs(best.from - depth) ? iv : best), null);
}

/**
 * How much of a hole each category takes: [{ name, length }], longest first. Intervals without
 * a label are left out; an interval without a base counts as one unit.
 */
export function categoryShares(intervals) {
  const length = new Map();
  for (const iv of intervals) {
    if (iv.label == null || iv.label === "") continue;
    const key = String(iv.label);
    length.set(key, (length.get(key) ?? 0) + ((base(iv) - iv.from) || 1));
  }
  return [...length].map(([name, len]) => ({ name, length: len })).sort((a, b) => b.length - a.length);
}
