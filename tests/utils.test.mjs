// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";

import {
  entriesToCsv,
  entriesToJsonl,
  escapeCsv,
  mergeActorConfig,
  sanitizeValue
} from "../scripts/utils.mjs";

test("mergeActorConfig applies safe defaults and deduplicates readers", () => {
  assert.deepEqual(mergeActorConfig({
    tidySheetEnabled: true,
    fullAuditUserIds: ["u1", "u1", "", "u2"]
  }), {
    defaultSheetEnabled: false,
    tidySheetEnabled: true,
    fullAuditUserIds: ["u1", "u2"]
  });
});

test("sanitizeValue redacts secret paths and bounds recursion", () => {
  assert.equal(sanitizeValue("value", "flags.example.apiKey"), "[REDACTED]");
  const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
  assert.match(JSON.stringify(sanitizeValue(deep)), /TRUNCATED/);
});

test("CSV escaping mitigates formulas and preserves quotes", () => {
  assert.equal(escapeCsv("=HYPERLINK(\"x\")"), '"\'=HYPERLINK(""x"")"');
  assert.equal(escapeCsv("ordinary"), "ordinary");
});

test("CSV and JSONL exports contain stable fields", () => {
  const entry = {
    id: "entry0001",
    timestamp: 1,
    recordedAt: 2,
    actorId: "a1",
    actorName: "Hero",
    userId: "u1",
    userName: "Player",
    action: "update",
    category: "currency",
    highlighted: true,
    documentType: "Actor",
    documentId: "a1",
    documentName: "Hero",
    summary: "Updated",
    changes: [{ path: "system.currency.gp", before: 1, after: 2 }]
  };
  assert.match(entriesToCsv([entry]), /^id,timestamp,recordedAt,/);
  assert.deepEqual(JSON.parse(entriesToJsonl([entry])), entry);
});
