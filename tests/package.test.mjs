// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function leafKeys(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, entry]) => leafKeys(entry, prefix ? `${prefix}.${key}` : key));
}

test("manifest points only to existing runtime files", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
  assert.equal(manifest.id, "runyth-character-audit-ledger");
  assert.equal(manifest.version, "1.0.3");
  assert.equal(manifest.compatibility.verified, "13.351");
  for (const relative of [
    ...manifest.esmodules,
    ...manifest.styles,
    ...manifest.languages.map((language) => language.path),
    manifest.license
  ]) await access(path.join(root, relative));
});

test("English and German localization trees have identical leaves", async () => {
  const en = JSON.parse(await readFile(path.join(root, "lang/en.json"), "utf8"));
  const de = JSON.parse(await readFile(path.join(root, "lang/de.json"), "utf8"));
  assert.deepEqual(leafKeys(en).sort(), leafKeys(de).sort());
});

test("runtime avoids private wrappers and legacy application bases", async () => {
  const files = [
    "scripts/main.mjs",
    "scripts/ui/dashboard.mjs",
    "scripts/ui/sheet-tab.mjs"
  ];
  const source = (await Promise.all(files.map((file) => readFile(path.join(root, file), "utf8")))).join("\n");
  assert.doesNotMatch(source, /libWrapper|FormApplication|extends\s+Application\b|\.prototype\./);
  assert.match(source, /ApplicationV2/);
});
