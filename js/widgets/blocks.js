// Small building blocks of a dashboard page: stat tiles, a composition bar, a sortable table.
import { esc, fmt } from "../format.js";

/** Stat tiles: tiles = [{ value, label }]. */
export function statTiles(root, tiles) {
  root.classList.add("tiles");
  root.innerHTML = tiles.map((t) => `<div class="tile"><div class="v">${esc(t.value)}</div><div class="l">${esc(t.label)}</div></div>`).join("");
}

/**
 * A bar split by share, with a legend that names every part and its percentage (so colour is
 * not the only cue). parts: [{ name, length }] (see categoryShares()); color: (name) => css;
 * describe: (part) => tooltip text.
 */
export function compositionBar(root, parts, { color, label = "Composition", describe = (p) => `${p.name}: ${fmt(p.length)}` }) {
  const total = parts.reduce((s, p) => s + p.length, 0) || 1;
  root.innerHTML = `
    <div class="lithbar" role="img" aria-label="${esc(label)}: ${esc(parts.map((p) => `${p.name} ${Math.round(100 * p.length / total)}%`).join(", "))}">
      ${parts.map((p) => `<span title="${esc(describe(p))}" style="flex:${p.length};background:${esc(color(p.name))}"></span>`).join("")}</div>
    <div class="legend">${parts.map((p) => `<span><i class="swatch" style="background:${esc(color(p.name))}"></i>${esc(p.name)} ${Math.round(100 * p.length / total)}%</span>`).join("")}</div>`;
}

/** Order two cells: numbers numerically, text naturally ("R2" before "R10"), empty cells last. */
export function compareCells(x, y, dir = 1) {
  if (x == null || y == null) return (x == null) - (y == null);
  return dir * (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }));
}

/**
 * A table whose headings sort it and whose rows can be clicked or opened with Enter.
 *
 * columns: [{ key, title, numeric?, cell?(row) → HTML, className?(row) }]; without `cell` the
 * value is formatted with fmt() (numbers) or escaped (text).
 * options: onRow(row), limit (rows drawn, default 1000), filter (text; matched against
 * filterKeys, default all columns), note (element that receives "n of m match; showing first k").
 * Returns { update(newOptions) } to change rows / filter and redraw.
 */
export function dataTable(table, columns, rows, options = {}) {
  const state = { rows, sort: null, limit: 1000, filter: "", ...options };
  const draw = () => {
    const needle = state.filter.trim().toLowerCase();
    const keys = state.filterKeys ?? columns.map((c) => c.key);
    let shown = needle ? state.rows.filter((r) => keys.some((k) => r[k] != null && String(r[k]).toLowerCase().includes(needle))) : state.rows.slice();
    if (state.sort) shown.sort((a, b) => compareCells(a[state.sort.key], b[state.sort.key], state.sort.dir));
    const drawn = shown.slice(0, state.limit);
    table.innerHTML = `<thead><tr>${columns.map((c) => `<th scope="col" class="sortable ${c.numeric ? "num" : ""}" data-key="${esc(c.key)}"
        ${state.sort?.key === c.key ? `aria-sort="${state.sort.dir > 0 ? "ascending" : "descending"}"` : ""}><button type="button">${esc(c.title ?? c.key)}</button></th>`).join("")}</tr></thead>
      <tbody>${drawn.map((r, i) => `<tr ${state.onRow ? `class="clickable" tabindex="0" data-i="${i}"` : ""}>${columns.map((c) =>
        `<td class="${c.numeric ? "num" : ""} ${c.className ? esc(c.className(r)) : ""}">${c.cell ? c.cell(r) : r[c.key] == null ? "" : fmt(r[c.key])}</td>`).join("")}</tr>`).join("")}</tbody>`;
    table.querySelectorAll("th[data-key]").forEach((th) => {
      th.querySelector("button").onclick = () => {
        state.sort = { key: th.dataset.key, dir: state.sort?.key === th.dataset.key ? -state.sort.dir : 1 };
        draw();
      };
    });
    if (state.onRow) {
      table.querySelectorAll("tr[data-i]").forEach((tr) => {
        tr.onclick = () => state.onRow(drawn[+tr.dataset.i]);
        tr.onkeydown = (e) => { if (e.key === "Enter") state.onRow(drawn[+tr.dataset.i]); };
      });
    }
    if (state.note) {
      const notes = [];
      if (needle) notes.push(`${shown.length.toLocaleString("en-US")} of ${state.rows.length.toLocaleString("en-US")} match`);
      if (shown.length > state.limit) notes.push(`showing the first ${state.limit.toLocaleString("en-US")}`);
      state.note.textContent = notes.join("; ");
    }
  };
  draw();
  return { update(changes) { Object.assign(state, changes); draw(); } };
}
