const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve("dist");
const failures = [];
const requireFile = (relative) => {
  const target = path.join(root, relative);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) failures.push(`Missing file: ${relative}`);
};
const requirePngSize = (relative, expected) => {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) return;
  const png = fs.readFileSync(target);
  const signature = "89504e470d0a1a0a";
  if (png.length < 24 || png.subarray(0, 8).toString("hex") !== signature) {
    failures.push(`Invalid PNG: ${relative}`);
    return;
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== expected || height !== expected) failures.push(`Icon ${relative} is ${width}x${height}; expected ${expected}x${expected}.`);
};
requireFile("manifest.json");
if (failures.length) throw new Error(failures.join("\n"));

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) failures.push("manifest_version must be 3.");
if (!manifest.background?.service_worker) failures.push("MV3 service worker is missing.");
if (manifest.web_accessible_resources?.some((entry) => entry.matches?.includes("<all_urls>"))) failures.push("web_accessible_resources must not use <all_urls>.");
const csp = manifest.content_security_policy?.extension_pages ?? "";
if (!csp.includes("script-src 'self'")) failures.push("Extension CSP must restrict scripts to self.");
if (/https?:/.test(csp) || /'unsafe-eval'/.test(csp)) failures.push("Extension CSP permits remote or unsafe executable code.");

requireFile(manifest.background?.service_worker ?? "__missing__");
requireFile(manifest.action?.default_popup ?? "__missing__");
for (const [size, icon] of Object.entries(manifest.icons ?? {})) {
  requireFile(icon);
  requirePngSize(icon, Number(size));
}
for (const script of manifest.content_scripts ?? []) for (const file of script.js ?? []) requireFile(file);
for (const required of [
  "review.html", "offscreen.html", "engine/stockfishWorker.js", "engine/stockfish-18-lite-single.js",
  "engine/stockfish-18-lite-single.wasm", "engine/COPYING.txt", "LICENSES_THIRD_PARTY.md",
  "licenses/chess.js-BSD-2-Clause.txt", "licenses/idb-ISC.txt", "licenses/lucide-react-ISC.txt",
  "licenses/react-MIT.txt", "licenses/react-dom-MIT.txt", "licenses/scheduler-MIT.txt",
]) requireFile(required);
if (fs.existsSync(path.join(root, "engine/stockfish-18-single.wasm")) || fs.existsSync(path.join(root, "engine/stockfish-18-single.js"))) {
  failures.push("Obsolete full Stockfish artifacts must not be included with the lite release build.");
}

for (const htmlName of [manifest.action?.default_popup, "review.html", "offscreen.html"].filter(Boolean)) {
  const html = fs.readFileSync(path.join(root, htmlName), "utf8");
  for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    if (/^(?:https?:)?\/\//i.test(match[1])) failures.push(`Remote script in ${htmlName}: ${match[1]}`);
    else requireFile(match[1].replace(/^\//, ""));
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Manifest validation PASS: MV3 structure, referenced files, local WASM/JS, CSP, permissions scope, and license artifacts verified.");
}
