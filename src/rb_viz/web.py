"""Web pages from Python: the rb-viz stylesheet and JavaScript, and a one-file page built on them.

For projects that write HTML from Python (a generated dashboard, a FastAPI app) and want the
same charts as the web apps without a JavaScript build step.
"""
import html
import json
from collections.abc import Sequence
from importlib.resources import files
from typing import Any

#: the library versions the components are tested with
PLOTLY_URL = "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js"
LEAFLET_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
LEAFLET_CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"

_ASSETS = ("rb-viz.css", "rb-viz.js")
_CDN = json.loads(files(__package__).joinpath("assets", "cdn.json").read_text(encoding="utf-8"))

#: where this version of rb-viz is served from (jsDelivr, from the repository's release tag)
CDN_BASE: str = _CDN["base"]


def asset(name: str) -> str:
    """The text of a built asset: "rb-viz.css", or "rb-viz.js" (a classic script that defines
    the global `RBViz`)."""
    if name not in _ASSETS:
        raise ValueError(f"unknown asset {name!r}; available: {', '.join(_ASSETS)}")
    return files(__package__).joinpath("assets", name).read_text(encoding="utf-8")


def _cdn_file(name: str) -> dict:
    if name not in _CDN["files"]:
        raise ValueError(f"unknown CDN file {name!r}; available: {', '.join(_CDN['files'])}")
    return _CDN["files"][name]


def cdn_url(name: str = "rb-viz.min.js") -> str:
    """The CDN address of a built file of this rb-viz version, e.g. "rb-viz.min.js",
    "rb-viz.min.css" or "rb-viz.esm.min.js". The address is for one version and never changes."""
    _cdn_file(name)
    return CDN_BASE + name


def cdn_integrity(name: str = "rb-viz.min.js") -> str:
    """The integrity hash ("sha384-...") of a file on the CDN, for the `integrity` attribute."""
    return _cdn_file(name)["integrity"]


def cdn_tags(*names: str) -> str:
    """The <link> / <script> elements that load rb-viz from the CDN, with integrity hashes so
    the browser refuses a file that is not the released one. By default the minified stylesheet
    and classic script (the global `RBViz`)."""
    tags = []
    for name in names or ("rb-viz.min.css", "rb-viz.min.js"):
        rest = f'integrity="{cdn_integrity(name)}" crossorigin="anonymous"'
        if name.endswith(".css"):
            tags.append(f'<link rel="stylesheet" href="{cdn_url(name)}" {rest}>')
        else:
            module = ' type="module"' if ".esm." in name else ""
            tags.append(f'<script{module} src="{cdn_url(name)}" {rest}></script>')
    return "\n".join(tags)


def json_for_script(data: Any) -> str:
    """JSON that is safe inside a <script> element: `</script>` or `<!--` in a string cannot end
    or confuse the element. NaN and infinities, which are not JSON, are refused."""
    text = json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    return text.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def standalone_page(title: str, script: str, *, data: Any = None, subtitle: str = "",
                    nav: Sequence[tuple[str, str, str]] = (), footer: str = "", description: str = "",
                    plotly: bool = True, leaflet: bool = False, storage_key: str = "rb-viz-theme",
                    lang: str = "en", assets: str = "inline") -> str:
    """A complete HTML page in one string: rb-viz inlined, your data embedded, your script run.

    script: JavaScript for the page. It runs with `RBViz` (every rb-viz component), `DATA` (your
      data) and `app` (the empty <main id="app"> to fill). Define `window.redraw` to have the
      page drawn again when the visitor switches between light and dark.
    data: anything JSON can hold; embedded in the page, so the file works offline apart from
      Plotly / Leaflet, which are loaded from a CDN when `plotly` / `leaflet` is true.
    nav: (route, href, text) links for the header, e.g. ("holes", "#/holes", "Drill holes");
      the route is what `RBViz.setActiveNav` and `RBViz.hashRouter` match.
    assets: "inline" (the default) puts the rb-viz stylesheet and script in the page, so it does
      not depend on rb-viz being reachable. "cdn" loads them from the CDN instead: a much smaller
      file, and pages share the visitor's cached copy, but the page needs the network and this
      rb-viz version must be released (tagged).
    title, subtitle, footer, description and the nav texts are plain text and are escaped.
    """
    if assets not in ("inline", "cdn"):
        raise ValueError(f'assets must be "inline" or "cdn", not {assets!r}')
    if assets == "cdn":
        style, library = cdn_tags("rb-viz.min.css"), cdn_tags("rb-viz.min.js")
    else:
        style = f"<style>\n{asset('rb-viz.css')}\n  </style>"
        library = "<script>\n" + asset("rb-viz.js").replace("</script", "<\\/script") + "\n  </script>"
    e = html.escape
    links = "".join(f'<a href="{e(href)}" data-route="{e(route)}">{e(text)}</a>' for route, href, text in nav)
    key = json_for_script(storage_key)
    return f"""<!doctype html>
<html lang="{e(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  {f'<meta name="description" content="{e(description)}">' if description else ""}
  {f'<link rel="stylesheet" href="{LEAFLET_CSS_URL}">' if leaflet else ""}
  {style}
  <script>
    try {{ const t = localStorage.getItem({key}); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; }} catch (e) {{}}
  </script>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="#/">
      <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#1c5cab"/><path d="M6 24 13 10l4 7 3-4 6 11z" fill="#fab219"/></svg>
      <span><strong>{e(title)}</strong>{f"<small>{e(subtitle)}</small>" if subtitle else ""}</span>
    </a>
    <nav id="nav" aria-label="Sections">{links}</nav>
    <button id="theme" class="icon-btn" type="button" title="Toggle light/dark" aria-label="Dark theme">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" fill="currentColor"/></svg>
    </button>
  </header>
  <main id="app" tabindex="-1"></main>
  {f'<footer class="footer">{e(footer)}</footer>' if footer else ""}
  <script id="data" type="application/json">{json_for_script(data)}</script>
  {f'<script src="{LEAFLET_JS_URL}"></script>' if leaflet else ""}
  {f'<script src="{PLOTLY_URL}"></script>' if plotly else ""}
  {library}
  <script>
    const DATA = JSON.parse(document.getElementById("data").textContent);
    const app = document.getElementById("app");
    RBViz.bindThemeToggle(document.getElementById("theme"), {{ storageKey: {key}, onChange: () => window.redraw?.() }});
  </script>
  <script>
{script.replace("</script", "<\\/script")}
  </script>
</body>
</html>
"""
