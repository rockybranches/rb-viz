"""Colours. The values live in tokens.json, which the JavaScript and CSS are generated from too,
so a chart made in a notebook matches the same chart in a web app.
"""
import json
from collections.abc import Hashable, Iterable, Sequence
from importlib.resources import files
from typing import Literal

Scheme = Literal["light", "dark"]

TOKENS: dict = json.loads(files(__package__).joinpath("tokens.json").read_text(encoding="utf-8"))

#: series colours in their fixed order: use them in order, never by picking
SERIES: tuple[str, ...] = tuple(TOKENS["series"])
#: twelve colours for categories that have no colour of their own
CATEGORICAL: tuple[str, ...] = tuple(TOKENS["categorical"])
#: light to dark blue, for magnitudes
SEQUENTIAL: tuple[str, ...] = tuple(TOKENS["sequential"])
#: dark to light blue, for distance bands, nearest first
BANDS: tuple[str, ...] = tuple(TOKENS["bands"])
#: lithology colours after common geologic-map conventions
LITHOLOGY: dict[str, str] = dict(TOKENS["lithology"])


def theme(scheme: Scheme = "light") -> dict[str, str]:
    """The surface, ink, grid and accent colours of a scheme, keyed as in the CSS (`ink-2`, …)."""
    if scheme not in ("light", "dark"):
        raise ValueError(f"scheme must be 'light' or 'dark', not {scheme!r}")
    return dict(TOKENS[scheme])


def lithology_color(name: str) -> str:
    """The colour of a logged lithology; grey for one that is not in the table."""
    return LITHOLOGY.get(name, TOKENS["lithology-fallback"])


def categorical_colors(labels: Iterable[Hashable], palette: Sequence[str] = CATEGORICAL,
                       known: dict[str, str] | None = None) -> dict[Hashable, str]:
    """A colour for each distinct label, in order of first appearance.

    Labels found in `known` (for example `LITHOLOGY`) keep that colour. Past the end of the
    palette the colours repeat, so always show the name as well: colour must not be the only cue.
    """
    known = known or {}
    out: dict[Hashable, str] = {}
    used = 0
    for label in labels:
        if label in out:
            continue
        if str(label) in known:
            out[label] = known[str(label)]
        else:
            out[label] = palette[used % len(palette)]
            used += 1
    return out


def sampled_colors(n: int, cmap: str = "Paired") -> list[str]:
    """n colours sampled evenly from a matplotlib colormap, as hex.

    For more categories than `CATEGORICAL` has (the per-element pies of the Rimrock report use
    'Paired').
    """
    import matplotlib

    if n < 1:
        return []
    colors = matplotlib.colormaps[cmap].resampled(n)
    return [matplotlib.colors.to_hex(colors(i)) for i in range(n)]
