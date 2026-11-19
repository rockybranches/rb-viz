// Leaflet building blocks. Leaflet is not bundled: the page loads it (1.9.x) and the functions
// here find it as the global `L`, or take it as the `L` option.
import { esc } from "../format.js";

export const leaflet = (L) => {
  const lib = L ?? globalThis.L;
  if (!lib) throw new Error("Leaflet is not loaded: include leaflet.js before drawing a map");
  return lib;
};

/** Tile layers used across the projects. */
export const BASEMAPS = {
  osm: { name: "OpenStreetMap", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' } },
  topo: { name: "USGS topographic", url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
    options: { maxZoom: 16, attribution: "USGS The National Map" } },
  imagery: { name: "Imagery", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: { maxZoom: 18, attribution: "Esri World Imagery" } },
};

/**
 * Add basemaps to a map: the first is shown, and a layer switcher is added when there are
 * several. keys: names from BASEMAPS. `exportable: true` requests the tiles so that they can
 * be copied into a PNG (see renderMapPng). Returns { key: tileLayer }.
 */
export function addBasemaps(map, keys = ["osm"], { L, exportable = false, scale = true, imperial = true } = {}) {
  L = leaflet(L);
  const layers = {}, named = {};
  for (const key of keys) {
    const b = BASEMAPS[key];
    if (!b) throw new Error(`Unknown basemap "${key}"; known: ${Object.keys(BASEMAPS).join(", ")}`);
    layers[key] = L.tileLayer(b.url, { ...b.options, ...(exportable ? { crossOrigin: "" } : {}) });
    named[b.name] = layers[key];
  }
  layers[keys[0]].addTo(map);
  if (keys.length > 1) L.control.layers(named, null, { position: "topright" }).addTo(map);
  if (scale) L.control.scale({ imperial }).addTo(map);
  return layers;
}

/**
 * A legend in a corner of the map. items: [{ color, label }]; `shape` is "circle" (points) or
 * "square" (areas). Text is escaped. Returns the Leaflet control (already added when `map` is
 * given); control.remove() takes it off.
 */
export function legendControl(items, { L, map, title, shape = "circle", position = "bottomright" } = {}) {
  L = leaflet(L);
  const control = L.control({ position });
  control.onAdd = () => {
    const div = L.DomUtil.create("div", "map-legend");
    div.innerHTML = (title ? `<strong>${esc(title)}</strong>` : "")
      + items.map((it) => `<div><i class="${shape === "square" ? "square" : ""}" style="background:${esc(it.color)}"></i>${esc(it.label)}</div>`).join("");
    return div;
  };
  if (map) control.addTo(map);
  return control;
}

/**
 * A button on the map. Clicks do not reach the map underneath. Returns the control; its
 * getContainer() is the <button>, e.g. to hide it.
 */
export function buttonControl(text, onClick, { L, map, title = "", position = "topleft" } = {}) {
  L = leaflet(L);
  const control = L.control({ position });
  control.onAdd = () => {
    const button = L.DomUtil.create("button", "map-button");
    button.type = "button";
    button.textContent = text;
    button.title = title;
    L.DomEvent.disableClickPropagation(button);
    button.addEventListener("click", onClick);
    return button;
  };
  if (map) control.addTo(map);
  return control;
}

/**
 * A pin with an optional name beside it (a little up and to the right, haloed so it reads on
 * any basemap). Returns { marker, setLatLng(lat, lon), setLabel(text), remove() }.
 */
export function labeledPin(map, { L, lat = 0, lon = 0, label = "", radius = 7 } = {}) {
  L = leaflet(L);
  const marker = L.circleMarker([lat, lon], { radius, color: "#111", weight: 2, fillColor: "#fff", fillOpacity: 1 });
  const pin = {
    marker,
    setLatLng(newLat, newLon) { marker.setLatLng([newLat, newLon]).addTo(map).bringToFront(); return pin; },
    setLabel(text) {
      marker.unbindTooltip();
      if (text) marker.bindTooltip(esc(text), { permanent: true, direction: "right", offset: [8, -14], className: "site-label", interactive: false });
      return pin;
    },
    remove() { marker.remove(); return pin; },
  };
  if (label) pin.setLabel(label);
  return pin;
}

/**
 * A georeferenced image over the map, switched on by a checkbox and faded by a range input
 * (both optional, both yours to place on the page). bounds: [[south, west], [north, east]].
 * Pass `exportable: true` for an image from another origin that should appear in renderMapPng().
 */
export function imageOverlay(map, src, bounds, { L, checkbox, slider, opacity = 0.6, exportable = false } = {}) {
  L = leaflet(L);
  // exportable: request the image so that renderMapPng may copy it (its server must allow CORS)
  const layer = L.imageOverlay(src, bounds, { opacity: slider ? +slider.value : opacity, ...(exportable ? { crossOrigin: "" } : {}) });
  if (checkbox) {
    const sync = () => { if (checkbox.checked) { layer.addTo(map); map.fitBounds(bounds); } else layer.remove(); };
    checkbox.addEventListener("change", sync);
    if (checkbox.checked) layer.addTo(map);
  } else layer.addTo(map);
  slider?.addEventListener("input", () => layer.setOpacity(+slider.value));
  return layer;
}
