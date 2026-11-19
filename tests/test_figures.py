import matplotlib
import numpy as np
import pandas as pd
import pytest

import rb_viz
from rb_viz import figures


def test_ranked_bars_orders_limits_and_annotates():
    values = pd.Series({"As": 0.5, "Sb": 0.9, "Hg": np.nan, "Pb": 0.05})
    fig = figures.ranked_bars(values, xlabel="R²", annotate_from=0.1)
    ax = fig.axes[0]
    assert [t.get_text() for t in ax.get_yticklabels()] == ["Pb", "As", "Sb"]  # largest on top
    assert sorted(t.get_text() for t in ax.texts) == ["0.50", "0.90"]
    assert ax.get_xlabel() == "R²"
    assert len(figures.ranked_bars(values, limit=1).axes[0].patches) == 1


def test_figures_do_not_change_global_style():
    before = dict(matplotlib.rcParams)
    figures.ranked_bars(pd.Series({"a": 1.0}), scheme="dark")
    assert dict(matplotlib.rcParams) == before


def test_depth_profiles_one_panel_per_hole_depth_downward():
    profiles = {h: pd.DataFrame({"DepthToTop": np.arange(0, 50, 5.0), "weights": np.linspace(0, 1, 10)})
                for h in ("R1", "R3", "R9")}
    fig = figures.depth_profiles(profiles, ylabel="depth to top (ft)", title="Per-sample Au weight")
    assert [ax.get_title() for ax in fig.axes] == ["R1", "R3", "R9"]
    lo, hi = fig.axes[0].get_ylim()
    assert lo > hi
    assert fig.axes[0].patches[0].get_height() == pytest.approx(4.5)  # 90% of the 5 ft spacing
    assert fig.axes[1].get_xlim() == (0, 1)
    with pytest.raises(ValueError):
        figures.depth_profiles({})


def test_depth_profiles_single_hole_and_single_sample():
    one = {"R1": pd.DataFrame({"DepthToTop": [10.0], "weights": [0.4]})}
    assert len(figures.depth_profiles(one).axes) == 1


def test_line_series():
    frame = pd.DataFrame({3000.0: [1.0, 0.9], 100.0: [0.6, 0.5], 10.0: [0.3, 0.2]}, index=["R1", "R3"])
    fig = figures.line_series(frame, logx=True, invert_x=True, ylim=(0, 1.05), mark_x={3000.0: "legacy β"},
                              legend_title="hole")
    ax = fig.axes[0]
    assert ax.get_xscale() == "log"
    assert ax.get_xlim()[0] > ax.get_xlim()[1]
    assert [line.get_label() for line in ax.lines[:2]] == ["R1", "R3"]
    assert ax.lines[0].get_color() == rb_viz.theme()["series-1"]
    assert [t.get_text() for t in ax.texts] == ["legacy β"]
    seven = pd.DataFrame(np.ones((7, 2)))
    with pytest.raises(ValueError, match="at most 6"):
        figures.line_series(seven)


def test_correlation_heatmap_annotates_small_matrices_and_skips_missing():
    corr = pd.DataFrame([[1.0, 0.4, np.nan], [0.4, 1.0, -0.8], [np.nan, -0.8, 1.0]],
                        index=list("abc"), columns=list("abc"))
    fig = figures.correlation_heatmap(corr)
    ax = fig.axes[0]
    image = ax.images[0]
    assert image.get_clim() == (-1, 1)
    assert len(ax.texts) == 7  # nine cells, two missing
    big = pd.DataFrame(np.eye(13))
    assert not figures.correlation_heatmap(big).axes[0].texts


def test_steps_break_at_gaps_and_missing_values(intervals):
    x, y = figures._steps(intervals["from"].to_numpy(), intervals["to"].to_numpy(), intervals["Au"].to_numpy())
    assert np.isnan(x).sum() == 2  # one break for the unassayed sample, one for the gap at 40–50 ft
    assert list(y[:4]) == [0, 5, 5, 10]


def test_strip_log_tracks(intervals):
    fig = figures.strip_log(intervals, ["Au", "Ag"], category="lith", log=True, depth_label="depth (ft)",
                            titles={"Au": "Au (g/t)", "lith": "Lithology"})
    lith, au, ag = fig.axes
    assert [ax.get_title() for ax in fig.axes] == ["Lithology", "Au (g/t)", "Ag"]
    assert au.get_xscale() == "log" and ag.get_xscale() == "log"
    top, bottom = lith.get_ylim()[1], lith.get_ylim()[0]
    assert (top, bottom) == (0, 100)
    assert [t.get_text() for t in fig.legends[0].get_texts()] == ["Shale", "Chert"]
    plain = figures.strip_log(intervals, ["Au"])
    assert len(plain.axes) == 1 and not plain.legends
    with pytest.raises(ValueError):
        figures.strip_log(intervals, [])


def test_strip_log_keeps_linear_axis_for_zero_values(intervals):
    intervals.loc[0, "Ag"] = 0.0
    fig = figures.strip_log(intervals, ["Ag"], log=True)
    assert fig.axes[0].get_xscale() == "linear"
