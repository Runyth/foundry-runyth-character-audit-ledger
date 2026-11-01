// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const voidElements = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr"
]);

/**
 * Conservatively inspect an HBS/HTML template without requiring Foundry or a DOM.
 * Any Handlebars branch at depth 0 could change the number of rendered part roots,
 * so the test rejects it in addition to counting static top-level elements.
 */
function analyzeTemplateRoots(template) {
  const tokenPattern = /<!--[\s\S]*?-->|{{[\s\S]*?}}|<\/?[A-Za-z][^>]*>/g;
  const stack = [];
  const outside = [];
  let roots = 0;
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(template)) !== null) {
    const text = template.slice(cursor, match.index);
    if (stack.length === 0 && text.trim()) outside.push({ type: "text", value: text.trim() });

    const token = match[0];
    if (token.startsWith("<!--")) {
      if (stack.length === 0) outside.push({ type: "comment", value: token });
    } else if (token.startsWith("{{")) {
      if (stack.length === 0) outside.push({ type: "handlebars", value: token });
    } else if (token.startsWith("</")) {
      const name = token.match(/^<\/\s*([A-Za-z][\w:-]*)/)?.[1]?.toLowerCase();
      assert.ok(name, `Could not parse closing tag: ${token}`);
      assert.equal(stack.at(-1), name, `Mismatched closing tag: ${token}`);
      stack.pop();
    } else {
      const name = token.match(/^<\s*([A-Za-z][\w:-]*)/)?.[1]?.toLowerCase();
      assert.ok(name, `Could not parse opening tag: ${token}`);
      if (stack.length === 0) roots += 1;
      if (!voidElements.has(name) && !/\/\s*>$/.test(token)) stack.push(name);
    }
    cursor = tokenPattern.lastIndex;
  }

  const trailing = template.slice(cursor);
  if (stack.length === 0 && trailing.trim()) outside.push({ type: "text", value: trailing.trim() });
  assert.deepEqual(stack, [], "Template must have balanced HTML tags");
  return { roots, outside };
}

test("AuditDashboard declares one ApplicationV2 Handlebars part", async () => {
  const source = await readFile(path.join(root, "scripts/ui/dashboard.mjs"), "utf8");
  const parts = source.match(/static PARTS = \{([\s\S]*?)\n  \};/)?.[1] ?? "";

  assert.match(parts, /\bmain\s*:\s*\{/);
  assert.match(parts, /templates\/dashboard\.hbs/);
  assert.equal((parts.match(/\btemplate\s*:/g) ?? []).length, 1);
});

test("dashboard main part is structurally single-root for every Handlebars branch", async () => {
  const template = await readFile(path.join(root, "templates/dashboard.hbs"), "utf8");
  const analysis = analyzeTemplateRoots(template);

  assert.equal(analysis.roots, 1, "ApplicationV2 part must render exactly one top-level HTMLElement");
  assert.deepEqual(
    analysis.outside,
    [],
    "No text, comments, or Handlebars helpers may exist outside the single part root"
  );
  assert.match(template, /^<div class="cal-dashboard__layout">/);
  assert.match(template.trimEnd(), /<\/div>$/);
});

test("readers dialog remains inside the dashboard main part root", async () => {
  const template = await readFile(path.join(root, "templates/dashboard.hbs"), "utf8");
  const dialogIndex = template.indexOf('<dialog class="cal-readers-dialog"');
  const finalRootClose = template.lastIndexOf("</div>");

  assert.ok(dialogIndex > 0, "Readers dialog must exist");
  assert.ok(dialogIndex < finalRootClose, "Readers dialog must be nested inside the single root element");
});
