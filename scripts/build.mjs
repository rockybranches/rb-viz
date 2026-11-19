// Builds everything that is generated from other files in this repository:
//   js/tokens.js and css/tokens.css  from src/rb_viz/tokens.json (the one place colours are set)
//   dist/rb-viz.css                  css/tokens.css + css/components.css + css/maps.css
//   dist/rb-viz.js, dist/rb-viz.esm.js  the modules under js/ as one file each
// Run with `npm run build`. `npm run check` fails when the committed output is out of date.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const stale = [];

async function emit(path, text) {
  const file = join(root, path);
  if (check) {
    const current = await readFile(file, "utf8").catch(() => null);
    if (current !== text) stale.push(path);
    return;
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
}

const tokens = JSON.parse(await readFile(join(root, "src/rb_viz/tokens.json"), "utf8"));
const header = "generated from src/rb_viz/tokens.json by scripts/build.mjs; do not edit";

const tokensJs = `// ${header}\nexport const TOKENS = ${JSON.stringify(tokens, null, 2)};\n`;
await emit("js/tokens.js", tokensJs);

const vars = (theme, indent) => [
  ...Object.entries(tokens[theme]).map(([k, v]) => `${indent}--${k}: ${v};`),
  `${indent}--seq: ${tokens.sequential.join(", ")};`,
].join("\n");
const tokensCss = `/* ${header} */
:root {
  color-scheme: light;
${vars("light", "  ")}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${vars("dark", "    ")}
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
${vars("dark", "  ")}
}
`;
await emit("css/tokens.css", tokensCss);

const css = [tokensCss];
for (const name of ["components.css", "maps.css"]) css.push(await readFile(join(root, "css", name), "utf8"));
await emit("dist/rb-viz.css", css.join("\n"));

// tokens.js must exist before bundling; in --check mode the committed copy is bundled
const common = { entryPoints: [join(root, "js/index.js")], bundle: true, write: false, target: "es2020",
  banner: { js: "/* rb-viz: https://github.com/rockybranches/rb-viz */" } };
const iife = await build({ ...common, format: "iife", globalName: "RBViz" });
await emit("dist/rb-viz.js", iife.outputFiles[0].text);
const esm = await build({ ...common, format: "esm" });
await emit("dist/rb-viz.esm.js", esm.outputFiles[0].text);

if (stale.length) {
  console.error(`Out of date: ${stale.join(", ")}. Run \`npm run build\` and commit the result.`);
  process.exit(1);
}
console.log(check ? "Generated files are up to date." : "Built js/tokens.js, css/tokens.css and dist/.");
