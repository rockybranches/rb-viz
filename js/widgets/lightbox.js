// A full-screen image viewer with previous / next, and thumbnail galleries that open it.
import { esc } from "../format.js";

let box = null; // one lightbox per page, created on first use
const state = { items: [], i: 0, caption: null, opener: null };
let background = [];

function ensure() {
  if (box) return box;
  box = document.createElement("div");
  box.className = "lightbox";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Image viewer");
  box.innerHTML = `
    <button class="lb-close icon-btn" type="button" aria-label="Close">✕</button>
    <button class="lb-prev icon-btn" type="button" aria-label="Previous image">‹</button>
    <figure><img alt=""><figcaption></figcaption></figure>
    <button class="lb-next icon-btn" type="button" aria-label="Next image">›</button>`;
  document.body.append(box);
  box.querySelector(".lb-close").onclick = closeLightbox;
  box.querySelector(".lb-prev").onclick = () => step(-1);
  box.querySelector(".lb-next").onclick = () => step(1);
  box.addEventListener("click", (e) => {
    // the backdrop closes; so does following a link in the caption
    if (e.target === box || e.target.tagName === "FIGURE" || e.target.closest("figcaption a")) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
    if (e.key === "Tab") trapFocus(e);
  });
  return box;
}

// The viewer covers the page, so Tab must stay within it: wrap from the last control to the first.
function trapFocus(e) {
  const stops = [...box.querySelectorAll("button, a[href]")].filter((n) => !n.hidden);
  const first = stops[0], last = stops.at(-1);
  if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function disableBackground() {
  background = [...document.body.children]
    .filter((element) => element !== box)
    .map((element) => ({ element, inert: element.inert }));
  for (const { element } of background) element.inert = true;
}

function restoreBackground() {
  for (const { element, inert } of background) element.inert = inert;
  background = [];
}

function step(by) {
  state.i = (state.i + by + state.items.length) % state.items.length;
  show();
}

function show() {
  const it = state.items[state.i];
  const img = box.querySelector("img");
  img.src = it.src;
  img.alt = it.caption ?? "";
  const many = state.items.length > 1;
  box.querySelector(".lb-prev").hidden = box.querySelector(".lb-next").hidden = !many;
  box.querySelector("figcaption").innerHTML = (state.caption ? state.caption(it) : esc(it.caption))
    + (many ? ` <span class="lb-count">(${state.i + 1} / ${state.items.length})</span>` : "");
}

/**
 * Open the viewer on items[index]. items: [{ src, caption? }]. `caption(item)` may return HTML
 * (escape it yourself) to add links or dates; by default the item's caption is shown as text.
 * Arrow keys move, Escape closes, and focus returns to where it was.
 */
export function openLightbox(items, index = 0, { caption = null } = {}) {
  ensure();
  Object.assign(state, { items, i: index, caption, opener: document.activeElement });
  show();
  box.hidden = false;
  disableBackground();
  document.body.style.overflow = "hidden";
  box.querySelector(".lb-close").focus();
}

export function closeLightbox() {
  if (!box || box.hidden) return;
  box.hidden = true;
  restoreBackground();
  document.body.style.overflow = "";
  state.opener?.focus?.();
}

/**
 * Fill `root` with a grid of thumbnails that open the lightbox.
 * items: [{ src, thumb?, caption? }]. options: label(item) for the text under each thumbnail
 * (default: the caption), caption(item) for the lightbox, className ("gallery" or "figure-grid").
 */
export function gallery(root, items, { label = (it) => it.caption ?? "", caption = null, className = "gallery" } = {}) {
  root.innerHTML = `<div class="${esc(className)}">${items.map((it, i) =>
    `<figure><button type="button" data-i="${i}" aria-label="Open image: ${esc(it.caption ?? "")}"><img loading="lazy" src="${esc(it.thumb || it.src)}" alt="${esc(it.caption ?? "")}"></button><figcaption>${esc(label(it))}</figcaption></figure>`).join("")}</div>`;
  root.querySelectorAll("button[data-i]").forEach((b) => { b.onclick = () => openLightbox(items, +b.dataset.i, { caption }); });
}
