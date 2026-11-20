// The CDN side of a release. rb-viz is served by jsDelivr straight from this repository's
// tags: https://cdn.jsdelivr.net/gh/rockybranches/rb-viz@<version>/dist/<file>
//
//   node scripts/cdn.mjs snippet            the HTML tags for this version, with integrity hashes
//   node scripts/cdn.mjs notes              release notes: this version's changelog entry and the tags
//   node scripts/cdn.mjs verify [--ref X]   download every file from the CDN and compare it with
//                                           dist/cdn.json (X: a tag or commit instead of the version)
//   node scripts/cdn.mjs purge              refresh the moving addresses (@latest, @0, @0.3)
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cdn = JSON.parse(await readFile(join(root, "dist/cdn.json"), "utf8"));
const [command, ...args] = process.argv.slice(2);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function snippet() {
  const tag = (name) => `${cdn.base}${name}" integrity="${cdn.files[name].integrity}" crossorigin="anonymous"`;
  return [
    `<link rel="stylesheet" href="${tag("rb-viz.min.css")}>`,
    `<script src="${tag("rb-viz.min.js")}></script>`,
    "",
    "<!-- or, as a module, instead of the script above -->",
    `<link rel="modulepreload" href="${tag("rb-viz.esm.min.js")}>`,
    `<script type="module">import { draw, stripLog } from "${cdn.base}rb-viz.esm.min.js";</script>`,
  ].join("\n");
}

async function notes() {
  const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8");
  const start = changelog.indexOf(`## ${cdn.version}\n`);
  const rest = start < 0 ? "" : changelog.slice(start + cdn.version.length + 4);
  const entry = rest.slice(0, rest.search(/^## /m) < 0 ? undefined : rest.search(/^## /m)).trim();
  return `${entry}\n\n### From the CDN\n\n\`\`\`html\n${snippet()}\n\`\`\`\n`;
}

async function verify() {
  const ref = args.includes("--ref") ? args[args.indexOf("--ref") + 1] : cdn.version;
  const base = cdn.base.replace(`@${cdn.version}/`, `@${ref}/`);
  let failed = 0;
  for (const [name, { integrity }] of Object.entries(cdn.files)) {
    let result = "no answer";
    // a new tag can take a moment to reach jsDelivr
    for (let attempt = 0; attempt < 6 && result !== "ok"; attempt++) {
      if (attempt) await sleep(10000);
      try {
        const response = await fetch(base + name);
        if (!response.ok) { result = `HTTP ${response.status}`; continue; }
        const body = Buffer.from(await response.arrayBuffer());
        const got = "sha384-" + createHash("sha384").update(body).digest("base64");
        const cors = response.headers.get("access-control-allow-origin");
        result = got !== integrity ? "the content differs from dist/cdn.json"
          : cors !== "*" ? `access-control-allow-origin is ${cors}` : "ok";
        if (result !== "ok") break;   // a wrong file will not get better by waiting
      } catch (error) { result = error.cause?.message ?? error.message; }
    }
    if (result !== "ok") failed++;
    console.log(`${result === "ok" ? "ok  " : "FAIL"}  ${base}${name}${result === "ok" ? "" : `  (${result})`}`);
  }
  if (failed) process.exit(1);
}

async function purge() {
  const [major, minor] = cdn.version.split(".");
  let failed = 0;
  for (const range of ["latest", major, `${major}.${minor}`]) {
    for (const name of Object.keys(cdn.files)) {
      const url = `https://purge.jsdelivr.net/gh/rockybranches/rb-viz@${range}/dist/${name}`;
      const response = await fetch(url).catch((error) => ({ ok: false, status: error.cause?.message ?? error.message }));
      if (!response.ok) failed++;
      console.log(`${response.ok ? "purged" : `NOT purged (${response.status})`}  @${range}/dist/${name}`);
    }
  }
  if (failed) {
    console.error(`${failed} address(es) were not refreshed and may serve the previous release for up to a week. `
      + "The release itself is published; run `node scripts/cdn.mjs purge` again.");
    process.exit(1);
  }
}

const commands = { snippet: () => console.log(snippet()), notes: async () => console.log(await notes()), verify, purge };
if (!commands[command]) {
  console.error("Usage: node scripts/cdn.mjs snippet | notes | verify [--ref <tag or commit>] | purge");
  process.exit(2);
}
await commands[command]();
