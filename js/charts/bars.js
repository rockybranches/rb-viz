// Ranked horizontal bars: "which elements track gold", R² by element, and the like.
import { currentTheme } from "../theme.js";
import { axis, baseLayout } from "../plotting.js";

/**
 * Horizontal bars, largest at the top.
 *
 * items: [{ label, value }] or an object { label: value }. They are sorted by value unless
 * `sort: false`, and only the top `limit` are drawn.
 */
export function rankedBars(items, { valueTitle, limit = 14, sort = true, theme = currentTheme(), labelWidth } = {}) {
  let rows = Array.isArray(items) ? items.slice() : Object.entries(items).map(([label, value]) => ({ label, value }));
  rows = rows.filter((r) => r.value != null && !Number.isNaN(r.value));
  if (sort) rows.sort((a, b) => b.value - a.value);
  rows = rows.slice(0, limit).reverse(); // Plotly draws the first category at the bottom
  const longest = rows.reduce((n, r) => Math.max(n, String(r.label).length), 0);
  return {
    data: [{ type: "bar", orientation: "h", x: rows.map((r) => r.value), y: rows.map((r) => String(r.label)),
      marker: { color: theme.series[0] }, hovertemplate: "%{y}: %{x:.3f}<extra></extra>" }],
    layout: baseLayout({ margin: { l: labelWidth ?? Math.max(44, 12 + 7 * longest), r: 16, t: 8, b: 40 }, bargap: 0.35,
      xaxis: axis({ title: valueTitle }, theme), yaxis: axis({ showgrid: false, type: "category" }, theme) }, theme),
    config: { displayModeBar: false },
  };
}
