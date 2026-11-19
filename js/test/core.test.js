import { test } from "node:test";
import assert from "node:assert/strict";
import * as V from "../index.js";

const theme = V.themeFor("light");

test("fmt: significant figures, separators, missing values, escaped text", () => {
  assert.equal(V.fmt(0.012345), "0.0123");
  assert.equal(V.fmt(1234.5), "1,235");
  assert.equal(V.fmt(0), "0");
  assert.equal(V.fmt(null), "–");
  assert.equal(V.fmt(NaN), "–");
  assert.equal(V.fmt("<b>"), "&lt;b&gt;");
});

test("esc, plural, log10, slug, fixed", () => {
  assert.equal(V.esc(`a<b & "c"`), "a&lt;b &amp; &quot;c&quot;");
  assert.equal(V.esc(null), "");
  assert.equal(V.plural(1, "sample"), "1 sample");
  assert.equal(V.plural(1200, "sample"), "1,200 samples");
  assert.equal(V.log10(100), 2);
  assert.equal(V.log10(0), null);
  assert.equal(V.log10(-1), null);
  assert.equal(V.slug("Site A / 2"), "Site_A_2");
  assert.equal(V.fixed(1234.5678, 1), "1,234.6");
});

test("themes come from the tokens and differ between schemes", () => {
  const dark = V.themeFor("dark");
  assert.equal(theme.series[0], V.TOKENS.light["series-1"]);
  assert.equal(dark.ink, V.TOKENS.dark.ink);
  assert.notEqual(theme.surface, dark.surface);
  assert.equal(theme.series.length, 6);
  assert.deepEqual(theme.sequential, V.TOKENS.sequential);
  // no document in Node: currentTheme falls back to the light tokens
  assert.deepEqual(V.currentTheme(), theme);
});

test("categoricalScale is stable, cycles, and honours known colours", () => {
  const color = V.categoricalScale(["#1", "#2"], { Shale: "#s" });
  assert.equal(color("a"), "#1");
  assert.equal(color("b"), "#2");
  assert.equal(color("a"), "#1");
  assert.equal(color("c"), "#1");
  assert.equal(color("Shale"), "#s");
  assert.equal(V.lithologyColor("Chert"), "#7d9db7");
  assert.equal(V.lithologyColor("Unobtainium"), "#cccccc");
});

test("quantileLogScale clamps to the quantiles and ignores non-positive values", () => {
  const values = [0, null, -3, ...Array.from({ length: 101 }, (_, i) => 10 ** (i / 50))]; // 1 … 100
  const s = V.quantileLogScale(values);
  assert.ok(Math.abs(s.lo - 0.1) < 1e-9 && Math.abs(s.hi - 1.9) < 1e-9);
  assert.equal(s.t(0), null);
  assert.equal(s.t(1), 0);
  assert.equal(s.t(1000), 1);
  assert.equal(s.colorOf(1000), V.SEQUENTIAL.at(-1));
  assert.equal(s.colorOf(null), V.TOKENS.light.muted);
  assert.ok(Math.abs(s.value(0.5) - 10) < 1e-9);
  assert.equal(V.quantileLogScale([0, null]), null);
  assert.equal(V.quantileLogScale([5, 5, 5]).flat, true);
});

test("colorscale spans 0 to 1", () => {
  const cs = V.colorscale(["a", "b", "c"]);
  assert.deepEqual(cs, [[0, "a"], [0.5, "b"], [1, "c"]]);
});

test("axis merges a title given as text or object, keeping the themed font", () => {
  assert.equal(V.axis({ title: "Depth" }, theme).title.text, "Depth");
  assert.equal(V.axis({ title: "Depth" }, theme).title.font.color, theme.ink2);
  assert.equal(V.axis({ title: { text: "x", font: { size: 9 } } }, theme).title.font.size, 9);
  assert.equal(V.baseLayout({ showlegend: false }, theme).showlegend, false);
});

test("draw without Plotly or a DOM is not attempted here; specs are plain data", () => {
  const spec = V.rankedBars({ As: 0.5, Sb: 0.9, Hg: null, Pb: 0.1 }, { theme, limit: 2 });
  assert.deepEqual(spec.data[0].y, ["As", "Sb"]); // top two, largest last (drawn at the top)
  assert.deepEqual(spec.data[0].x, [0.5, 0.9]);
  assert.doesNotThrow(() => JSON.stringify(spec));
});

test("parseHash and hashFor round-trip, including names that need encoding", () => {
  assert.deepEqual(V.parseHash(""), []);
  assert.deepEqual(V.parseHash("#/"), []);
  assert.deepEqual(V.parseHash("#/holes/R%209/120"), ["holes", "R 9", "120"]);
  assert.deepEqual(V.parseHash("#/bad/%E0%A4%A"), ["bad", "%E0%A4%A"]); // malformed escape kept as typed
  assert.equal(V.hashFor("holes", "R 9", 120), "#/holes/R%209/120");
  assert.equal(V.hashFor("holes", "A/B", null), "#/holes/A%2FB");
  assert.deepEqual(V.parseHash(V.hashFor("holes", "A/B")), ["holes", "A/B"]);
});
