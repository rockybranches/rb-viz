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


def asset(name: str) -> str:
    """The text of a built asset: "rb-viz.css", or "rb-viz.js" (a classic script that defines
    the global `RBViz`)."""
    if name not in _ASSETS:
        raise ValueError(f"unknown asset {name!r}; available: {', '.join(_ASSETS)}")
    return files(__package__).joinpath("assets", name).read_text(encoding="utf-8")


def json_for_script(data: Any) -> str:
    """JSON that is safe inside a <script> element: `</script>` or `<!--` in a string cannot end
    or confuse the element. NaN and infinities, which are not JSON, are refused."""
    text = json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    return text.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def standalone_page(title: str, script: str, *, data: Any = None, subtitle: str = "",
                    nav: Sequence[tuple[str, str, str]] = (), footer: str = "", description: str = "",
                    plotly: bool = True, leaflet: bool = False, storage_key: str = "rb-viz-theme",
                    lang: str = "en") -> str:
    """A complete HTML page in one string: rb-viz inlined, your data embedded, your script run.

    script: JavaScript for the page. It runs with `RBViz` (every rb-viz component), `DATA` (your
      data) and `app` (the empty <main id="app"> to fill). Define `window.redraw` to have the
      page drawn again when the visitor switches between light and dark.
    data: anything JSON can hold; embedded in the page, so the file works offline apart from
      Plotly / Leaflet, which are loaded from a CDN when `plotly` / `leaflet` is true.
    nav: (route, href, text) links for the header, e.g. ("holes", "#/holes", "Drill holes");
      the route is what `RBViz.setActiveNav` and `RBViz.hashRouter` match.
    title, subtitle, footer, description and the nav texts are plain text and are escaped.
    """
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
  <style>
{asset("rb-viz.css")}
  </style>
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
  <script>
{asset("rb-viz.js").replace("</script", "<\\/script")}
  </script>
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
