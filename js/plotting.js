// Plotly helpers: one look for every chart. Plotly itself is not bundled; the page loads it
// (plotly.js-dist-min 2.x) and the functions here find it as the global `Plotly`, or take it
// as `config.Plotly`.
import { currentTheme } from "./theme.js";

/** Axis settings in the theme's colours. `extra` is merged over them. */
export function axis(extra = {}, theme = currentTheme()) {
  return {
    gridcolor: theme.grid, linecolor: theme.axis, zerolinecolor: theme.axis,
    tickfont: { color: theme.ink2, size: 11 }, ...extra,
    title: { font: { color: theme.ink2, size: 12 }, ...titleOf(extra.title) },
  };
}

const titleOf = (title) => (typeof title === "string" ? { text: title } : title ?? {});

/** A transparent layout with themed fonts, axes, hover labels and a legend under the chart. */
export function baseLayout(extra = {}, theme = currentTheme()) {
  return {
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: theme.font, color: theme.ink2, size: 12 },
    margin: { l: 56, r: 16, t: 16, b: 44 },
    xaxis: axis({}, theme), yaxis: axis({}, theme),
    hoverlabel: { bgcolor: theme.surface, bordercolor: theme.axis, font: { color: theme.ink, size: 12 } },
    legend: { orientation: "h", y: -0.18, font: { color: theme.ink2 } },
    ...extra,
  };
}

/** A themed colour bar. */
export const colorbar = (theme, extra = {}) => ({ thickness: 12, tickfont: { color: theme.ink2 }, ...extra });

export const PLOT_CONFIG = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"] };

const resolve = (el) => (typeof el === "string" ? document.getElementById(el) : el);

/** Replace a chart area with a short explanation (no data, nothing selected, …). */
export function showEmpty(el, message) {
  const node = resolve(el);
  globalThis.Plotly?.purge?.(node);
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = message;
  node.replaceChildren(p);
  node.style.minHeight = "0";
}

/**
 * Draw a chart spec ({ data, layout, config }, as returned by the chart functions) into an
 * element or element id. Redrawing into the same element updates the chart in place.
 * Returns the Plotly promise, or null when Plotly is not on the page (offline viewing); the
 * element then says so instead of staying blank.
 */
export function draw(el, spec, config = {}) {
  const node = resolve(el);
  const { Plotly = globalThis.Plotly, ...rest } = config;
  if (!Plotly) {
    showEmpty(node, "Charts need Plotly, which could not be loaded (offline?).");
    return null;
  }
  if (node.querySelector(":scope > p.empty")) { node.replaceChildren(); node.style.minHeight = ""; }
  return Plotly.react(node, spec.data, spec.layout, { ...PLOT_CONFIG, ...spec.config, ...rest });
}

/**
 * Call `handler(point, event)` when a point of the chart is clicked, replacing any handler set
 * before (so it is safe to call after every redraw). `point` is Plotly's: x, y, customdata, ….
 */
export function onPointClick(el, handler) {
  const node = resolve(el);
  if (!node?.on) return;
  node.removeAllListeners?.("plotly_click");
  node.on("plotly_click", (ev) => { const p = ev.points?.[0]; if (p) handler(p, ev); });
}
