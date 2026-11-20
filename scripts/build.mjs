// Builds everything that is generated from other files in this repository:
//   js/tokens.js and css/tokens.css  from src/rb_viz/tokens.json (the one place colours are set)
//   dist/rb-viz.css                  css/tokens.css + css/components.css + css/maps.css
//   dist/rb-viz.js, dist/rb-viz.esm.js  the modules under js/ as one file each
//   dist/*.min.js, *.min.css, *.map  the same, minified, with source maps: what the CDN serves
//   dist/cdn.json                    the CDN address of this version and an integrity hash per file
//   src/rb_viz/assets/               copies of rb-viz.css, rb-viz.js and cdn.json for the Python package
// Run with `npm run build`. `npm run check` fails when the committed output is out of date.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { build, transform } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const stale = [];
const built = {};   // dist file name -> text, for the integrity hashes in cdn.json

async function emit(path, text) {
  if (path.startsWith("dist/") && !path.endsWith(".map")) built[path.slice(5)] = text;
  const file = join(root, path);
  if (check) {
    const current = await readFile(file, "utf8").catch(() => null);
    if (current !== text) stale.push(path);
    return;
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
}

// One version for the npm package, the Python package and the CDN address. package.json leads.
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
for (const [path, pattern] of [["pyproject.toml", /^version = "(.*)"$/m], ["src/rb_viz/__init__.py", /^__version__ = "(.*)"$/m]]) {
  const found = (await readFile(join(root, path), "utf8")).match(pattern)?.[1];
  if (found !== version) {
    console.error(`${path} says version ${found}, package.json says ${version}. Make them the same.`);
    process.exit(1);
  }
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
// the Python package ships the stylesheet and the classic script, for pages written from Python
await emit("src/rb_viz/assets/rb-viz.css", css.join("\n"));

await emit("dist/rb-viz.min.css", (await transform(css.join("\n"), { loader: "css", minify: true })).code);

// tokens.js must exist before bundling; in --check mode the committed copy is bundled
const common = { entryPoints: [join(root, "js/index.js")], bundle: true, write: false, target: "es2020",
  banner: { js: `/* rb-viz ${version}: https://github.com/rockybranches/rb-viz */` } };
const formats = { "rb-viz": { format: "iife", globalName: "RBViz" }, "rb-viz.esm": { format: "esm" } };
for (const [name, format] of Object.entries(formats)) {
  const plain = await build({ ...common, ...format });
  await emit(`dist/${name}.js`, plain.outputFiles[0].text);
  if (name === "rb-viz") await emit("src/rb_viz/assets/rb-viz.js", plain.outputFiles[0].text);
  // the map lists the files under js/ by relative path, which the CDN also serves
  const min = await build({ ...common, ...format, minify: true, sourcemap: "linked", sourcesContent: false,
    outfile: join(root, `dist/${name}.min.js`) });
  for (const file of min.outputFiles) await emit(`dist/${file.path.slice(root.length + 1).split("/").pop()}`, file.text);
}

const cdn = {
  version,
  base: `https://cdn.jsdelivr.net/gh/rockybranches/rb-viz@${version}/dist/`,
  files: Object.fromEntries(Object.keys(built).sort().map((name) => [name, {
    integrity: "sha384-" + createHash("sha384").update(built[name]).digest("base64"),
    bytes: Buffer.byteLength(built[name]),
  }])),
};
const cdnJson = JSON.stringify(cdn, null, 2) + "\n";
await emit("dist/cdn.json", cdnJson);
await emit("src/rb_viz/assets/cdn.json", cdnJson);

if (stale.length) {
  console.error(`Out of date: ${stale.join(", ")}. Run \`npm run build\` and commit the result.`);
  process.exit(1);
}
console.log(check ? "Generated files are up to date." : "Built js/tokens.js, css/tokens.css and dist/.");
