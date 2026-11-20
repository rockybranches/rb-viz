"""The rb-viz look for matplotlib and Plotly: quiet grid, no top or right spine, token colours."""
from contextlib import contextmanager

from .palette import SEQUENTIAL, SERIES, TOKENS, Scheme, theme

_FONTS = ["system-ui", "Segoe UI", "Helvetica Neue", "Arial", "DejaVu Sans"]


def matplotlib_rc(scheme: Scheme = "light") -> dict:
    """rc settings for a scheme. Use for one figure with `plt.rc_context(matplotlib_rc())`, or
    for a whole session with `use_style()`."""
    from cycler import cycler

    t = theme(scheme)
    return {
        "figure.facecolor": t["surface"], "axes.facecolor": t["surface"], "savefig.facecolor": t["surface"],
        "text.color": t["ink"], "axes.labelcolor": t["ink-2"], "axes.titlecolor": t["ink"],
        "axes.edgecolor": t["axis"], "xtick.color": t["ink-2"], "ytick.color": t["ink-2"],
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.color": t["grid"], "grid.linewidth": 0.6, "axes.axisbelow": True,
        "axes.prop_cycle": cycler(color=_series(scheme)),
        "font.family": "sans-serif", "font.sans-serif": _FONTS,
        "axes.titlesize": 11, "axes.titleweight": "bold", "axes.labelsize": 10,
        "xtick.labelsize": 9, "ytick.labelsize": 9, "legend.frameon": False, "legend.fontsize": 9,
        "figure.dpi": 110, "savefig.dpi": 200, "savefig.bbox": "tight",
    }


@contextmanager
def rc_context(scheme: Scheme = "light"):
    """`plt.rc_context(matplotlib_rc(scheme))` that leaves interactive mode alone.

    Interactive mode is itself an rc setting. Jupyter's inline backend turns it on when the
    first figure is made; plain `plt.rc_context` would turn it back off on the way out, and
    every later figure in the notebook would then not be shown.
    """
    import matplotlib
    import matplotlib.pyplot as plt

    interactive = matplotlib.is_interactive()
    try:
        with plt.rc_context(matplotlib_rc(scheme)):
            yield
            interactive = matplotlib.is_interactive()
    finally:
        matplotlib.interactive(interactive)


def use_style(scheme: Scheme = "light") -> None:
    """Apply the rb-viz look to every matplotlib figure made from now on (a notebook's first cell)."""
    import matplotlib

    matplotlib.rcParams.update(matplotlib_rc(scheme))


def _series(scheme: Scheme) -> list[str]:
    t = theme(scheme)
    return [t["series-1"], t["series-2"], t["series-3"], *SERIES[3:]]


def sequential_cmap():
    """Light to dark blue, for magnitudes."""
    from matplotlib.colors import LinearSegmentedColormap

    return LinearSegmentedColormap.from_list("rb_viz_sequential", list(SEQUENTIAL))


def diverging_cmap(scheme: Scheme = "light"):
    """Negative, neutral, positive: for correlations and other values around zero."""
    from matplotlib.colors import LinearSegmentedColormap

    t = theme(scheme)
    return LinearSegmentedColormap.from_list(
        "rb_viz_diverging", [t["diverge-neg"], t["diverge-mid"], t["diverge-pos"]], N=257)  # odd: exact middle


def plotly_template(scheme: Scheme = "light"):
    """A Plotly template matching the web components: `fig.update_layout(template=plotly_template())`."""
    import plotly.graph_objects as go

    t = theme(scheme)
    axis = dict(gridcolor=t["grid"], linecolor=t["axis"], zerolinecolor=t["axis"],
                tickfont=dict(color=t["ink-2"], size=11), title=dict(font=dict(color=t["ink-2"], size=12)))
    seq = [[i / (len(SEQUENTIAL) - 1), c] for i, c in enumerate(SEQUENTIAL)]
    return go.layout.Template(layout=dict(
        paper_bgcolor=t["surface"], plot_bgcolor=t["surface"],
        font=dict(family=TOKENS["font"], color=t["ink-2"], size=12),
        title=dict(font=dict(color=t["ink"], size=16)),
        colorway=_series(scheme), xaxis=axis, yaxis=axis,
        hoverlabel=dict(bgcolor=t["surface"], bordercolor=t["axis"], font=dict(color=t["ink"], size=12)),
        legend=dict(font=dict(color=t["ink-2"])),
        colorscale=dict(sequential=seq, diverging=[[0, t["diverge-neg"]], [0.5, t["diverge-mid"]],
                                                   [1, t["diverge-pos"]]]),
    ))
