import numpy as np
import pandas as pd
import pytest

from rb_viz import interactive, maps

WEIGHTS = pd.DataFrame({"As": [0.7, 0.1], "Sb": [0.2, 0.3], "Hg": [0.1, 0.6]}, index=["R1", "R9"])


def test_stacked_share_bars():
    fig = interactive.stacked_share_bars(WEIGHTS, ["R9", "R1"], title="Per-hole Au Correlation")
    assert sorted(t.name for t in fig.data) == ["As", "Hg", "Sb"]
    assert list(fig.layout.xaxis.categoryarray) == ["R9", "R1"]
    assert fig.layout.barmode == "stack"
    assert tuple(fig.layout.yaxis.range) == (0, 1)
    by_name = {t.name: dict(zip(t.x, t.y)) for t in fig.data}
    assert by_name["Hg"]["R9"] == pytest.approx(0.6)
    assert len({t.marker.color for t in fig.data}) == 3


def test_share_pie_is_stable_across_holes():
    a = interactive.share_pie(WEIGHTS.loc["R1"], title="Hole R1")
    b = interactive.share_pie(WEIGHTS.loc["R9"])
    assert list(a.data[0].labels) == ["As", "Hg", "Sb"]
    assert list(a.data[0].marker.colors) == list(b.data[0].marker.colors)
    assert a.layout.title.text == "Hole R1"


def test_correlation_heatmap_and_ranked_bars():
    corr = pd.DataFrame([[1.0, -0.5], [-0.5, 1.0]], index=["Au", "Ag"], columns=["Au", "Ag"])
    heat = interactive.correlation_heatmap(corr)
    assert (heat.data[0].zmin, heat.data[0].zmax) == (-1, 1)
    assert heat.layout.yaxis.autorange == "reversed"
    bars = interactive.ranked_bars(pd.Series({"As": 0.5, "Sb": 0.9, "Hg": np.nan}), limit=1)
    assert list(bars.data[0].y) == ["Sb"]


def test_cluster_marker_map(tmp_path):
    gpd = pytest.importorskip("geopandas")
    from shapely.geometry import Point

    crs = "EPSG:26711"  # UTM 11N NAD27, as the Rimrock collars
    holes = gpd.GeoSeries([Point(511000, 4510000), Point(511400, 4510600)], index=["R1", "R<9>"], crs=crs)
    rng = np.random.default_rng(1)
    surface = gpd.GeoDataFrame({"class": [0] * 5 + [1] * 5},
                               geometry=[Point(511000 + x, 4510000 + y) for x, y in rng.uniform(0, 800, (10, 2))], crs=crs)
    png = tmp_path / "R1.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\n")
    m = maps.cluster_marker_map(holes, {"R1": png, "R<9>": tmp_path / "missing.png"}, surface)
    out = m.get_root().render()
    assert out.count("L.marker(") == 2
    assert "data:image/png;base64," in out
    assert "R<9>" not in out  # names are escaped
    lat, lon = m.location
    assert 40 < lat < 41 and -117 < lon < -116  # centred on the markers
    assert maps.cluster_marker_map(holes).get_root().render().count("L.marker(") == 2
