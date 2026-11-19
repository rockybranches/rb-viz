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


def test_cdn_manifest_matches_the_built_files_and_the_version():
    import base64, hashlib, tomllib
    import rb_viz
    manifest = json.loads((ROOT / "dist" / "cdn.json").read_text(encoding="utf-8"))
    version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    assert manifest["version"] == version == rb_viz.__version__
    assert tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"] == version
    assert web.CDN_BASE == manifest["base"] == f"https://cdn.jsdelivr.net/gh/rockybranches/rb-viz@{version}/dist/"
    assert {"rb-viz.min.js", "rb-viz.esm.min.js", "rb-viz.min.css"} <= set(manifest["files"])
    for name, entry in manifest["files"].items():
        digest = hashlib.sha384((ROOT / "dist" / name).read_bytes()).digest()
        assert entry["integrity"] == "sha384-" + base64.b64encode(digest).decode(), name
        assert web.cdn_integrity(name) == entry["integrity"] and web.cdn_url(name) == web.CDN_BASE + name
    with pytest.raises(ValueError):
        web.cdn_url("rb-viz.min.js.map")


def test_cdn_tags_and_a_page_that_loads_rb_viz_from_the_cdn():
    css, js = web.cdn_tags().split("\n")
    assert css.startswith('<link rel="stylesheet" href="' + web.cdn_url("rb-viz.min.css") + '" integrity="sha384-')
    assert js.startswith('<script src="' + web.cdn_url("rb-viz.min.js") + '" integrity="sha384-')
    assert 'crossorigin="anonymous"' in css and 'crossorigin="anonymous"' in js
    assert web.cdn_tags("rb-viz.esm.min.js").startswith('<script type="module" src=')
    page = web.standalone_page("t", "RBViz.draw(app, {});", assets="cdn")
    assert css in page and js in page and "var RBViz" not in page and "--series-1" not in page
    assert page.index(js) < page.index("RBViz.bindThemeToggle")
    assert len(re.findall(r"<script\b", page)) == len(re.findall(r"</script>", page))
    with pytest.raises(ValueError):
        web.standalone_page("t", "", assets="elsewhere")


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
