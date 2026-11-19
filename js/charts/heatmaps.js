// Heatmaps: a correlation matrix (diverging) and a groups × items matrix (sequential).
import { currentTheme } from "../theme.js";
import { axis, baseLayout, colorbar } from "../plotting.js";
import { colorscale, divergingColorscale } from "../colors.js";

/**
 * A correlation matrix: square, −1 to 1, negative and positive in two hues around a neutral
 * middle. `matrix[i][j]` is the correlation of labels[i] with labels[j]; null cells stay empty.
 */
export function correlationHeatmap({ labels, matrix }, { theme = currentTheme(), margin } = {}) {
  return {
    data: [{ type: "heatmap", z: matrix, x: labels, y: labels, zmin: -1, zmax: 1, xgap: 1, ygap: 1,
      colorscale: divergingColorscale(theme), colorbar: colorbar(theme, { title: { text: "r" } }),
      hovertemplate: "%{y} – %{x}: r = %{z:.2f}<extra></extra>" }],
    layout: baseLayout({ margin: margin ?? { l: 60, r: 10, t: 10, b: 60 },
      xaxis: axis({ side: "bottom", showgrid: false, type: "category" }, theme),
      yaxis: axis({ autorange: "reversed", showgrid: false, type: "category" }, theme) }, theme),
  };
}

/** A sensible height for a correlation matrix of `n` labels. */
export const correlationHeight = (n) => Math.min(760, Math.max(320, 22 * n + 120));

/**
 * A matrix of magnitudes: one row per `rows` entry, one column per `columns` entry,
 * values[r][c] (null = empty cell). Light = low, dark = high.
 */
export function matrixHeatmap({ rows, columns, values }, { theme = currentTheme(), valueTitle, margin } = {}) {
  return {
    data: [{ type: "heatmap", x: columns, y: rows, z: values, colorscale: colorscale(theme.sequential), xgap: 1, ygap: 1,
      colorbar: colorbar(theme, valueTitle ? { title: { text: valueTitle } } : {}),
      hovertemplate: "%{y} · %{x}: %{z:.3f}<extra></extra>" }],
    layout: baseLayout({ margin: margin ?? { l: 90, r: 10, t: 10, b: 40 },
      xaxis: axis({ showgrid: false, type: "category" }, theme), yaxis: axis({ showgrid: false, type: "category", autorange: "reversed" }, theme) }, theme),
  };
}

/**
 * Turn per-group scores into a matrix for matrixHeatmap, columns ordered by their mean over the
 * groups, highest first. groups: [{ name, scores: { item: number } }]. A group without a score
 * for an item counts as 0 in the mean and shows an empty cell.
 */
export function scoresMatrix(groups) {
  const keys = [...new Set(groups.flatMap((g) => Object.keys(g.scores)))];
  const mean = (k) => groups.reduce((s, g) => s + (g.scores[k] ?? 0), 0) / groups.length;
  const columns = keys.sort((a, b) => mean(b) - mean(a));
  return { rows: groups.map((g) => g.name), columns, values: groups.map((g) => columns.map((k) => g.scores[k] ?? null)) };
}
