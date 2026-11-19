"""Plotly figures (install rb-viz with the `plotly` extra). Functions return `go.Figure`."""
from collections.abc import Sequence

import pandas as pd

from .palette import Scheme, sampled_colors
from .style import plotly_template


def stacked_share_bars(shares: pd.DataFrame, order: Sequence[str] | None = None, *, title: str = "",
                       group_label: str = "Hole #", part_label: str = "Element", value_label: str = "Weight",
                       width: int | None = 400, scheme: Scheme = "light"):
    """One stacked bar per row of `shares`, one segment per column, each bar summing to 1.

    The Rimrock report's "per-hole Au correlation": rows are holes, columns are elements, values
    are each element's share of the hole. order: the rows left to right (e.g. north to south).
    Segments carry their part's name, so the chart reads without the legend.
    """
    import plotly.express as px

    long = (shares.rename_axis(index=group_label, columns=part_label)
                  .stack().rename(value_label).reset_index())
    parts = sorted(shares.columns)
    fig = px.bar(long, x=group_label, y=value_label, color=part_label, text=part_label,
                 category_orders={part_label: parts, group_label: list(order if order is not None else shares.index)},
                 color_discrete_sequence=sampled_colors(len(parts)), width=width, template=plotly_template(scheme))
    fig.update_traces(marker_line_color=fig.layout.template.layout.paper_bgcolor, marker_line_width=1,
                      textposition="inside", insidetextanchor="middle")
    fig.update_yaxes(showgrid=False, showticklabels=False, visible=False)
    fig.update_layout(title=title or None, margin=dict(l=0, r=0, t=36 if title else 8, b=0), barmode="stack",
                      uniformtext_minsize=10, uniformtext_mode="hide", legend=dict(y=0.95),
                      yaxis=dict(range=[0, 1]))
    return fig


def share_pie(shares: pd.Series, *, title: str = "", colors: Sequence[str] | None = None,
              part_label: str = "Element", scheme: Scheme = "light"):
    """The parts of one whole (one hole's element weights) as a pie, labelled inside the slices.

    colors: one per part in sorted order; by default sampled from 'Paired', so the same part has
    the same colour in every pie made from the same set of parts.
    """
    import plotly.express as px

    data = shares.rename_axis(part_label).rename("Value").reset_index()
    parts = sorted(shares.index)
    fig = px.pie(data, names=part_label, values="Value", category_orders={part_label: parts},
                 color=part_label, color_discrete_sequence=list(colors or sampled_colors(len(parts))),
                 template=plotly_template(scheme))
    fig.update_traces(textposition="inside", sort=False)
    fig.update_layout(title_text=title or None)
    return fig


def correlation_heatmap(corr: pd.DataFrame, *, title: str = "", scheme: Scheme = "light"):
    """A correlation matrix, −1 to 1, with r in the tooltip. The web component's twin."""
    import plotly.graph_objects as go

    template = plotly_template(scheme)
    fig = go.Figure(go.Heatmap(
        z=corr.to_numpy(), x=[str(c) for c in corr.columns], y=[str(i) for i in corr.index],
        zmin=-1, zmax=1, xgap=1, ygap=1, colorscale=template.layout.colorscale.diverging,
        colorbar=dict(title=dict(text="r"), thickness=12),
        hovertemplate="%{y} – %{x}: r = %{z:.2f}<extra></extra>"))
    fig.update_layout(template=template, title=title or None, margin=dict(l=60, r=10, t=40 if title else 10, b=60),
                      xaxis=dict(showgrid=False, type="category"),
                      yaxis=dict(showgrid=False, type="category", autorange="reversed"))
    return fig


def ranked_bars(values: pd.Series, *, xlabel: str = "", title: str = "", limit: int | None = 14,
                scheme: Scheme = "light"):
    """Horizontal bars, largest at the top. The web component's twin."""
    import plotly.graph_objects as go

    shown = values.dropna().sort_values(ascending=False)
    if limit is not None:
        shown = shown.iloc[:limit]
    shown = shown.iloc[::-1]
    fig = go.Figure(go.Bar(x=shown.to_numpy(), y=[str(i) for i in shown.index], orientation="h",
                           hovertemplate="%{y}: %{x:.3f}<extra></extra>"))
    fig.update_layout(template=plotly_template(scheme), title=title or None, bargap=0.35,
                      margin=dict(l=80, r=16, t=40 if title else 8, b=40),
                      xaxis=dict(title=dict(text=xlabel)), yaxis=dict(showgrid=False, type="category"))
    return fig


def cross_plot(frame: pd.DataFrame, x: str, y: str, *, highlight: str | None = None, value=None,
               label: str | None = None, log: bool = True, scheme: Scheme = "light"):
    """One measure against another, on log axes by default (points at or below zero are left out).

    highlight / value: a column and one of its values (e.g. "hole", "R9"): those rows are drawn
    in colour on top of the others in grey. label: a column named in the tooltip (sample ids).
    """
    import plotly.graph_objects as go

    template = plotly_template(scheme)
    df = frame.dropna(subset=[x, y])
    if log:
        df = df[(df[x] > 0) & (df[y] > 0)]
    colorway = template.layout.colorway
    grey = template.layout.xaxis.linecolor

    def trace(rows: pd.DataFrame, name: str, color: str, size: int):
        text = rows[label].astype(str) if label else None
        return go.Scattergl(x=rows[x], y=rows[y], mode="markers", name=name, text=text,
                            hovertemplate=("%{text}<br>" if label else "") + f"{x} %{{x}}<br>{y} %{{y}}<extra></extra>",
                            marker=dict(color=color, size=size, line=dict(color=template.layout.paper_bgcolor, width=1)))

    if highlight is not None:
        mine = df[highlight] == value
        traces = [trace(df[~mine], "Others", grey, 6), trace(df[mine], str(value), colorway[0], 8)]
    else:
        traces = [trace(df, "Samples", colorway[0], 7)]
    fig = go.Figure(traces)
    kind = "log" if log else "linear"
    suffix = " (log)" if log else ""
    fig.update_layout(template=template, showlegend=highlight is not None, margin=dict(l=60, r=10, t=30, b=50),
                      legend=dict(orientation="h", y=1.08, x=0),
                      xaxis=dict(type=kind, title=dict(text=f"{x}{suffix}")),
                      yaxis=dict(type=kind, title=dict(text=f"{y}{suffix}")))
    return fig


def log_histogram(groups: dict[str, pd.Series], *, title: str = "value", bin_size: float | None = None,
                  scheme: Scheme = "light"):
    """Overlaid histograms of log10(value), each as a percentage of its own group.

    groups: name → values. Zero, negative and missing values are left out. With several groups
    the first is drawn in grey (the "others") and the rest in the series colours.
    """
    import numpy as np
    import plotly.graph_objects as go

    template = plotly_template(scheme)
    many = len(groups) > 1
    colors = ([template.layout.xaxis.linecolor] if many else []) + list(template.layout.colorway)
    if len(groups) > len(colors):
        raise ValueError(f"log_histogram compares at most {len(colors)} groups; got {len(groups)}")
    bins = dict(xbins=dict(size=bin_size)) if bin_size else dict(nbinsx=40)
    fig = go.Figure()
    for color, (name, values) in zip(colors, groups.items()):
        v = pd.to_numeric(pd.Series(values), errors="coerce")
        fig.add_trace(go.Histogram(x=np.log10(v[v > 0]), name=str(name), histnorm="percent", opacity=0.75,
                                   marker=dict(color=color), **bins))
    fig.update_layout(template=template, barmode="overlay", bargap=0.04, showlegend=many,
                      legend=dict(orientation="h", y=1.08, x=0), margin=dict(l=50, r=10, t=30 if many else 10, b=50),
                      xaxis=dict(title=dict(text=f"log₁₀ {title}")), yaxis=dict(title=dict(text="% of samples")))
    return fig


def strip_log(intervals: pd.DataFrame, columns: Sequence[str], *, top: str = "from", base: str = "to",
              category: str | None = None, log: bool = False, depth_label: str = "Depth",
              titles: dict[str, str] | None = None, height: int | None = None, scheme: Scheme = "light"):
    """A drill hole as tracks side by side against depth, with zoom and tooltips.

    intervals: one row per sampled interval with its top and base depth. columns: one filled
    step track each. category: a text column (lithology) drawn as coloured bands in a first,
    narrower track; the name is in the tooltip. log: log axes for tracks that are all positive.
    """
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots

    from .figures import _steps
    from .palette import categorical_colors, LITHOLOGY

    template = plotly_template(scheme)
    df = intervals.sort_values(top)
    tops, bases = df[top].to_numpy(dtype=float), df[base].to_numpy(dtype=float)
    titles = dict(titles or {})
    tracks = ([category] if category else []) + list(columns)
    if not tracks:
        raise ValueError("strip_log needs at least one column or a category")
    widths = ([0.6] if category else []) + [1.0] * len(columns)
    fig = make_subplots(rows=1, cols=len(tracks), shared_yaxes=True, horizontal_spacing=0.012,
                        column_widths=widths, subplot_titles=[titles.get(t, t) for t in tracks])
    color = template.layout.colorway[0]
    for i, track in enumerate(tracks, start=1):
        if track == category:
            rows = df[df[category].notna() & (df[category] != "")]
            colors = categorical_colors(rows[category], known=LITHOLOGY)
            fig.add_trace(go.Bar(orientation="h", x=[1] * len(rows), y=(rows[top] + rows[base]) / 2,
                                 width=(rows[base] - rows[top]).replace(0, 1), text=rows[category].astype(str),
                                 textposition="none", marker=dict(color=[colors[v] for v in rows[category]], line_width=0),
                                 hovertemplate="%{text}<extra></extra>"), row=1, col=i)
            fig.update_xaxes(showticklabels=False, range=[0, 1], showgrid=False, zeroline=False, fixedrange=True, row=1, col=i)
            continue
        values = df[track].to_numpy(dtype=float)
        x, y = _steps(tops, bases, values)
        # one trace per unbroken run of intervals: a single filled trace would shade across the gaps
        keep = ~np.isnan(x)
        for run in np.split(np.arange(len(x)), np.flatnonzero(~keep)):
            run = run[keep[run]]
            if len(run):
                fig.add_trace(go.Scatter(x=x[run], y=y[run], mode="lines", line=dict(color=color, width=1.5),
                                         fill="tozerox", fillcolor=_rgba(color, 0.2), hoverinfo="skip"), row=1, col=i)
        fig.add_trace(go.Scatter(x=values, y=(tops + bases) / 2, mode="markers", marker=dict(size=8, opacity=0),
                                 hovertemplate=f"{track} %{{x}}<extra></extra>"), row=1, col=i)
        finite = values[np.isfinite(values)]
        fig.update_xaxes(type="log" if log and len(finite) and (finite > 0).all() else "linear", side="top",
                         fixedrange=True, row=1, col=i)
    bottom, first = float(np.nanmax(bases)), min(0.0, float(np.nanmin(tops)))
    pad = max(1.0, (bottom - first) * 0.01)
    fig.update_yaxes(range=[bottom + pad, first - pad], zeroline=False)
    fig.update_yaxes(title_text=depth_label, row=1, col=1)
    fig.update_annotations(font_size=11, yshift=18)  # track titles above the top axes
    fig.update_layout(template=template, showlegend=False, hovermode="y unified", bargap=0,
                      height=height or int(min(1400, max(560, 14 * len(df) + 120))), margin=dict(l=58, r=8, t=64, b=20))
    return fig


def holes_3d(collars: pd.DataFrame, intervals: pd.DataFrame, value: str, *, hole: str = "hole",
             top: str = "from", base: str = "to", depth_scale: float = 1.0, value_title: str | None = None,
             axis_titles: Sequence[str] = ("Easting", "Northing", "Elevation"), scheme: Scheme = "light"):
    """Drill holes in 3D: a line per hole from its collar, a marker per assayed interval.

    collars: indexed by hole id, with columns x, y, z (collar position), azimuth (degrees
      clockwise from north), inclination (degrees below horizontal; 90 = vertical) and length.
    intervals: rows with the hole id, top and base depth along the hole, and the value column.
      Markers are coloured and sized by log10(value); values at or below zero are left out.
    depth_scale: multiplies depths into the units of x, y, z (0.3048 for feet on a metre grid).
    """
    import numpy as np
    import plotly.graph_objects as go

    template = plotly_template(scheme)
    t = template.layout

    def offset(row, distance):
        inc, az = np.radians(row.get("inclination", 90.0)), np.radians(row.get("azimuth", 0.0))
        horizontal = distance * np.cos(inc)
        return horizontal * np.sin(az), horizontal * np.cos(az), -distance * np.sin(inc)

    data = intervals[intervals[value] > 0]
    logs = np.log10(data[value].to_numpy(dtype=float))
    cmin, cmax = (float(logs.min()), float(logs.max())) if len(logs) else (0.0, 1.0)
    ticks = list(range(int(np.ceil(cmin)), int(np.floor(cmax)) + 1))
    fig = go.Figure()
    bar_drawn = False
    for hole_id, c in collars.iterrows():
        dx, dy, dz = offset(c, c["length"] * depth_scale)
        fig.add_trace(go.Scatter3d(x=[c["x"], c["x"] + dx], y=[c["y"], c["y"] + dy], z=[c["z"], c["z"] + dz],
                                   mode="lines+text", text=[str(hole_id), ""], textposition="top center",
                                   line=dict(color=t.xaxis.tickfont.color, width=3), hoverinfo="skip", showlegend=False))
        rows = data[data[hole] == hole_id]
        if rows.empty:
            continue
        mid = ((rows[top] + rows[base]) / 2).to_numpy(dtype=float) * depth_scale
        px, py, pz = offset(c, mid)
        lv = np.log10(rows[value].to_numpy(dtype=float))
        size = 2 + 6.6 * np.clip((lv - cmin) / ((cmax - cmin) or 1), 0, 1)
        colorbar = None
        if not bar_drawn:
            colorbar = dict(title=dict(text=value_title or value), len=0.6, thickness=12)
            if ticks:
                colorbar.update(tickvals=ticks, ticktext=[f"{10.0 ** k:g}" for k in ticks])
            bar_drawn = True
        fig.add_trace(go.Scatter3d(
            x=c["x"] + px, y=c["y"] + py, z=c["z"] + pz, mode="markers", name=str(hole_id), showlegend=False,
            customdata=np.column_stack([rows[top], rows[base], rows[value]]),
            hovertemplate=f"{hole_id} %{{customdata[0]}}–%{{customdata[1]}}<br>{value_title or value} %{{customdata[2]}}<extra></extra>",
            marker=dict(size=size, color=lv, colorscale=t.colorscale.sequential, cmin=cmin, cmax=cmax,
                        line_width=0, opacity=0.9, colorbar=colorbar)))
    axis = lambda title: dict(title=dict(text=title), gridcolor=t.xaxis.gridcolor, showbackground=False)  # noqa: E731
    fig.update_layout(template=template, margin=dict(l=0, r=0, t=0, b=0),
                      scene=dict(xaxis=axis(axis_titles[0]), yaxis=axis(axis_titles[1]), zaxis=axis(axis_titles[2]),
                                 aspectmode="data", camera=dict(eye=dict(x=1.9, y=-1.3, z=0.9))))
    return fig


def _rgba(color: str, alpha: float) -> str:
    """A hex colour with an alpha channel, as CSS rgba()."""
    r, g, b = (int(color[i:i + 2], 16) for i in (1, 3, 5))
    return f"rgba({r},{g},{b},{alpha})"
