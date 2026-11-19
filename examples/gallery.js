// Draws every rb-viz component with made-up data. Nothing here is real.
import * as V from "../dist/rb-viz.esm.js";

// ---- made-up data (seeded, so the page looks the same every time) --------------------------------
let seed = 7;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const ELEMENTS = ["Au", "Ag", "As", "Sb", "Hg", "Pb", "Zn", "Cu", "Mo", "Ba"];
const LITHS = ["Alluvium", "Siliceous Mudstone", "Chert", "Fault Breccia", "Quartzite", "Greenstone"];
const HOLES = [
  { id: "H1", x: 511000, y: 4510000, z: 1700, lat: 40.742, lon: -116.868, azimuth: 90, inclination: 60, length: 600 },
  { id: "H2", x: 511250, y: 4510450, z: 1725, lat: 40.746, lon: -116.865, azimuth: 270, inclination: 55, length: 520 },
  { id: "H3", x: 511100, y: 4510900, z: 1690, lat: 40.750, lon: -116.867, azimuth: 0, inclination: 90, length: 450 },
];
for (const h of HOLES) {
  h.rows = [];
  for (let from = 0; from < h.length; from += 5) {
    if (h.id === "H1" && from >= 300 && from < 330) continue;                 // a gap in the sampling
    const zone = Math.exp(-(((from - h.length * 0.55) / 60) ** 2));           // one mineralised zone
    const au = Math.exp(-4.5 + 4 * zone + 0.7 * normal());
    const row = { hole: h.id, from, to: from + 5, sample: `${h.id}-${String(from).padStart(3, "0")}`,
      lith: LITHS[Math.min(LITHS.length - 1, Math.floor((from / h.length) * LITHS.length + 0.4 * rand()))] };
    ELEMENTS.forEach((e, i) => { row[e] = e === "Au" ? au : Math.exp(i * 0.6 - 1 + (i < 5 ? 2.5 * zone : 0) + 0.8 * normal()); });
    row.belowAu = row.Au < 0.012;
    row.weight = Math.min(1, zone * 0.9 + 0.1 * rand());
    h.rows.push(row);
  }
}
const ROWS = HOLES.flatMap((h) => h.rows);

// soil samples scattered around the holes, richer near H2
const SOIL = Array.from({ length: 160 }, (_, i) => {
  const dx = (rand() - 0.5) * 1600, dy = (rand() - 0.5) * 1600;
  const near = Math.exp(-((dx - 250) ** 2 + (dy - 450) ** 2) / 250000);
  return { label: `S${i + 1}`, x: 511000 + dx, y: 4510000 + dy, lat: 40.742 + dy / 111320, lon: -116.868 + dx / 84400, au: Math.exp(-4 + 3.5 * near + 0.6 * normal()) };
});

// ---- theme: charts read their colours when drawn, so redraw everything on a switch --------------
V.bindThemeToggle(document.getElementById("theme"), { storageKey: "rb-viz-gallery-theme", onChange: drawCharts });

// ---- colours ---------------------------------------------------------------------------------
const swatchRow = (name, colors) => `<div class="swatch-row"><b>${V.esc(name)}</b>
  <div class="swatches">${colors.map((c) => `<span style="background:${c}" title="${c}"></span>`).join("")}</div></div>`;
document.getElementById("swatches").innerHTML =
  swatchRow("SERIES: lines and marks, in this order", V.SERIES) + swatchRow("SEQUENTIAL: magnitudes", V.SEQUENTIAL)
  + swatchRow("CATEGORICAL: categories without a colour of their own", V.CATEGORICAL)
  + swatchRow("BAND_COLORS: distance bands, nearest first", V.BAND_COLORS)
  + `<div class="swatch-row"><b>LITHOLOGY_COLORS</b></div><div class="legend">${Object.entries(V.LITHOLOGY_COLORS).map(([n, c]) =>
    `<span><i class="swatch" style="background:${c}"></i>${V.esc(n)}</span>`).join("")}</div>`;

// ---- blocks ----------------------------------------------------------------------------------
V.statTiles(document.getElementById("tiles"), [
  { value: HOLES.length, label: "drill holes" }, { value: ROWS.length.toLocaleString(), label: "assayed intervals" },
  { value: V.fmt(Math.max(...ROWS.map((r) => r.Au))), label: "highest Au (g/t)" },
  { value: ELEMENTS.length, label: "elements" }, { value: SOIL.length, label: "soil samples" }, { value: "2", label: "themes" },
]);

const hole = HOLES[0];
const lithIntervals = hole.rows.map((r) => ({ from: r.from, to: r.to, label: r.lith }));
V.compositionBar(document.getElementById("lithbar"), V.categoryShares(lithIntervals),
  { color: V.lithologyColor, label: "Lithology of H1", describe: (p) => `${p.name}: ${p.length} ft` });

const table = V.dataTable(document.getElementById("table"), [
  { key: "sample", title: "Sample", cell: (r) => `<b>${V.esc(r.sample)}</b>` },
  { key: "hole", title: "Hole" }, { key: "from", title: "From (ft)", numeric: true },
  { key: "Au", title: "Au g/t", numeric: true, className: (r) => (r.belowAu ? "bdl" : ""), cell: (r) => (r.belowAu ? "&lt;0.012" : V.fmt(r.Au)) },
  { key: "Ag", title: "Ag g/t", numeric: true },
], ROWS, { limit: 200, note: document.getElementById("table-note"), filterKeys: ["sample", "hole"],
  onRow: (r) => { document.getElementById("table-picked").textContent = `Picked ${r.sample}: Au ${V.fmt(r.Au)} g/t.`; } });
document.getElementById("filter").oninput = (e) => table.update({ filter: e.target.value });

// ---- drill hole ------------------------------------------------------------------------------
const state = { depth: 330, log: true, focus: "H1" };
function drawStrip() {
  const el = document.getElementById("strip");
  const value = (key) => hole.rows.map((r) => ({ from: r.from, to: r.to, value: r[key], note: key === "Au" && r.belowAu ? "below detection" : "" }));
  V.draw(el, V.stripLog([
    { type: "category", title: "Lithology", intervals: lithIntervals, color: V.lithologyColor },
    { type: "value", title: "Au (g/t)", name: "Au", intervals: value("Au"), log: state.log },
    { type: "value", title: "Ag (g/t)", name: "Ag", intervals: value("Ag"), log: state.log },
    { type: "value", title: "As (ppm)", name: "As", intervals: value("As"), log: state.log },
    { type: "value", title: "Au weight", name: "weight", intervals: value("weight"), range: [0, 1.02], color: V.currentTheme().series[1], width: 0.8 },
  ], { depthTitle: "Depth along hole (ft)", selected: state.depth, maxTracks: el.clientWidth < 640 ? 2 : Infinity }));
  V.onDepthPick(el, (d) => { state.depth = d; drawStrip(); showDetail(); }, { step: 0.5 });
}
function showDetail() {
  const r = V.intervalAt(hole.rows, state.depth);
  document.getElementById("detail").innerHTML = `
    <div class="card-head"><h3>${V.fixed(state.depth, 1)} ft</h3>
      <span class="badge"><i class="swatch" style="background:${V.lithologyColor(r.lith)}"></i>${V.esc(r.lith)}</span></div>
    <div class="note" style="margin-bottom:6px">Sample <b>${V.esc(r.sample)}</b> · ${r.from}–${r.to} ft</div>
    <div class="el-grid">${ELEMENTS.map((e) => `<div class="${e === "Au" && r.belowAu ? "bdl" : ""}">${e}<br><b>${V.fmt(r[e])}</b></div>`).join("")}</div>`;
}
document.getElementById("logx").onchange = (e) => { state.log = e.target.checked; drawStrip(); };

// ---- statistics for the geochemistry charts ---------------------------------------------------
function pearsonLog(a, b) {
  const x = a.map(Math.log10), y = b.map(Math.log10), n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
const column = (rows, e) => rows.map((r) => r[e]);
const corr = ELEMENTS.map((a) => ELEMENTS.map((b) => pearsonLog(column(ROWS, a), column(ROWS, b))));
const scores = HOLES.map((h) => ({ name: h.id, scores: Object.fromEntries(ELEMENTS.filter((e) => e !== "Au")
  .map((e) => [e, Math.max(0, pearsonLog(column(h.rows, "Au"), column(h.rows, e)))])) }));

const focus = document.getElementById("focus");
focus.innerHTML = HOLES.map((h) => `<button type="button" class="chip" data-h="${h.id}">${h.id}</button>`).join("");
focus.querySelectorAll("button").forEach((b) => { b.onclick = () => { state.focus = b.dataset.h; drawFocus(); }; });
function drawFocus() {
  focus.querySelectorAll("button").forEach((b) => { const on = b.dataset.h === state.focus; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  const pts = (rows) => rows.map((r) => ({ x: r.Ag, y: r.Au, label: r.sample }));
  const mine = ROWS.filter((r) => r.hole === state.focus), others = ROWS.filter((r) => r.hole !== state.focus);
  V.draw("cross", V.crossPlot([{ name: "Other holes", points: pts(others) }, { name: state.focus, points: pts(mine) }], { xTitle: "Ag g/t", yTitle: "Au g/t" }));
  V.draw("hist", V.logHistogram([{ name: "Other holes", values: column(others, "Au") }, { name: state.focus, values: column(mine, "Au") }], { title: "Au (g/t)", binSize: 0.15 }));
}

function drawCharts() {
  drawStrip();
  showDetail();
  V.draw("bars", V.rankedBars(scores[0].scores, { valueTitle: "correlation with Au in H1" }));
  V.draw("corr", V.correlationHeatmap({ labels: ELEMENTS, matrix: corr }));
  V.draw("matrix", V.matrixHeatmap(V.scoresMatrix(scores), { valueTitle: "r with Au" }));
  drawFocus();
  const twoTheta = Array.from({ length: 400 }, (_, i) => 5 + i * 0.15);
  const scan = (peaks) => twoTheta.map((t) => Math.round(40 + 15 * Math.sin(t) ** 2 + peaks.reduce((s, [p, hgt]) => s + hgt * Math.exp(-(((t - p) / 0.25) ** 2)), 0)));
  V.draw("lines", V.lineOverlay([{ name: "H1 412 ft", x: twoTheta, y: scan([[20.8, 300], [26.6, 900], [50.1, 150]]) },
    { name: "H3 118 ft", x: twoTheta, y: scan([[12.3, 220], [26.6, 600], [29.4, 420]]) }], { xTitle: "2θ (degrees)", yTitle: "counts" }));
  V.draw("holes3d", V.holes3d(HOLES.map((h) => ({ ...h, intervals: h.rows.map((r) => ({ from: r.from, to: r.to, value: r.Au })) })),
    { depthScale: 0.3048, valueTitle: "Au g/t", depthUnit: "ft", axisTitles: ["Easting (m)", "Northing (m)", "Elevation (m)"] }));
  V.draw("plan", V.planView(SOIL.map((p) => ({ x: p.x, y: p.y, value: p.au, label: p.label })), { xTitle: "Easting (m)", yTitle: "Northing (m)", valueTitle: "Au ppm" }));
}

drawCharts();

// ---- maps ------------------------------------------------------------------------------------
const pointsMap = L.map("map-points", { scrollWheelZoom: false });
V.addBasemaps(pointsMap, ["osm", "imagery"]);
V.gradedPoints(pointsMap, SOIL.map((p) => ({ lat: p.lat, lon: p.lon, value: p.au, label: p.label })), { valueTitle: "Au ppm" });

const collarMap = L.map("map-collars", { scrollWheelZoom: false });
V.addBasemaps(collarMap, ["topo", "imagery"]);
V.collarTraces(collarMap, HOLES.map((h) => ({ ...h, metres: h.length * 0.3048,
  popup: `<b>${V.esc(h.id)}</b> · ${h.length} ft<br>Azimuth ${h.azimuth}°, inclination ${h.inclination}°` })));

// a reachable area as rings of 250 m cells around a start point
const start = [33.75, -84.39];
const bands = [0, 1, 2, 3, 4].map((band) => {
  const cells = [];
  for (let i = -30; i <= 30; i++) for (let j = -30; j <= 30; j++) {
    const d = Math.hypot(i, j * 0.8) + 2 * Math.sin(i / 3) * Math.cos(j / 4);
    if (d >= band * 6 && d < (band + 1) * 6) {
      const lat = start[0] + i * 0.0045, lon = start[1] + j * 0.0054;
      cells.push([[[lon, lat], [lon + 0.0054, lat], [lon + 0.0054, lat + 0.0045], [lon, lat + 0.0045], [lon, lat]]]);
    }
  }
  return { type: "Feature", properties: { band, from_m: band * 3000, to_m: (band + 1) * 3000 }, geometry: { type: "MultiPolygon", coordinates: cells } };
});
const areaMap = L.map("map-area", { preferCanvas: true, scrollWheelZoom: false }).setView(start, 10);
V.addBasemaps(areaMap, ["osm"], { exportable: true });
const area = V.bandedArea(areaMap, { type: "FeatureCollection", features: bands });
V.labeledPin(areaMap, { lat: start[0], lon: start[1], label: "Example quarry" }).setLatLng(...start);
areaMap.fitBounds(area.bounds, { padding: [20, 20] });
V.buttonControl("Zoom to area", () => areaMap.fitBounds(area.bounds, { padding: [20, 20] }), { map: areaMap, title: "Fit the map to the reachable area" });
const pngButton = document.getElementById("png"), pngNote = document.getElementById("png-note");
pngButton.onclick = async () => {
  pngButton.disabled = true; pngButton.textContent = "Rendering…"; pngNote.textContent = "";
  try { await V.downloadMapPng(areaMap, "Example quarry"); pngNote.textContent = "Saved Example_quarry-map.png."; }
  catch (e) { console.error(e); pngNote.textContent = "The map image could not be made. Wait for the map to finish loading, then try again."; }
  finally { pngButton.disabled = false; pngButton.textContent = "Download map as PNG"; }
};
window.rbvGallery = { areaMap, V }; // for tests and for poking at components from the console

// ---- images ----------------------------------------------------------------------------------
const picture = (i) => {
  const c = V.CATEGORICAL[i % V.CATEGORICAL.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${c}"/>
    <path d="M0 300 ${120 + i * 20} ${90 + i * 8} 240 220 310 150 400 300z" fill="rgba(255,255,255,.35)"/>
    <text x="20" y="44" font-family="sans-serif" font-size="28" fill="#fff">Box ${i + 1}</text></svg>`;
  return { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, caption: `Core box ${i + 1} · ${i * 10}–${i * 10 + 10} ft` };
};
V.gallery(document.getElementById("gallery"), Array.from({ length: 8 }, (_, i) => picture(i)));
