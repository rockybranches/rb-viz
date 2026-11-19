// Scatter charts: cross-plot of two measures, plan view of positions, overlaid lines.
import { currentTheme } from "../theme.js";
import { axis, baseLayout, colorbar } from "../plotting.js";
import { colorscale, quantileLogScale } from "../colors.js";
import { esc, log10 } from "../format.js";

const GL_FROM = 2000; // points per trace above which WebGL is used

/**
 * Cross-plot of one measure against another, on log axes by default.
 *
 * groups: [{ name, points: [{ x, y, label?, id? }], color?, size? }], drawn in order, so put
 * the group to emphasise last. Without colours the first group is grey ("others") when there is
 * more than one, and the rest take the series colours.
 * On log axes points with a zero or negative coordinate are left out. `id` comes back as
 * point.customdata[1] in onPointClick().
 */
export function crossPlot(groups, { xTitle = "x", yTitle = "y", log = true, theme = currentTheme() } = {}) {
  const usable = (p) => p.x != null && p.y != null && (!log || (p.x > 0 && p.y > 0));
  const many = groups.length > 1;
  const data = groups.map((g, i) => {
    const pts = g.points.filter(usable);
    const emphasised = !many || i > 0;
    return { type: pts.length > GL_FROM ? "scattergl" : "scatter", mode: "markers", name: g.name,
      x: pts.map((p) => p.x), y: pts.map((p) => p.y), customdata: pts.map((p) => [esc(p.label ?? ""), p.id ?? null]),
      hovertemplate: `%{customdata[0]}<br>${esc(xTitle)} %{x}<br>${esc(yTitle)} %{y}<extra></extra>`,
      marker: { color: g.color ?? (emphasised ? theme.series[many ? i - 1 : 0] : theme.axis), size: g.size ?? (emphasised ? (many ? 8 : 7) : 6),
        line: { color: theme.surface, width: 1 } } };
  });
  const scale = log ? { type: "log" } : {};
  const suffix = log ? " (log)" : "";
  return {
    data,
    layout: baseLayout({ xaxis: axis({ ...scale, title: `${xTitle}${suffix}` }, theme), yaxis: axis({ ...scale, title: `${yTitle}${suffix}` }, theme),
      showlegend: many, legend: { orientation: "h", y: 1.08, x: 0, font: { color: theme.ink2 } }, margin: { l: 60, r: 10, t: 30, b: 50 } }, theme),
    empty: data.every((t) => !t.x.length),
  };
}

/**
 * Plan view: positions on equal x / y axes with no basemap, for projected or local coordinates.
 * points: [{ x, y, value?, label?, id? }]. With values, colour follows log10(value) between its
 * 5th and 95th percentile.
 */
export function planView(points, { xTitle = "Easting", yTitle = "Northing", valueTitle = "value", theme = currentTheme() } = {}) {
  const pts = points.filter((p) => p.x != null && p.y != null);
  const scale = quantileLogScale(pts.map((p) => p.value), { steps: theme.sequential, missing: theme.muted });
  return {
    data: [{ type: pts.length > GL_FROM ? "scattergl" : "scatter", mode: "markers", x: pts.map((p) => p.x), y: pts.map((p) => p.y),
      customdata: pts.map((p) => [esc(p.label ?? ""), p.id ?? null, p.value ?? null]),
      hovertemplate: `%{customdata[0]}${scale ? `<br>${esc(valueTitle)} %{customdata[2]}` : ""}<extra></extra>`,
      marker: { size: 9, line: { color: theme.surface, width: 1 },
        color: scale ? pts.map((p) => log10(p.value)) : theme.series[0], colorscale: colorscale(theme.sequential), cmin: scale?.lo, cmax: scale?.hi,
        colorbar: scale ? colorbar(theme, { title: { text: `log₁₀ ${valueTitle}` } }) : undefined } }],
    layout: baseLayout({ xaxis: axis({ title: xTitle }, theme), yaxis: axis({ title: yTitle, scaleanchor: "x" }, theme), margin: { l: 70, r: 10, t: 10, b: 50 } }, theme),
  };
}

/**
 * Lines over a shared x axis, e.g. X-ray diffractograms. series: [{ name, x: [], y: [] }], at
 * most as many as there are series colours (six); compare a few at a time.
 */
export function lineOverlay(series, { xTitle = "x", yTitle = "y", theme = currentTheme() } = {}) {
  return {
    data: series.map((s, i) => ({ type: "scatter", mode: "lines", name: s.name, x: s.x, y: s.y,
      line: { color: s.color ?? theme.series[i % theme.series.length], width: 1.5 },
      hovertemplate: `${esc(s.name)}: %{x}, %{y}<extra></extra>` })),
    layout: baseLayout({ xaxis: axis({ title: xTitle }, theme), yaxis: axis({ title: yTitle }, theme),
      showlegend: series.length > 1, legend: { orientation: "h", y: 1.1, x: 0, font: { color: theme.ink2 } }, margin: { l: 56, r: 12, t: 30, b: 50 } }, theme),
  };
}
