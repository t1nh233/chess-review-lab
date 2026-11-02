/* Builds the Edge Add-ons upload package: release/chess-review-lab-<version>.zip from a validated dist/. */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const dist = path.resolve("dist");
const manifestPath = path.join(dist, "manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error("dist/ is missing. Run npm run build first.");
const version = JSON.parse(fs.readFileSync(manifestPath, "utf8")).version;
const maxMb = Number(process.env.STORE_MAX_MB || 50);

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full); else files.push(full);
  }
})(dist);
const forbidden = files.filter((file) => /\.(map|ts|tsx)$/.test(file) || /(^|[\\/])\.env/.test(file));
if (forbidden.length) throw new Error(`Forbidden files in dist:\n${forbidden.join("\n")}`);

fs.mkdirSync("release", { recursive: true });
const out = path.resolve("release", `chess-review-lab-${version}.zip`);
fs.rmSync(out, { force: true });
// bsdtar (built into Windows 10+/macOS) writes a standard zip with forward-slash entry names.
const tarBin = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:/Windows", "System32", "tar.exe") : "tar";
execFileSync(tarBin, ["-a", "-c", "-f", out, "-C", dist, ...fs.readdirSync(dist)], { stdio: "inherit" });
const sizeMb = fs.statSync(out).size / 1048576;
if (sizeMb > maxMb) throw new Error(`Package is ${sizeMb.toFixed(1)} MB, above the ${maxMb} MB budget.`);
console.log(`Store package ready: ${out} (${sizeMb.toFixed(2)} MB, ${files.length} files)`);
