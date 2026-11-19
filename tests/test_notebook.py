"""Run the Rimrock notebook's analysis and figure cells on made-up data.

The real data is private, so the two cells that read files are replaced by synthetic drill logs,
collars and soils of the same shape. Everything after that is the notebook's own code, calling
the real rb-rimrock analysis and rb_viz. Skipped unless rb-rimrock is installed
(`uv sync --group notebooks`).
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

pytest.importorskip("rb_rimrock")
gpd = pytest.importorskip("geopandas")

NOTEBOOK = Path(__file__).resolve().parents[1] / "notebooks" / "rimrock.ipynb"
ELEMENTS = ["Ag", "As", "Cu", "Hg", "Sb"]
CRS = "EPSG:26711"


def synthetic_inputs():
    rng = np.random.default_rng(3)
    logs, rows = {}, []
    for i, hole in enumerate(["R1", "R3", "R9"]):
        depths = np.arange(0.0, 150.0, 5.0)
        df = pd.DataFrame(rng.lognormal(size=(len(depths), len(ELEMENTS) + 1)), columns=ELEMENTS + ["Au"])
        df.insert(0, "DepthToTop", depths)
        logs[hole] = df
        rows.append({"Bore": hole, "Easting": 511000 + 300 * i, "Northing": 4510000 + 400 * i,
                     "Elevation": 5600.0, "TD": 150.0})
    xy = rng.uniform(0, 1000, (60, 2))
    soils = gpd.GeoDataFrame(pd.DataFrame(rng.lognormal(size=(60, len(ELEMENTS) + 1)),
                                          columns=[f"{e}_ppm" for e in ELEMENTS] + ["Au_ppb"]),
                             geometry=gpd.points_from_xy(511000 + xy[:, 0], 4510000 + xy[:, 1]), crs=CRS)
    return logs, pd.DataFrame(rows).set_index("Bore"), soils


def test_notebook_cells_run_on_synthetic_data(monkeypatch):
    cells = ["".join(c["source"]) for c in json.loads(NOTEBOOK.read_text(encoding="utf-8"))["cells"]
             if c["cell_type"] == "code"]
    logs, collars, soils = synthetic_inputs()
    monkeypatch.setattr(gpd, "read_file", lambda *a, **k: soils)
    ns: dict = {}
    figures_seen = 0
    for source in cells:
        if source.startswith("logs = {}"):          # reads the Excel drill logs and the collar table
            ns.update(logs=logs, collars=collars)
            continue
        # a notebook shows the value of a cell's last line; here it is enough that it runs
        exec(compile(source, "<notebook cell>", "exec"), ns)
        figures_seen += 1
    assert figures_seen == len(cells) - 1
    report = ns["report"]
    assert list(ns["max_w"].index) == list(report.holes_order)
    assert set(ns["profiles"]) == set(logs)
