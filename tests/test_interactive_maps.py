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


@pytest.fixture
def samples():
    rng = np.random.default_rng(2)
    df = pd.DataFrame({"hole": ["R1"] * 20 + ["R9"] * 20, "from": np.tile(np.arange(0, 100, 5.0), 2),
                       "sample": [f"s{i}" for i in range(40)], "Au": rng.lognormal(-3, 1, 40), "Ag": rng.lognormal(0, 1, 40),
                       "lith": ["Shale"] * 10 + ["Chert"] * 10 + ["Basalt"] * 20})
    df["to"] = df["from"] + 5
    df.loc[0, "Au"] = 0.0
    df.loc[1, "Ag"] = np.nan
    return df


def test_cross_plot_highlights_and_drops_unusable_points(samples):
    fig = interactive.cross_plot(samples, "Ag", "Au", highlight="hole", value="R9", label="sample")
    assert [t.name for t in fig.data] == ["Others", "R9"]
    assert len(fig.data[0].x) == 18 and len(fig.data[1].x) == 20   # the zero and the missing value are gone
    assert fig.layout.xaxis.type == "log"
    plain = interactive.cross_plot(samples, "Ag", "Au", log=False)
    assert len(plain.data[0].x) == 39 and plain.layout.showlegend is False


def test_log_histogram(samples):
    fig = interactive.log_histogram({"Others": samples.loc[samples.hole == "R1", "Au"], "R9": samples.loc[samples.hole == "R9", "Au"]},
                                    title="Au (g/t)", bin_size=0.1)
    assert len(fig.data[0].x) == 19            # the zero is left out
    assert fig.data[0].marker.color != fig.data[1].marker.color
    assert fig.layout.xaxis.title.text == "log₁₀ Au (g/t)"
    with pytest.raises(ValueError, match="at most"):
        interactive.log_histogram({str(i): [1.0] for i in range(9)})


def test_interactive_strip_log(samples):
    hole = samples[samples.hole == "R1"]
    fig = interactive.strip_log(hole, ["Au", "Ag"], category="lith", log=True, depth_label="Depth (ft)")
    fills = [t for t in fig.data if t.type == "scatter" and t.fill]
    assert len(fills) == 1 + 2                  # Au in one run; Ag split in two by its missing value
    assert all(not np.isnan(np.asarray(t.x, dtype=float)).any() for t in fills)
    assert fig.data[0].type == "bar" and set(fig.data[0].marker.color) == {"#5b5b5b", "#7d9db7"}  # Shale, Chert
    assert fig.layout.yaxis.range[0] > fig.layout.yaxis.range[1]                    # depth increases downward
    assert fig.layout.xaxis2.type == "linear"   # Au has a zero: no log axis
    assert fig.layout.xaxis3.type == "log"
    with pytest.raises(ValueError):
        interactive.strip_log(hole, [])


def test_holes_3d(samples):
    collars = pd.DataFrame({"x": [0.0, 100.0], "y": [0.0, 0.0], "z": [1000.0, 1000.0], "azimuth": [0.0, 90.0],
                            "inclination": [90.0, 0.0], "length": [100.0, 100.0]}, index=["R1", "R9"])
    fig = interactive.holes_3d(collars, samples, "Au", depth_scale=0.5, value_title="Au g/t")
    assert len(fig.data) == 4
    assert list(fig.data[0].z) == pytest.approx([1000, 950])           # vertical hole, half scale
    assert list(fig.data[2].x) == pytest.approx([100, 150])            # horizontal hole heading east
    assert len(fig.data[1].x) == 19                                    # the zero Au is left out
    assert fig.data[1].marker.colorbar.title.text == "Au g/t"
    assert fig.data[3].marker.colorbar.title.text is None              # one colour bar only
