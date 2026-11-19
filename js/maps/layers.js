// Map layers for the data the projects show: graded sample points, drill collars with their
// traces, and a reachable area in distance bands.
import { esc, fixed, fmt } from "../format.js";
import { currentTheme } from "../theme.js";
import { BAND_COLORS, quantileLogScale } from "../colors.js";
import { surfaceTrace } from "../charts/holes3d.js";
import { leaflet, legendControl } from "./leaflet.js";

/**
 * Sample points, coloured and sized by a value on a log scale (5th to 95th percentile).
 *
 * points: [{ lat, lon, value?, label?, popup? }]. Points at the same position are drawn once,
 * showing the one with the highest value and how many more are there. `popup` is HTML you have
 * escaped yourself; without it the popup shows the label, value and position.
 * options: valueTitle (legend title; no legend without values), fit (default true: zoom to the
 * points), theme.
 * Returns { layer, legend, scale, bounds }.
 */
export function gradedPoints(map, points, { L, valueTitle = "", fit = true, theme = currentTheme() } = {}) {
  L = leaflet(L);
  const pts = points.filter((p) => p.lat != null && p.lon != null);
  const scale = quantileLogScale(pts.map((p) => p.value), { steps: theme.sequential, missing: theme.muted });
  const groups = new Map();
  for (const p of pts) {
    const key = `${p.lat},${p.lon}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const layer = L.layerGroup().addTo(map);
  const bounds = [];
  for (const group of groups.values()) {
    const p = group.reduce((best, x) => ((x.value ?? -Infinity) > (best.value ?? -Infinity) ? x : best), group[0]);
    const t = scale ? scale.t(p.value) : null;
    const more = group.length > 1 ? ` and ${group.length - 1} more here` : "";
    const popup = p.popup ?? `<b>${esc(p.label ?? "")}</b>${more}<br>${valueTitle && p.value != null ? `${esc(valueTitle)}: ${fmt(p.value)}<br>` : ""}${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
    L.circleMarker([p.lat, p.lon], { radius: 5 + 6 * (t ?? 0), color: "#fff", weight: 1.5, fillColor: scale ? scale.color(t) : theme.series[0], fillOpacity: 0.9 })
      .bindPopup(popup).addTo(layer);
    bounds.push([p.lat, p.lon]);
  }
  if (fit && bounds.length === 1) map.setView(bounds[0], 13);
  else if (fit && bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  const legend = scale && !scale.flat
    ? legendControl([1, 0.5, 0].map((pos) => ({ color: scale.color(pos), label: fmt(scale.value(pos)) })), { L, map, title: valueTitle })
    : null;
  return { layer, legend, scale, bounds };
}

/**
 * Drill collars with the surface projection of each hole and its name beside it.
 *
 * collars: [{ id, lat, lon, azimuth?, inclination?, metres?, popup? }]; `metres` is the hole's
 * length (no trace is drawn without it). `popup` is HTML you have escaped yourself.
 * Returns { layer, bounds }.
 */
export function collarTraces(map, collars, { L, fit = true, theme = currentTheme() } = {}) {
  L = leaflet(L);
  const layer = L.layerGroup().addTo(map);
  const bounds = [];
  for (const c of collars) {
    if (c.metres) {
      const line = surfaceTrace(c, c.metres);
      L.polyline(line, { color: theme.series[1], weight: 4, opacity: 0.95 }).addTo(layer);
      bounds.push(line[1]);
    }
    const marker = L.circleMarker([c.lat, c.lon], { radius: 7, color: "#fff", weight: 2, fillColor: theme.header, fillOpacity: 1 })
      .bindTooltip(String(c.id), { permanent: true, direction: "right", className: "pt-label", offset: [8, 0] });
    if (c.popup) marker.bindPopup(c.popup);
    marker.addTo(layer);
    bounds.push([c.lat, c.lon]);
  }
  if (fit && bounds.length) map.fitBounds(bounds, { padding: [60, 60] });
  return { layer, bounds };
}

/**
 * A reachable area in distance bands, with its legend.
 *
 * geojson: a FeatureCollection whose features have properties { band, from_m, to_m }, band 0
 * nearest. The area is usually thousands of touching cells; drawn translucent they would show
 * seams, so they are drawn solid on a canvas in a pane of their own and the pane is made
 * translucent. Create the map with `preferCanvas: true`.
 * Returns { layer, legend, bounds } (bounds may be invalid for an empty area: check isValid()).
 */
export function bandedArea(map, geojson, { L, colors = BAND_COLORS, title = "Distance by road", opacity = 0.55, pane = "area" } = {}) {
  L = leaflet(L);
  if (!map.getPane(pane)) {
    // above the tiles, below the overlay pane, so pins and markers stay on top of the area
    Object.assign(map.createPane(pane).style, { opacity: String(opacity), zIndex: "350" });
  }
  const renderer = (map._rbvRenderers ??= {})[pane] ??= L.canvas({ pane });
  const color = (feature) => colors[Math.min(feature.properties.band, colors.length - 1)];
  const layer = L.geoJSON(geojson, { pane, renderer, interactive: false,
    style: (feature) => ({ color: color(feature), weight: 1, fillColor: color(feature), fillOpacity: 1 }) }).addTo(map);
  const legend = legendControl(geojson.features.map((f) => ({ color: color(f),
    label: `${fixed(f.properties.from_m / 1000, 1)}–${fixed(f.properties.to_m / 1000, 1)} km` })), { L, map, title, shape: "square" });
  return { layer, legend, bounds: layer.getBounds() };
}
