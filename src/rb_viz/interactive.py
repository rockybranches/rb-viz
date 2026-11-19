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
