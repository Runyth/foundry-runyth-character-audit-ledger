import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const modules = walk(path.join(root, "scripts")).filter((file) => file.endsWith(".mjs"));
for (const file of modules) execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });

for (const file of ["module.json", "lang/en.json", "lang/de.json", "package.json"]) {
  JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

const manifest = JSON.parse(readFileSync(path.join(root, "module.json"), "utf8"));
for (const relative of [
  ...manifest.esmodules,
  ...manifest.styles,
  ...manifest.languages.map((language) => language.path),
  manifest.license
]) {
  const absolute = path.join(root, relative);
  if (!statSync(absolute).isFile()) throw new Error(`Manifest path is not a file: ${relative}`);
}

const tests = readdirSync(path.join(root, "tests"))
  .filter((file) => file.endsWith(".test.mjs"))
  .sort()
  .map((file) => path.join("tests", file));
execFileSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  stdio: "inherit"
});

console.log("Character Audit Ledger validation passed.");
