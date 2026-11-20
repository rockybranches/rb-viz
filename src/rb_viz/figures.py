"""Static matplotlib figures.

Every function returns a `matplotlib.figure.Figure` drawn in the rb-viz style without touching
global rc settings, and leaves saving and closing to the caller.
"""
from collections.abc import Callable, Mapping, Sequence

import numpy as np
import pandas as pd

from .palette import Scheme, lithology_color, theme
from .style import _series, diverging_cmap, rc_context


def _pyplot():
    import matplotlib.pyplot as plt

    return plt


def ranked_bars(values: pd.Series, *, xlabel: str = "", title: str = "", limit: int | None = None,
                annotate_from: float | None = None, sort: bool = True, scheme: Scheme = "light",
                figsize: tuple[float, float] | None = None):
    """Horizontal bars, largest at the top: R² by element, mean co-enrichment, and the like.

    values: one number per label (the index). Missing values are left out.
    limit: draw only the top n. annotate_from: write the value beside bars at or above this.
    """
    plt = _pyplot()
    shown = values.dropna()
    if sort:
        shown = shown.sort_values(ascending=False)
    if limit is not None:
        shown = shown.iloc[:limit]
    shown = shown.iloc[::-1]  # barh draws the first row at the bottom
    with rc_context(scheme):
        fig, ax = plt.subplots(figsize=figsize or (6, max(2.0, 0.28 * len(shown) + 1.2)))
        ax.barh([str(i) for i in shown.index], shown.to_numpy(), height=0.7, color=_series(scheme)[0])
        ax.grid(axis="y", visible=False)
        ax.set_xlabel(xlabel)
        ax.set_title(title)
        if annotate_from is not None and len(shown):
            pad = 0.01 * float(np.nanmax(np.abs(shown.to_numpy())) or 1)
            for y, v in enumerate(shown.to_numpy()):
                if v >= annotate_from:
                    ax.text(v + pad, y, f"{v:.2f}", va="center", fontsize=8, color=theme(scheme)["ink-2"])
        fig.tight_layout()
    return fig


def depth_profiles(profiles: Mapping[str, pd.DataFrame], *, depth: str = "DepthToTop", value: str = "weights",
                   thickness: float | None = None, xlabel: str = "weight", ylabel: str = "depth",
                   xlim: tuple[float, float] | None = (0, 1), title: str = "", scheme: Scheme = "light",
                   panel_size: tuple[float, float] = (2.3, 7)):
    """One panel per hole: a value against depth as horizontal bars, depth increasing downward.

    profiles: hole id → table with a depth column (top of each sample) and a value column, in the
    order the panels should appear (e.g. north to south).
    thickness: bar height in depth units; by default 90% of each hole's typical sample spacing.
    """
    plt = _pyplot()
    if not profiles:
        raise ValueError("depth_profiles needs at least one profile")
    with rc_context(scheme):
        fig, axes = plt.subplots(1, len(profiles), figsize=(panel_size[0] * len(profiles), panel_size[1]),
                                 sharey=True, squeeze=False)
        for ax, (name, df) in zip(axes[0], profiles.items()):
            d = df[depth].to_numpy(dtype=float)
            height = thickness
            if height is None:
                steps = np.diff(np.sort(d))
                steps = steps[steps > 0]
                height = 0.9 * float(np.median(steps)) if len(steps) else 1.0
            ax.barh(d, df[value].to_numpy(dtype=float), height=height, align="edge", color=_series(scheme)[0])
            ax.set_title(str(name))
            ax.set_xlabel(xlabel)
            if xlim is not None:
                ax.set_xlim(*xlim)
        axes[0][0].set_ylabel(ylabel)
        axes[0][0].invert_yaxis()  # shared: flips every panel
        if title:
            fig.suptitle(title, fontweight="bold")
        fig.tight_layout()
    return fig


def line_series(frame: pd.DataFrame, *, xlabel: str = "", ylabel: str = "", legend_title: str = "",
                logx: bool = False, invert_x: bool = False, ylim: tuple[float, float] | None = None,
                mark_x: Mapping[float, str] | None = None, title: str = "", scheme: Scheme = "light",
                figsize: tuple[float, float] = (7, 4.5)):
    """One line per row of `frame` across its columns (the x values): sensitivity curves.

    At most six rows get distinct colours; with more, split the chart. mark_x: x value → label,
    drawn as dashed vertical lines (e.g. the default parameter value).
    """
    plt = _pyplot()
    colors = _series(scheme)
    if len(frame) > len(colors):
        raise ValueError(f"line_series draws at most {len(colors)} lines; got {len(frame)}")
    t = theme(scheme)
    with rc_context(scheme):
        fig, ax = plt.subplots(figsize=figsize)
        for color, (name, row) in zip(colors, frame.iterrows()):
            ax.plot(frame.columns, row.to_numpy(), color=color, linewidth=2, marker="o", markersize=5, label=str(name))
        if logx:
            ax.set_xscale("log")
        if invert_x:
            ax.invert_xaxis()
        if ylim is not None:
            ax.set_ylim(*ylim)
        for x, label in (mark_x or {}).items():
            ax.axvline(x, color=t["muted"], linewidth=1, linestyle="--")
            ax.annotate(label, (x, 1), xycoords=("data", "axes fraction"), xytext=(4, -10),
                        textcoords="offset points", fontsize=9, color=t["ink-2"])
        ax.set_xlabel(xlabel)
        ax.set_ylabel(ylabel)
        ax.set_title(title)
        if len(frame) > 1:
            ax.legend(title=legend_title or None)
        fig.tight_layout()
    return fig


def correlation_heatmap(corr: pd.DataFrame, *, title: str = "", annotate: bool | None = None,
                        scheme: Scheme = "light", figsize: tuple[float, float] | None = None):
    """A correlation matrix, −1 to 1, two hues around a neutral middle. Missing cells stay blank.

    annotate: write r in each cell; by default only for matrices up to 12 × 12.
    """
    plt = _pyplot()
    n = len(corr)
    annotate = n <= 12 if annotate is None else annotate
    t = theme(scheme)
    with rc_context(scheme):
        side = max(3.5, 0.42 * n + 1.6)
        fig, ax = plt.subplots(figsize=figsize or (side + 0.8, side))
        image = ax.imshow(np.ma.masked_invalid(corr.to_numpy(dtype=float)), vmin=-1, vmax=1, cmap=diverging_cmap(scheme))
        ax.grid(False)
        ax.set_xticks(range(n), [str(c) for c in corr.columns], rotation=90 if n > 8 else 0)
        ax.set_yticks(range(n), [str(i) for i in corr.index])
        ax.set_xticks(np.arange(n + 1) - 0.5, minor=True)
        ax.set_yticks(np.arange(n + 1) - 0.5, minor=True)
        ax.grid(which="minor", color=t["surface"], linewidth=1.5)  # thin gaps between cells
        ax.tick_params(which="both", length=0)
        for spine in ax.spines.values():
            spine.set_visible(False)
        if annotate:
            for i in range(n):
                for j in range(n):
                    v = corr.iat[i, j]
                    if pd.notna(v):
                        ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=8,
                                color="#ffffff" if abs(v) > 0.6 else t["ink"])
        fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04, label="r")
        ax.set_title(title)
        fig.tight_layout()
    return fig


def strip_log(intervals: pd.DataFrame, columns: Sequence[str], *, top: str = "from", base: str = "to",
              category: str | None = None, category_color: Callable[[str], str] = lithology_color,
              log: bool = False, depth_label: str = "depth", titles: Mapping[str, str] | None = None,
              title: str = "", scheme: Scheme = "light", figsize: tuple[float, float] | None = None):
    """A drill hole as tracks side by side against depth (the printable twin of the web strip log).

    intervals: one row per sampled interval with its top and base depth.
    columns: value columns, one track each, drawn as filled step curves; nothing is drawn across
    a gap between intervals or a missing value.
    category: a text column (lithology) drawn as coloured bands in a first, narrow track, with a
    legend naming every colour.
    log: log x-axes for tracks whose values are all positive.
    """
    plt = _pyplot()
    df = intervals.sort_values(top)
    tops, bases = df[top].to_numpy(dtype=float), df[base].to_numpy(dtype=float)
    titles = dict(titles or {})
    n = len(columns) + (1 if category else 0)
    if n == 0:
        raise ValueError("strip_log needs at least one column or a category")
    t = theme(scheme)
    series = _series(scheme)[0]
    with rc_context(scheme):
        widths = ([0.5] if category else []) + [1.0] * len(columns)
        fig, axes = plt.subplots(1, n, figsize=figsize or (1.2 + 1.9 * sum(widths), 9), sharey=True,
                                 squeeze=False, gridspec_kw={"width_ratios": widths})
        axes = list(axes[0])
        if category:
            ax = axes.pop(0)
            labels = df[category]
            seen: dict[str, str] = {}
            for a, b, label in zip(tops, bases, labels):
                if pd.isna(label) or label == "":
                    continue
                color = seen.setdefault(str(label), category_color(str(label)))
                ax.axhspan(a, b, color=color, linewidth=0)
            ax.set_xticks([])
            ax.grid(False)
            ax.set_title(titles.get(category, category), fontsize=9)
            handles = [plt.Rectangle((0, 0), 1, 1, facecolor=c, edgecolor=t["axis"], linewidth=0.5) for c in seen.values()]
            fig.legend(handles, list(seen), loc="lower center", ncols=min(4, max(1, len(seen))), fontsize=8)
            axes_first = ax
        else:
            axes_first = axes[0]
        for ax, column in zip(axes, columns):
            x, y = _steps(tops, bases, df[column].to_numpy(dtype=float))
            ax.fill_betweenx(y, 0, x, color=series, alpha=0.2, linewidth=0)
            ax.plot(x, y, color=series, linewidth=1.2)
            finite = x[np.isfinite(x)]
            if log and len(finite) and (finite > 0).all():
                ax.set_xscale("log")
            elif len(finite):
                ax.set_xlim(left=min(0.0, float(finite.min())))
            ax.set_title(titles.get(column, column), fontsize=9)
            ax.tick_params(axis="x", labelsize=8)
        axes_first.set_ylabel(depth_label)
        axes_first.set_ylim(float(np.nanmax(bases)), min(0.0, float(np.nanmin(tops))))
        if title:
            fig.suptitle(title, fontweight="bold")
        fig.tight_layout(rect=(0, 0.06 if category else 0, 1, 1))
    return fig


def _steps(tops: np.ndarray, bases: np.ndarray, values: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Step outline of interval values; NaN pairs break the line at gaps and missing values."""
    x: list[float] = []
    y: list[float] = []
    last = None
    for a, b, v in zip(tops, bases, values):
        if np.isnan(v):
            x.append(np.nan); y.append(np.nan); last = None
            continue
        if last is not None and abs(last - a) > 1e-6:
            x.append(np.nan); y.append(np.nan)
        x += [v, v]; y += [a, b]; last = b
    return np.array(x, dtype=float), np.array(y, dtype=float)
