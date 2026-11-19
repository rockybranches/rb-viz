// The current view of a Leaflet map as a PNG.
//
// Leaflet draws a map as tile images, canvases and a few HTML elements. The PNG is put together
// from those same pieces, in the order and at the positions they have on screen. For everything
// to be included:
//   - create the map with `preferCanvas: true` (SVG layers are not copied);
//   - add the basemap with addBasemaps(..., { exportable: true }) so tiles may be read back,
//     and image overlays with imageOverlay(..., { exportable: true }) for the same reason;
//   - legends from legendControl() and labels from labeledPin() are redrawn from their text.
import { slug } from "../format.js";

const place = (node, box) => {
  const r = node.getBoundingClientRect();
  return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
};

const fontOf = (node) => {
  const style = getComputedStyle(node);
  return `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
};

/** Shorten text with an ellipsis until it fits `width`, as CSS text-overflow does on screen. */
export function fitText(ctx, text, width) {
  if (ctx.measureText(text).width <= width + 1) return text;
  let cut = text.length;
  while (cut > 1 && ctx.measureText(`${text.slice(0, cut)}…`).width > width) cut -= 1;
  return `${text.slice(0, cut)}…`;
}

function tilesLoaded(map, timeout) {
  const loading = [];
  map.eachLayer((layer) => { if (layer.isLoading?.()) loading.push(layer); });
  if (!loading.length) return Promise.resolve();
  return Promise.race([
    Promise.all(loading.map((layer) => new Promise((resolve) => layer.once("load", resolve)))),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);
}

/**
 * Render the map as it is on screen. Resolves to a PNG Blob.
 * options: attribution (the tile credit their licence requires; drawn bottom right),
 *          timeout (ms to wait for tiles still loading, default 8000).
 */
export async function renderMapPng(map, { attribution = "© OpenStreetMap contributors", timeout = 8000 } = {}) {
  await tilesLoaded(map, timeout);
  const container = map.getContainer();
  const box = container.getBoundingClientRect();
  const scale = globalThis.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(box.width * scale);
  canvas.height = Math.round(box.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ddd";
  ctx.fillRect(0, 0, box.width, box.height);

  // tiles and drawn layers, lowest pane first
  // (an image still loading, or one that failed, has no pixels to copy and is left out)
  const pieces = [...container.querySelectorAll("img.leaflet-tile-loaded, img.leaflet-image-layer, .leaflet-pane canvas")]
    .filter((node) => node.tagName !== "IMG" || (node.complete && node.naturalWidth > 0))
    .map((node, order) => {
      const style = getComputedStyle(node.closest(".leaflet-pane"));
      // an image overlay carries its own opacity, on top of its pane's
      const own = node.classList.contains("leaflet-image-layer") ? Number(getComputedStyle(node).opacity) : 1;
      return { node, order, z: Number(style.zIndex) || 0, opacity: Number(style.opacity) * own };
    })
    .sort((a, b) => a.z - b.z || a.order - b.order);
  for (const { node, opacity } of pieces) {
    const { x, y, w, h } = place(node, box);
    ctx.globalAlpha = opacity;
    ctx.drawImage(node, x, y, w, h);
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = "middle";

  // names beside pins
  for (const label of container.querySelectorAll(".leaflet-tooltip.site-label")) {
    const { x, y, w, h } = place(label, box);
    ctx.font = fontOf(label);
    const text = fitText(ctx, label.textContent, w);
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(text, x, y + h / 2);
    ctx.fillStyle = getComputedStyle(label).color;
    ctx.fillText(text, x, y + h / 2);
  }

  // legends
  for (const key of container.querySelectorAll(".map-legend")) {
    const style = getComputedStyle(key);
    const { x, y, w, h } = place(key, box);
    ctx.fillStyle = style.backgroundColor;
    ctx.strokeStyle = "rgb(0 0 0 / 30%)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    for (const row of key.children) {
      const line = place(row, box);
      let left = line.x;
      const swatch = row.querySelector("i");
      if (swatch) {
        const s = place(swatch, box);
        ctx.fillStyle = swatch.style.background;
        ctx.beginPath();
        if (swatch.classList.contains("square") || !ctx.roundRect) ctx.rect(s.x, s.y, s.w, s.h);
        else ctx.roundRect(s.x, s.y, s.w, s.h, s.w / 2);
        ctx.fill();
        left = s.x + s.w + 6;
      }
      ctx.font = fontOf(row);
      ctx.fillStyle = style.color;
      ctx.fillText(row.textContent, left, line.y + line.h / 2);
    }
  }

  if (attribution) {
    ctx.font = "11px system-ui, sans-serif";
    const width = ctx.measureText(attribution).width + 10;
    ctx.fillStyle = "rgb(255 255 255 / 80%)";
    ctx.fillRect(box.width - width, box.height - 18, width, 18);
    ctx.fillStyle = "#333";
    ctx.fillText(attribution, box.width - width + 5, box.height - 9);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("empty image"))), "image/png");
  });
}

/** Render the map and save it as `<name>-map.png`. */
export async function downloadMapPng(map, name = "map", options = {}) {
  const url = URL.createObjectURL(await renderMapPng(map, options));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(name)}-map.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
