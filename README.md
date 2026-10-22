rb-viz
======

Visualization notebooks.

## Rimrock (`notebooks/rimrock.ipynb`)

Au-Cu prospect, western Sheep Creek Range, Nevada. The notebook uses the
[`rb-rimrock`](https://github.com/rockybranches/rb-rimrock) package (private; pinned in
`pyproject.toml` under `[tool.uv.sources]`) to import the drill logs, compute the per-sample and
per-hole Au weights, the surface-soil R², the sensitivity to β and to the depth-gap policy, and
a map of the holes and soil clusters.

The data is **not** in this repository. Point the notebook at it, then start Jupyter:

```bash
uv sync
RIMROCK_LOGS_DIR=~/rimrock/logs \
RIMROCK_SOIL_SHP=~/rimrock/soils/rimrock_surface_data.shp \
RIMROCK_LOCATIONS_FILE_PATH=~/rimrock/Rimrock_Drill_hole_data_Location.csv \
uv run jupyter lab notebooks/rimrock.ipynb
```

This repository is public: commit the notebook with its outputs cleared
(`uv run jupyter nbconvert --clear-output --inplace notebooks/rimrock.ipynb`). `.gitignore`
keeps spreadsheets, CSVs and shapefiles out.
