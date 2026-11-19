// The colours a chart is drawn with. On a page that loads rb-viz.css they are read from the CSS
// custom properties, so charts follow the light/dark setting; anywhere else (Node, a page without
// the stylesheet) the same values come from tokens.js.
import { TOKENS } from "./tokens.js";

function build(get) {
  const series = [get("series-1"), get("series-2"), get("series-3"), ...TOKENS.series.slice(3)];
  return {
    page: get("page"), surface: get("surface"), surface2: get("surface-2"),
    ink: get("ink"), ink2: get("ink-2"), muted: get("muted"),
    grid: get("grid"), axis: get("axis"), border: get("border"), accent: get("accent"),
    header: get("header"),
    series,
    divergeNeg: get("diverge-neg"), divergeMid: get("diverge-mid"), divergePos: get("diverge-pos"),
    sequential: get("seq") ?? TOKENS.sequential,
    font: TOKENS.font,
  };
}

/** The theme for a named scheme, straight from the tokens: themeFor("dark"). */
export function themeFor(scheme = "light") {
  const set = TOKENS[scheme === "dark" ? "dark" : "light"];
  return build((name) => (name === "seq" ? TOKENS.sequential : set[name]));
}

/** "light" or "dark": the page's data-theme when set, else the system preference. */
export function currentScheme(root = globalThis.document?.documentElement) {
  const set = root?.dataset?.theme;
  if (set === "light" || set === "dark") return set;
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The theme in effect on the page: CSS custom properties first, tokens for anything not set. */
export function currentTheme(root = globalThis.document?.documentElement) {
  const fallback = TOKENS[currentScheme(root)];
  if (!root || !globalThis.getComputedStyle) return themeFor(currentScheme(root));
  const style = globalThis.getComputedStyle(root);
  return build((name) => {
    const value = style.getPropertyValue(`--${name}`).trim();
    if (name === "seq") return value ? value.split(",").map((s) => s.trim()) : TOKENS.sequential;
    return value || fallback[name];
  });
}

/**
 * Apply the theme the visitor chose earlier. Call from an inline script in <head> so the page
 * does not flash the other scheme. Storage can be blocked; the theme is then just not remembered.
 */
export function initTheme(storageKey = "rb-viz-theme", root = document.documentElement) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch { /* storage blocked */ }
}

/** Switch between light and dark, remember it, and return the new scheme. */
export function toggleTheme(storageKey = "rb-viz-theme", root = document.documentElement) {
  const next = currentScheme(root) === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem(storageKey, next); } catch { /* storage blocked */ }
  return next;
}

/**
 * Make a button switch the theme. Charts read their colours when drawn, so pass `onChange` to
 * redraw them: bindThemeToggle(button, { storageKey: "my-app-theme", onChange: route }).
 */
export function bindThemeToggle(button, { storageKey = "rb-viz-theme", onChange } = {}) {
  const sync = () => button.setAttribute("aria-pressed", String(currentScheme() === "dark"));
  sync();
  button.addEventListener("click", () => {
    const scheme = toggleTheme(storageKey);
    sync();
    onChange?.(scheme);
  });
}
