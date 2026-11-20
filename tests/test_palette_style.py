import json
import re
from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import pytest

import rb_viz
from rb_viz import palette, style

ROOT = Path(__file__).resolve().parents[1]
HEX = re.compile(r"^#[0-9a-f]{6}$")


def test_palettes_are_hex_and_distinct():
    for colors in (rb_viz.SERIES, rb_viz.CATEGORICAL, rb_viz.SEQUENTIAL, rb_viz.BANDS):
        assert all(HEX.match(c) for c in colors)
        assert len(set(colors)) == len(colors)
    assert len(rb_viz.SERIES) == 6
    assert all(HEX.match(c) for c in rb_viz.LITHOLOGY.values())


def test_themes_have_the_same_keys():
    assert rb_viz.theme("light").keys() == rb_viz.theme("dark").keys()
    assert rb_viz.theme("light")["ink"] != rb_viz.theme("dark")["ink"]
    with pytest.raises(ValueError):
        rb_viz.theme("sepia")


def test_generated_javascript_and_css_match_the_tokens():
    """`npm run build` regenerates these from tokens.json; a stale copy would split the look."""
    js = (ROOT / "js" / "tokens.js").read_text(encoding="utf-8")
    assert json.loads(js[js.index("{"):js.rindex("}") + 1]) == palette.TOKENS
    css = (ROOT / "css" / "tokens.css").read_text(encoding="utf-8")
    for scheme in ("light", "dark"):
        for name, value in palette.TOKENS[scheme].items():
            assert f"--{name}: {value};" in css
    assert f"--seq: {', '.join(palette.SEQUENTIAL)};" in css


def test_lithology_and_categorical_colors():
    assert rb_viz.lithology_color("Chert") == "#7d9db7"
    assert rb_viz.lithology_color("Unobtainium") == "#cccccc"
    colors = rb_viz.categorical_colors(["b", "a", "b", "Shale"], known=rb_viz.LITHOLOGY)
    assert colors == {"b": rb_viz.CATEGORICAL[0], "a": rb_viz.CATEGORICAL[1], "Shale": "#5b5b5b"}
    many = rb_viz.categorical_colors(range(14))
    assert many[12] == many[0]  # repeats past the palette


def test_sampled_colors():
    colors = palette.sampled_colors(5)
    assert len(colors) == 5 and len(set(colors)) == 5 and all(HEX.match(c) for c in colors)
    assert palette.sampled_colors(0) == []


def test_matplotlib_rc_is_valid_and_scoped():
    before = matplotlib.rcParams["axes.grid"], matplotlib.rcParams["axes.facecolor"]
    for scheme in ("light", "dark"):
        with plt.rc_context(style.matplotlib_rc(scheme)):
            assert matplotlib.rcParams["axes.facecolor"] == rb_viz.theme(scheme)["surface"]
            assert matplotlib.rcParams["axes.spines.top"] is False
    assert (matplotlib.rcParams["axes.grid"], matplotlib.rcParams["axes.facecolor"]) == before


def test_colormaps_and_plotly_template():
    assert matplotlib.colors.to_hex(style.sequential_cmap()(0.0)) == rb_viz.SEQUENTIAL[0]
    assert matplotlib.colors.to_hex(style.sequential_cmap()(1.0)) == rb_viz.SEQUENTIAL[-1]
    assert matplotlib.colors.to_hex(style.diverging_cmap()(0.5)) == rb_viz.theme()["diverge-mid"]
    template = style.plotly_template("dark")
    assert template.layout.paper_bgcolor == rb_viz.theme("dark")["surface"]
    assert template.layout.colorway[0] == rb_viz.theme("dark")["series-1"]


def test_rc_context_restores_style_but_keeps_interactive_mode():
    # Jupyter's inline backend turns interactive mode on while the first figure is made;
    # if the style context turned it back off, later figures in a notebook would not show.
    was, grid = matplotlib.is_interactive(), matplotlib.rcParams["axes.grid"]
    try:
        matplotlib.interactive(False)
        with style.rc_context():
            assert matplotlib.rcParams["axes.spines.top"] is False
            matplotlib.interactive(True)
        assert matplotlib.is_interactive()
        assert matplotlib.rcParams["axes.grid"] == grid
    finally:
        matplotlib.interactive(was)
