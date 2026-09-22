import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("dashboard keeps GM guard and idempotent render event binding", async () => {
  const source = await readFile(path.join(root, "scripts/ui/dashboard.mjs"), "utf8");
  assert.match(source, /if \(!game\.user\.isGM\) throw new Error/);
  assert.match(source, /if \(root\.dataset\.calBound === "true"\) return;/);
  assert.match(source, /root\.dataset\.calBound = "true";/);
  assert.match(source, /this\.render\(\{ parts: \["main"\] \}\)/);
});

test("Tidy 5e integration remains optional and default sheet hooks remain registered", async () => {
  const source = await readFile(path.join(root, "scripts/ui/sheet-tab.mjs"), "utf8");
  assert.match(source, /Hooks\.on\("renderActorSheetV2"/);
  assert.match(source, /Hooks\.on\("renderActorSheet"/);
  assert.match(source, /Hooks\.once\("tidy5e-sheet\.ready"/);
  assert.match(source, /game\.modules\.get\("tidy5e-sheet"\)\?\.api/);
  assert.match(source, /!api\?\.models\?\.HandlebarsTab/);
  assert.match(source, /api\.registerCharacterTab/);
});
