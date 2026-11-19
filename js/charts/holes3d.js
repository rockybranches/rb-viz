// Drill holes in 3D: each hole a line from its collar, each assayed interval a marker on it.
import { currentTheme } from "../theme.js";
import { baseLayout, colorbar } from "../plotting.js";
import { colorscale } from "../colors.js";
import { esc } from "../format.js";

/**
 * Where a straight hole is after `distance` along it, relative to its collar: { dx, dy, dz }
 * (east, north, up), in the units of `distance`. Azimuth is degrees clockwise from north;
 * inclination is degrees below horizontal (90 = vertical, the default).
 */
export function traceOffset({ azimuth = 0, inclination = 90 }, distance) {
  const inc = (inclination ?? 90) * Math.PI / 180, az = (azimuth ?? 0) * Math.PI / 180;
  const horizontal = distance * Math.cos(inc);
  return { dx: horizontal * Math.sin(az), dy: horizontal * Math.cos(az), dz: -distance * Math.sin(inc) };
}

/**
 * The surface projection of a hole as [[lat, lon], [lat, lon]]: collar and end. `collar` has
 * lat, lon, azimuth, inclination; `metres` is the hole's length in metres.
 */
export function surfaceTrace(collar, metres) {
  const end = traceOffset(collar, metres);
  return [[collar.lat, collar.lon],
    [collar.lat + end.dy / 111320, collar.lon + end.dx / (111320 * Math.cos(collar.lat * Math.PI / 180))]];
}

/**
 * Holes in 3D, markers coloured and sized by log10 of a value.
 *
 * holes: [{ id, x, y, z, azimuth, inclination, length, intervals: [{ from, to, value }] }]
 *   x, y, z: collar easting, northing, elevation; length and interval depths along the hole.
 * options:
 *   depthScale   multiplies length/from/to into the units of x, y, z (0.3048 for depths in feet
 *                on a metre grid); default 1
 *   valueTitle   colour bar title, e.g. "Au g/t"
 *   depthUnit    shown in the tooltip, e.g. "ft"
 *   range        [min, max] of log10(value) for the colour scale; default: the data's
 *   axisTitles   [x, y, z] titles
 */
export function holes3d(holes, { depthScale = 1, valueTitle = "value", depthUnit = "", range, theme = currentTheme(),
  axisTitles = ["Easting", "Northing", "Elevation"], aspect = { x: 1, y: 2.2, z: 0.9 } } = {}) {
  const logs = holes.flatMap((h) => h.intervals.filter((iv) => iv.value > 0).map((iv) => Math.log10(iv.value)));
  const [cmin, cmax] = range ?? (logs.length ? [Math.min(...logs), Math.max(...logs)] : [0, 1]);
  const ticks = [];
  for (let t = Math.ceil(cmin); t <= Math.floor(cmax); t++) ticks.push(t);
  const data = [];
  let barDrawn = false;
  for (const h of holes) {
    const end = traceOffset(h, h.length * depthScale);
    data.push({ type: "scatter3d", mode: "lines+text", x: [h.x, h.x + end.dx], y: [h.y, h.y + end.dy], z: [h.z, h.z + end.dz],
      line: { color: theme.muted, width: 3 }, text: [esc(h.id), ""], textposition: "top center", textfont: { color: theme.ink, size: 13 },
      hoverinfo: "skip", showlegend: false });
    const pts = h.intervals.filter((iv) => iv.value != null && iv.value > 0);
    const pos = pts.map((iv) => traceOffset(h, ((iv.from + (iv.to ?? iv.from)) / 2) * depthScale));
    data.push({ type: "scatter3d", mode: "markers", name: h.id, showlegend: false,
      x: pos.map((p) => h.x + p.dx), y: pos.map((p) => h.y + p.dy), z: pos.map((p) => h.z + p.dz),
      customdata: pts.map((iv) => [esc(h.id), iv.from, iv.to ?? iv.from, iv.value]),
      hovertemplate: `%{customdata[0]} %{customdata[1]}–%{customdata[2]}${depthUnit ? ` ${esc(depthUnit)}` : ""}<br>${esc(valueTitle)} %{customdata[3]}<extra></extra>`,
      marker: { size: pts.map((iv) => 2 + 6.6 * Math.min(1, Math.max(0, (Math.log10(iv.value) - cmin) / ((cmax - cmin) || 1)))),
        color: pts.map((iv) => Math.log10(iv.value)), colorscale: colorscale(theme.sequential), cmin, cmax, line: { width: 0 }, opacity: 0.9,
        // one colour bar for the whole chart, labelled in real values rather than logs
        colorbar: !barDrawn && pts.length ? colorbar(theme, { title: { text: valueTitle }, len: 0.6,
          ...(ticks.length ? { tickvals: ticks, ticktext: ticks.map((t) => String(Number((10 ** t).toPrecision(3)))) } : {}) }) : undefined } });
    if (pts.length) barDrawn = true;
  }
  const sceneAxis = (title) => ({ title: { text: title }, gridcolor: theme.grid, zerolinecolor: theme.axis, showbackground: false, tickfont: { color: theme.ink2, size: 10 } });
  return {
    data,
    layout: { ...baseLayout({}, theme), margin: { l: 0, r: 0, t: 0, b: 0 },
      scene: { xaxis: sceneAxis(axisTitles[0]), yaxis: sceneAxis(axisTitles[1]), zaxis: sceneAxis(axisTitles[2]),
        aspectmode: "manual", aspectratio: aspect, camera: { eye: { x: 1.9, y: -1.3, z: 0.9 } } } },
  };
}
