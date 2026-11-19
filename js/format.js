// Text and number formatting shared by the charts, maps and widgets.

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape text for use inside HTML. null and undefined become "". */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);

/**
 * A number for a table or label: `digits` significant figures, thousands separators from 1,000 up,
 * an en dash for a missing value. Text is returned escaped.
 */
export function fmt(v, digits = 3) {
  if (v == null || (typeof v === "number" && Number.isNaN(v))) return "–";
  if (typeof v !== "number") return esc(v);
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("en-US");
  if (v === 0) return "0";
  return Number(v.toPrecision(digits)).toString();
}

/** A fixed number of decimals at most, with thousands separators: fixed(1234.5678, 1) → "1,234.6". */
export const fixed = (v, decimals = 0) =>
  v == null ? "–" : Number(v).toLocaleString("en-US", { maximumFractionDigits: decimals });

/** "1 sample", "2 samples", "1,200 samples". */
export const plural = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

/** log10 of a positive number, else null: zero and negatives cannot sit on a log axis. */
export const log10 = (v) => (v != null && v > 0 ? Math.log10(v) : null);

/** A name that is safe in a file name: "Site A / 2" → "Site_A_2". */
export const slug = (s) => String(s).replace(/[^\w.-]+/g, "_");
