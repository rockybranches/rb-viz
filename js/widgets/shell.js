// The frame of a dashboard page: hash routes ("#/holes/R9/120") and the active navigation link.
import { esc } from "../format.js";

/** Split a hash into decoded parts: "#/holes/R%209/120" → ["holes", "R 9", "120"]. */
export function parseHash(hash = globalThis.location?.hash ?? "") {
  const path = hash.replace(/^#\/?/, "");
  if (!path) return [];
  return path.split("/").map((part) => { try { return decodeURIComponent(part); } catch { return part; } });
}

/** Build a hash from parts, encoding each: hashFor("holes", "R 9", 120) → "#/holes/R%209/120". */
export const hashFor = (...parts) => `#/${parts.filter((p) => p != null && p !== "").map((p) => encodeURIComponent(p)).join("/")}`;

/** Mark the navigation link of the current view: links carry data-route="<name>". */
export function setActiveNav(route, nav = document.getElementById("nav")) {
  nav?.querySelectorAll("a[data-route]").forEach((a) => {
    const on = a.dataset.route === route;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

/**
 * Show the view named by the first part of the hash, now and whenever the hash changes.
 *
 * routes: { name: (…rest of the hash parts) => void | Promise }, with "" for the start page;
 * an unknown name shows the start page. The matching navigation link is marked, the page
 * scrolls to the top on a change, and a view that throws is replaced by a short error message
 * in `root` instead of leaving the previous view on screen.
 * History changes made with history.replaceState (a depth picked inside a view) do not fire.
 * Returns { render } to draw the current view again (e.g. after a theme switch).
 */
export function hashRouter(routes, { root = document.getElementById("app"), nav = document.getElementById("nav") } = {}) {
  const render = async () => {
    const [name = "", ...rest] = parseHash();
    const key = Object.hasOwn(routes, name) ? name : "";
    setActiveNav(key || "overview", nav);
    try {
      await routes[key]?.(...rest);
    } catch (e) {
      console.error(e);
      if (root) root.innerHTML = `<div class="error" role="alert"><b>Could not show this page.</b> ${esc(e.message)}</div>`;
    }
  };
  globalThis.addEventListener("hashchange", () => { render(); globalThis.scrollTo?.(0, 0); });
  render();
  return { render };
}
