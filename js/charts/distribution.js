// Distribution of a skewed, positive measure (grades): a histogram of log10 values.
import { currentTheme } from "../theme.js";
import { axis, baseLayout } from "../plotting.js";
import { log10 } from "../format.js";

/**
 * Overlaid histograms of log10(value), each as a percentage of its own group so groups of
 * different sizes compare.
 *
 * groups: [{ name, values: [], color? }]. Zero and negative values are left out. With two or
 * more groups and no colours, the first is grey ("others") and the rest take series colours.
 * options: title (x-axis, the measure's name), binSize in log10 units (default: 40 bins).
 */
export function logHistogram(groups, { title = "value", binSize, theme = currentTheme() } = {}) {
  const many = groups.length > 1;
  const bins = binSize ? { xbins: { size: binSize } } : { nbinsx: 40 };
  const data = groups.map((g, i) => ({ type: "histogram", histnorm: "percent", opacity: 0.75, ...bins,
    x: g.values.map(log10).filter((v) => v != null), name: g.name,
    marker: { color: g.color ?? (many ? (i === 0 ? theme.axis : theme.series[i - 1]) : theme.series[0]) } }));
  return {
    data,
    layout: baseLayout({ barmode: "overlay", bargap: 0.04, showlegend: many, legend: { orientation: "h", y: 1.08, x: 0, font: { color: theme.ink2 } },
      margin: { l: 50, r: 10, t: many ? 30 : 10, b: 50 },
      xaxis: axis({ title: `log₁₀ ${title}` }, theme), yaxis: axis({ title: "% of samples" }, theme) }, theme),
    empty: data.every((t) => !t.x.length),
  };
}
