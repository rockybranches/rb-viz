"""Shared data visualization components for rockybranches projects.

    rb_viz.palette      colours and themes (the same tokens the JavaScript components use)
    rb_viz.style        matplotlib rc settings, colormaps and a Plotly template in those colours
    rb_viz.figures      static matplotlib figures (needs nothing beyond the base install)
    rb_viz.interactive  Plotly figures (install with the `plotly` extra)
    rb_viz.maps         folium maps (install with the `maps` extra)

Figure functions take data and return a figure. They never read or write files and never
change global plotting state.
"""
from .palette import (BANDS, CATEGORICAL, LITHOLOGY, SEQUENTIAL, SERIES, categorical_colors,
                      lithology_color, theme)

__version__ = "0.3.0"

__all__ = ["BANDS", "CATEGORICAL", "LITHOLOGY", "SEQUENTIAL", "SERIES", "categorical_colors",
           "lithology_color", "theme", "__version__"]
