rb-viz
======

The shared data visualization components of the rockybranches projects: one set of colours, charts,
maps and page blocks, so that a strip log or a correlation matrix looks and behaves the same in
[rb-rimrock](https://github.com/rockybranches/rb-rimrock), rb-assay, rb-road-network and in a notebook.

It has two halves that share one colour definition (`src/rb_viz/tokens.json`):

| | For | Lives in | Needs |
|---|---|---|---|
| **JavaScript + CSS** | web apps and generated dashboards | `js/`, `css/`, built into `dist/` | Plotly 2.x for charts, Leaflet 1.9 for maps (loaded by the page, not bundled) |
| **Python** (`rb_viz`) | notebooks, reports, static images | `src/rb_viz/` | matplotlib; Plotly and folium as extras |

To see every JavaScript component drawn with made-up data, in both themes:

```bash
npm install
npm run gallery        # then open http://localhost:8765/examples/
```

## What is in it

### JavaScript (`js/`)

| Module | Components |
|---|---|
| `charts/striplog.js` | `stripLog` (lithology bands and value tracks against depth), `onDepthPick`, `stepSeries`, `intervalAt`, `categoryShares` |
| `charts/heatmaps.js` | `correlationHeatmap`, `matrixHeatmap`, `scoresMatrix` |
| `charts/bars.js` | `rankedBars` |
| `charts/scatter.js` | `crossPlot`, `planView`, `lineOverlay` (e.g. diffractograms) |
| `charts/distribution.js` | `logHistogram` |
| `charts/holes3d.js` | `holes3d`, `traceOffset`, `surfaceTrace` |
| `maps/leaflet.js` | `addBasemaps` (OpenStreetMap, USGS topo, imagery), `legendControl`, `buttonControl`, `labeledPin`, `imageOverlay` |
| `maps/layers.js` | `gradedPoints` (samples coloured by grade), `collarTraces` (drill collars and hole traces), `bandedArea` (reachable area in distance bands) |
| `maps/png.js` | `renderMapPng`, `downloadMapPng` (the map on screen as an image) |
| `widgets/lightbox.js` | `gallery`, `openLightbox` |
| `widgets/blocks.js` | `statTiles`, `compositionBar`, `dataTable` (sort, filter, row click) |
| `widgets/shell.js` | `hashRouter`, `setActiveNav`, `parseHash`, `hashFor` |
| `plotting.js` | `draw`, `onPointClick`, `showEmpty`, `baseLayout`, `axis` |
| `theme.js`, `colors.js`, `format.js` | themes and the light/dark switch, palettes and colour scales, number and text formatting |

Chart functions return a plain `{ data, layout, config }` object and `draw()` puts it on the page, so
charts can be tested without a browser:

```html
<link rel="stylesheet" href="rb-viz.css">
<script src="https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js"></script>
<div id="strip" class="plot" style="height:640px"></div>
<script type="module">
  import { draw, stripLog, onDepthPick, lithologyColor } from "./rb-viz.esm.js";

  draw("strip", stripLog([
    { type: "category", title: "Lithology", color: lithologyColor,
      intervals: [{ from: 0, to: 40, label: "Shale" }, { from: 40, to: 100, label: "Chert" }] },
    { type: "value", title: "Au (g/t)", name: "Au", log: true,
      intervals: [{ from: 0, to: 5, value: 0.02 }, { from: 5, to: 10, value: 1.4 }] },
  ], { depthTitle: "Depth (ft)" }));
  onDepthPick("strip", (depth) => console.log("picked", depth));
</script>
```

Three ways to use it from another project:

- **A page with a build step or ES modules:** import from `js/index.js` (or one module, e.g. `js/charts/striplog.js`).
- **A static page:** copy `dist/rb-viz.esm.js` (module) or `dist/rb-viz.js` (classic script; everything is under the global `RBViz`) and `dist/rb-viz.css` next to the page.
- **A single generated HTML file** (as rb-assay writes): inline `dist/rb-viz.js` and `dist/rb-viz.css`, or from Python use `rb_viz.web` (below).

`dist/rb-viz.css` holds the colour tokens for light and dark, the page blocks (cards, tiles, chips,
tables, hole pages, galleries) and the map styles. Charts read their colours from it when they are
drawn; after switching theme, draw them again (`bindThemeToggle(button, { onChange: redraw })`).

Text you pass in (labels, titles, names) is escaped. The few options documented as HTML (`popup`,
a table column's `cell`, a lightbox `caption` function) are inserted as given: escape them with `esc()`.

### Python (`src/rb_viz/`)

```bash
uv add "rb-viz[all] @ git+https://github.com/rockybranches/rb-viz"   # or [plotly], [maps], or no extra
```

| Module | Contents |
|---|---|
| `rb_viz.palette` | `SERIES`, `SEQUENTIAL`, `CATEGORICAL`, `BANDS`, `LITHOLOGY`, `theme()`, `categorical_colors()`, `lithology_color()`, `sampled_colors()` |
| `rb_viz.style` | `use_style()` / `matplotlib_rc()` / `rc_context()`, `sequential_cmap()`, `diverging_cmap()`, `plotly_template()` |
| `rb_viz.figures` | matplotlib: `strip_log`, `depth_profiles`, `ranked_bars`, `line_series`, `correlation_heatmap` |
| `rb_viz.interactive` | Plotly: `strip_log`, `cross_plot`, `log_histogram`, `holes_3d`, `stacked_share_bars`, `share_pie`, `correlation_heatmap`, `ranked_bars` |
| `rb_viz.maps` | folium: `cluster_marker_map` (markers with image popups over clustered surface samples) |
| `rb_viz.web` | `asset("rb-viz.css" \| "rb-viz.js")`, `standalone_page()`, `json_for_script()` |

```python
import pandas as pd
from rb_viz import figures

fig = figures.ranked_bars(pd.Series({"As": 0.41, "Sb": 0.37, "Hg": 0.12}), xlabel="R² with Au", annotate_from=0.1)
fig.savefig("r2.png")
```

A dashboard in one HTML file, written from Python with the JavaScript components (your script
gets `RBViz`, your data as `DATA`, and the empty `app` element):

```python
from rb_viz import web

page = web.standalone_page(
    "Hole R9", data={"scores": {"As": 0.41, "Sb": 0.37}}, footer="Generated 2026-11-19",
    script="""
      app.innerHTML = '<section class="card"><h2>Tracks Au</h2><div id="bars" class="plot"></div></section>';
      window.redraw = () => RBViz.draw("bars", RBViz.rankedBars(DATA.scores, { valueTitle: "R² with Au" }));
      redraw();
    """)
open("r9.html", "w", encoding="utf-8").write(page)
```

Figure functions take data and return a figure; they do not read or write files or change global
plotting settings. In Jupyter, end the line with `;` (or assign the figure) so it is not shown twice.

## Notebooks

`notebooks/rimrock.ipynb`: the Au-Cu prospect in the western Sheep Creek Range, Nevada. It uses the
private [`rb-rimrock`](https://github.com/rockybranches/rb-rimrock) package for the analysis and
`rb_viz` for the figures. The data is **not** in this repository:

```bash
uv sync --group notebooks
RIMROCK_LOGS_DIR=~/rimrock/logs \
RIMROCK_SOIL_SHP=~/rimrock/soils/rimrock_surface_data.shp \
RIMROCK_LOCATIONS_FILE_PATH=~/rimrock/Rimrock_Drill_hole_data_Location.csv \
uv run jupyter lab notebooks/rimrock.ipynb
```

This repository is public: commit notebooks with their outputs cleared
(`uv run jupyter nbconvert --clear-output --inplace notebooks/rimrock.ipynb`). `.gitignore` keeps
spreadsheets, CSVs and shapefiles out.

## Branding

Chart chrome in the light theme (grid lines, secondary text and annotations, muted marks) uses
the neutral colours from [rb-brand](https://github.com/rockybranches/rb-brand), the single
source for Rocky Branches branding. Change them there first, then copy the new values into
`src/rb_viz/tokens.json` (`grid`, `ink-2`, `muted`) and run `npm run build`. The data series
colours are rb-viz's own.

## Working on rb-viz

```bash
npm install && uv sync

npm test               # JavaScript: chart specs, scales, formatting
uv run pytest          # Python: figures, palettes, and that the generated files match their sources
npm run build          # regenerate js/tokens.js, css/tokens.css, dist/ and src/rb_viz/assets/
npm run check          # fails if the committed generated files are out of date
```

- **Changing a colour:** edit `src/rb_viz/tokens.json`, then `npm run build`. Do not edit
  `js/tokens.js` or `css/tokens.css`; they are generated.
- **Changing JavaScript or CSS:** run `npm run build` and commit `dist/` and `src/rb_viz/assets/`
  with the change: other projects copy the files from `dist/`, and the Python package ships the assets.
- **The notebook:** `uv sync --group notebooks && uv run --group notebooks pytest tests/test_notebook.py`
  runs its cells on made-up data (needs access to the private rb-rimrock).
- **Adding a component:** add it to the gallery (`examples/`) too, and look at it in both themes
  and at phone width.
