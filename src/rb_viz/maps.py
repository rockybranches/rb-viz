"""folium maps (install rb-viz with the `maps` extra)."""
import base64
import html
from collections.abc import Mapping
from pathlib import Path

#: map centre (lat, lon) and zoom of the Rimrock prospect, the default view
RIMROCK_CENTER = (40.74, -116.862)
RIMROCK_ZOOM = 12


def cluster_marker_map(locations, popup_pngs: Mapping[str, Path] | None = None, surface=None, *,
                       center: tuple[float, float] | None = None, zoom: int = RIMROCK_ZOOM,
                       cluster_column: str = "class"):
    """Markers over clustered surface samples.

    locations: GeoSeries, one point per marker (a drill hole), indexed by its name.
    popup_pngs: name → PNG file shown in the marker's popup (the hole's pie chart); names
      without a file, or whose file is missing, get no popup.
    surface: GeoDataFrame of points with a cluster column; each cluster is drawn as its convex
      hull, coloured and named in the legend.
    center: (lat, lon); by default the middle of the markers.
    """
    import folium

    popup_pngs = popup_pngs or {}
    points = locations.to_crs("EPSG:4326")
    if center is None:
        center = ((float(points.y.mean()), float(points.x.mean())) if len(points) else RIMROCK_CENTER)
    fig_map = folium.Map(location=center, zoom_start=zoom)
    if surface is not None and len(surface):
        hulls = surface[[cluster_column, "geometry"]].dissolve(cluster_column, as_index=False)
        hulls = hulls.set_geometry(hulls.convex_hull)
        hulls[cluster_column] = hulls[cluster_column].astype(str)
        hulls.to_crs("EPSG:4326").explore(
            column=cluster_column, m=fig_map, popup=True, cmap="Set1", categorical=True,
            style_kwds=dict(color="black", weight=1, fillOpacity=0.35), legend=True, name="Cluster",
            legend_kwds=dict(colorbar=False))
    for name, point in points.items():
        png = popup_pngs.get(name)
        popup = None
        if png is not None and Path(png).exists():
            src = "data:image/png;base64," + base64.b64encode(Path(png).read_bytes()).decode()
            image = f'<img src="{src}" alt="{html.escape(str(name))}">'
            popup = folium.Popup(html=folium.Html(f'<iframe srcdoc="{html.escape(image)}">', script=True))
        folium.Marker((point.y, point.x), popup=popup, tooltip=html.escape(str(name)),
                      icon=folium.Icon(icon="o", prefix="fa")).add_to(fig_map)
    folium.LayerControl().add_to(fig_map)
    return fig_map
