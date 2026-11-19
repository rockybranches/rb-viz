import json
import re
from pathlib import Path

import pytest

from rb_viz import web

ROOT = Path(__file__).resolve().parents[1]


def test_packaged_assets_are_the_built_ones():
    for name in ("rb-viz.css", "rb-viz.js"):
        assert web.asset(name) == (ROOT / "dist" / name).read_text(encoding="utf-8")
    with pytest.raises(ValueError):
        web.asset("../tokens.json")


def test_json_for_script_cannot_close_the_element():
    text = web.json_for_script({"note": "</script><script>alert(1)</script>", "n": 1.5})
    assert "<" not in text
    assert json.loads(text) == {"note": "</script><script>alert(1)</script>", "n": 1.5}
    with pytest.raises(ValueError):
        web.json_for_script({"bad": float("nan")})


def test_standalone_page_embeds_everything_and_escapes_text():
    page = web.standalone_page("Assays <2026>", "RBViz.draw(app, {});", data={"rows": [1, 2], "x": "</script>"},
                               subtitle="A & B", nav=[("holes", "#/holes", "Drill <holes>")], footer="made by test",
                               leaflet=True, storage_key="t-theme")
    assert page.startswith("<!doctype html>")
    assert "<title>Assays &lt;2026&gt;</title>" in page and "A &amp; B" in page
    assert '<a href="#/holes" data-route="holes">Drill &lt;holes&gt;</a>' in page
    assert "var RBViz" in page and "--series-1" in page
    assert web.PLOTLY_URL in page and web.LEAFLET_JS_URL in page and web.LEAFLET_CSS_URL in page
    assert 'localStorage.getItem("t-theme")' in page
    data = re.search(r'<script id="data" type="application/json">(.*?)</script>', page, re.S).group(1)
    assert json.loads(data) == {"rows": [1, 2], "x": "</script>"}
    # every <script> opened is closed, and nothing in the inlined code closes one early
    assert len(re.findall(r"<script\b", page)) == len(re.findall(r"</script>", page))
    bare = web.standalone_page("t", "", plotly=False)
    assert "plotly" not in bare.split("<style>")[0] and web.PLOTLY_URL not in bare
