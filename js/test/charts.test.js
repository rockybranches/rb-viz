import { test } from "node:test";
import assert from "node:assert/strict";
import * as V from "../index.js";

const theme = V.themeFor("light");

test("stepSeries breaks the line at gaps and missing values", () => {
  const s = V.stepSeries([
    { from: 0, to: 5, value: 1 }, { from: 5, to: 10, value: 2 },
    { from: 20, to: 25, value: 3 },            // gap from 10 to 20
    { from: 25, to: 30, value: null },         // not assayed
    { from: 30, to: 35, value: 4 },
  ]);
  assert.deepEqual(s.x, [1, 1, 2, 2, null, 3, 3, null, 4, 4]);
  assert.deepEqual(s.y, [0, 5, 5, 10, null, 20, 25, null, 30, 35]);
});

const lith = { type: "category", title: "Lithology", color: V.lithologyColor,
  intervals: [{ from: 0, to: 40, label: "Shale" }, { from: 40, to: 100, label: "Chert", detail: "silicified" }, { from: 100, to: 105, label: "" }] };
const au = { type: "value", title: "Au (g/t)", name: "Au", log: true,
  intervals: [{ from: 0, to: 5, value: 0.01, note: "below detection" }, { from: 5, to: 10, value: 1.2 }] };

test("stripLog lays tracks side by side on a shared, downward depth axis", () => {
  const spec = V.stripLog([lith, au, { ...au, title: "weight", log: false, range: [0, 1.02] }], { theme, selected: 7, depthTitle: "Depth (ft)" });
  const { layout, data } = spec;
  assert.equal(layout.yaxis.range[0] > layout.yaxis.range[1], true);
  assert.equal(layout.yaxis.title.text, "Depth (ft)");
  assert.equal(layout.xaxis.domain[0], 0);
  assert.ok(layout.xaxis3.domain[1] <= 1 && layout.xaxis2.domain[0] >= layout.xaxis.domain[1]);
  assert.equal(layout.xaxis2.type, "log");
  assert.equal(layout.xaxis3.type, undefined);
  assert.deepEqual(layout.xaxis3.range, [0, 1.02]);
  assert.equal(layout.shapes[0].y0, 7);
  // lithology bars: unlabelled interval dropped, colours from the lithology table
  assert.deepEqual(data[0].marker.color, ["#5b5b5b", "#7d9db7"]);
  assert.equal(data[0].customdata[1], "Chert, silicified");
  assert.equal(data.length, 1 + 2 + 2);
  assert.equal(data[2].customdata[0], " (below detection)");
});

test("stripLog: no log axis when a value is zero; maxTracks keeps category tracks", () => {
  const zero = { ...au, intervals: [{ from: 0, to: 5, value: 0 }, { from: 5, to: 10, value: 1 }] };
  assert.equal(V.stripLog([zero], { theme }).layout.xaxis.type, undefined);
  const narrow = V.stripLog([lith, au, au, au], { theme, maxTracks: 2 });
  assert.equal(narrow.data.length, 1 + 2 * 2);
  assert.doesNotThrow(() => V.stripLog([], { theme }));
});

test("intervalAt and categoryShares", () => {
  const ivs = [{ from: 0, to: 5 }, { from: 5, to: 10 }, { from: 20, to: 25 }];
  assert.equal(V.intervalAt(ivs, 7), ivs[1]);
  assert.equal(V.intervalAt(ivs, 18), ivs[2]);
  assert.equal(V.intervalAt([], 1), null);
  assert.deepEqual(V.categoryShares(lith.intervals), [{ name: "Chert", length: 60 }, { name: "Shale", length: 40 }]);
});

test("correlationHeatmap is fixed to −1…1 with a diverging scale", () => {
  const spec = V.correlationHeatmap({ labels: ["Au", "Ag"], matrix: [[1, 0.4], [0.4, 1]] }, { theme });
  assert.equal(spec.data[0].zmin, -1);
  assert.equal(spec.data[0].zmax, 1);
  assert.equal(spec.data[0].colorscale[1][1], theme.divergeMid);
  assert.equal(spec.layout.yaxis.autorange, "reversed");
});

test("scoresMatrix orders columns by mean and leaves missing cells empty", () => {
  const m = V.scoresMatrix([{ name: "R1", scores: { As: 0.2, Sb: 0.9 } }, { name: "R3", scores: { As: 0.4, Hg: 0.1 } }]);
  assert.deepEqual(m.columns, ["Sb", "As", "Hg"]);
  assert.deepEqual(m.rows, ["R1", "R3"]);
  assert.deepEqual(m.values, [[0.9, 0.2, null], [null, 0.4, 0.1]]);
  assert.equal(V.matrixHeatmap(m, { theme }).data[0].z, m.values);
});

test("crossPlot drops non-positive points on log axes and greys the first of several groups", () => {
  const groups = [
    { name: "Others", points: [{ x: 1, y: 2, label: "a", id: 7 }, { x: 0, y: 2 }, { x: 1, y: null }] },
    { name: "R9", points: [{ x: 3, y: 4, label: "<b>" }] },
  ];
  const spec = V.crossPlot(groups, { xTitle: "Ag", yTitle: "Au", theme });
  assert.deepEqual(spec.data[0].x, [1]);
  assert.deepEqual(spec.data[0].customdata[0], ["a", 7]);
  assert.equal(spec.data[0].marker.color, theme.axis);
  assert.equal(spec.data[1].marker.color, theme.series[0]);
  assert.equal(spec.data[1].customdata[0][0], "&lt;b&gt;");
  assert.equal(spec.layout.xaxis.type, "log");
  assert.equal(spec.empty, false);
  assert.equal(V.crossPlot([{ name: "x", points: [{ x: 0, y: 0 }] }], { theme }).empty, true);
  assert.equal(V.crossPlot([{ name: "x", points: [{ x: 0, y: 0 }] }], { theme, log: false }).empty, false);
});

test("logHistogram uses log10 of positive values", () => {
  const spec = V.logHistogram([{ name: "Core", values: [1, 10, 0, null, 100] }], { title: "Au (g/t)", binSize: 0.1, theme });
  assert.deepEqual(spec.data[0].x, [0, 1, 2]);
  assert.equal(spec.data[0].xbins.size, 0.1);
  assert.equal(spec.layout.xaxis.title.text, "log₁₀ Au (g/t)");
  assert.equal(spec.layout.showlegend, false);
});

test("traceOffset: vertical, horizontal and inclined holes", () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  const down = V.traceOffset({}, 100);
  near(down.dx, 0); near(down.dy, 0); near(down.dz, -100);
  const east = V.traceOffset({ azimuth: 90, inclination: 0 }, 100);
  near(east.dx, 100); near(east.dy, 0); near(east.dz, 0);
  const incl = V.traceOffset({ azimuth: 0, inclination: 60 }, 100);
  near(incl.dy, 50); near(incl.dz, -100 * Math.sin(Math.PI / 3));
});

test("surfaceTrace moves north by the horizontal length", () => {
  const [[lat0, lon0], [lat1, lon1]] = V.surfaceTrace({ lat: 40, lon: -116, azimuth: 0, inclination: 0 }, 111320);
  assert.equal(lat0, 40);
  assert.ok(Math.abs(lat1 - 41) < 1e-9);
  assert.ok(Math.abs(lon1 - lon0) < 1e-9);
});

test("holes3d: one line and one marker trace per hole, one colour bar, depths scaled", () => {
  const holes = [
    { id: "R1", x: 0, y: 0, z: 1000, azimuth: 0, inclination: 90, length: 100, intervals: [{ from: 0, to: 10, value: 0.1 }, { from: 10, to: 20, value: 0 }] },
    { id: "R3", x: 50, y: 0, z: 1000, azimuth: 90, inclination: 45, length: 100, intervals: [{ from: 0, to: 10, value: 10 }] },
  ];
  const spec = V.holes3d(holes, { depthScale: 0.5, valueTitle: "Au g/t", theme });
  assert.equal(spec.data.length, 4);
  assert.deepEqual(spec.data[0].z, [1000, 950]);
  assert.deepEqual(spec.data[1].z, [997.5]); // mid-point of 0–10 at half scale; the zero value is dropped
  assert.ok(spec.data[1].marker.colorbar);
  assert.equal(spec.data[3].marker.colorbar, undefined);
  assert.deepEqual(spec.data[1].marker.colorbar.ticktext, ["0.1", "1", "10"]);
});

test("planView and lineOverlay", () => {
  const plan = V.planView([{ x: 1, y: 2, value: 5, label: "s1", id: 0 }, { x: null, y: 2 }], { theme });
  assert.deepEqual(plan.data[0].x, [1]);
  assert.equal(plan.layout.yaxis.scaleanchor, "x");
  const lines = V.lineOverlay([{ name: "a", x: [1, 2], y: [3, 4] }, { name: "b", x: [1, 2], y: [5, 6] }], { theme });
  assert.equal(lines.data[1].line.color, theme.series[1]);
  assert.equal(lines.layout.showlegend, true);
});

test("compareCells: numbers, natural text order, empty last", () => {
  assert.ok(V.compareCells(2, 10) < 0);
  assert.ok(V.compareCells("R2", "R10") < 0);
  assert.ok(V.compareCells("R2", "R10", -1) > 0);
  assert.ok(V.compareCells(null, 1) > 0);
  assert.ok(V.compareCells(1, null, -1) < 0);
});
