# Changelog

## 0.2.0

rb-viz becomes the shared visualization library of the rockybranches projects. Before this it
held one notebook.

### Added
- **JavaScript components** (`js/`, built into `dist/`): strip log, correlation and matrix
  heatmaps, ranked bars, cross-plot, plan view, log histogram, 3D drill holes, line overlay;
  Leaflet basemaps, graded points, collar traces, banded area, legend, pin, button, image
  overlay and map-to-PNG; lightbox and gallery, stat tiles, composition bar, sortable table,
  hash router and navigation; light and dark themes.
- **Stylesheet** (`dist/rb-viz.css`): colour tokens, page blocks and map styles.
- **Python package** `rb_viz`: `palette`, `style`, `figures` (matplotlib), `interactive`
  (Plotly), `maps` (folium) and `web` (the built assets, and `standalone_page()` for one-file
  dashboards written from Python).
- One colour definition, `src/rb_viz/tokens.json`, from which the CSS and JavaScript are generated.
- A gallery of every JavaScript component (`npm run gallery`), tests for both halves, and CI.

### Changed
- `notebooks/rimrock.ipynb` draws with `rb_viz` instead of inline matplotlib and
  `rb_rimrock.plots`; a test runs its cells on made-up data.
- The project is a hatchling package; rb-rimrock is in the `notebooks` dependency group
  (`uv sync --group notebooks`).

### Fixed (relative to the copies in the other projects)
- Strip logs no longer shade across depths that were not sampled.
- The reachable-area layer sits below markers, so a pin on it keeps its colour, on screen and
  in the exported PNG.
- Marker names are escaped: collar and pin labels on Leaflet maps, and marker tooltips on the
  folium map (Leaflet and folium both treat tooltip text as HTML).

### Removed
- The unused Poetry metadata with its `open3d` dependency, and `requirements.txt`.
