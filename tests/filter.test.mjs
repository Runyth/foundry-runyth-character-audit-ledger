import test from "node:test";
import assert from "node:assert/strict";

import { filterEntries } from "../scripts/audit/store.mjs";

const entries = [
  {
    id: "b",
    timestamp: Date.parse("2026-08-05T12:00:00Z"),
    actorId: "a1",
    actorName: "Hero",
    userId: "u1",
    userName: "Alice",
    action: "update",
    category: "currency",
    highlighted: true,
    documentName: "Hero",
    summary: "currency",
    changes: [{ path: "system.currency.gp", before: 1, after: 2 }]
  },
  {
    id: "a",
    timestamp: Date.parse("2026-08-04T12:00:00Z"),
    actorId: "a2",
    actorName: "Mage",
    userId: "u2",
    userName: "Bob",
    action: "create",
    category: "item",
    highlighted: false,
    documentName: "Wand",
    summary: "item",
    changes: [{ path: "item", before: null, after: { name: "Wand" } }]
  }
];

test("filterEntries combines category, user, and highlight filters", () => {
  assert.deepEqual(filterEntries(entries, {
    categories: ["currency"],
    userIds: ["u1"],
    highlightedOnly: true,
    limit: 10
  }).map((entry) => entry.id), ["b"]);
});

test("filterEntries searches change paths and sorts newest first", () => {
  assert.deepEqual(filterEntries(entries, { search: "wand", limit: 10 }).map((entry) => entry.id), ["a"]);
  assert.deepEqual(filterEntries(entries, { limit: 10 }).map((entry) => entry.id), ["b", "a"]);
});

test("filterEntries ignores invalid date strings safely", () => {
  assert.equal(filterEntries(entries, { from: "invalid", to: "invalid", limit: 10 }).length, 2);
});


test("filterEntries handles empty, singleton, many, and zero-result states", () => {
  assert.deepEqual(filterEntries([], { limit: 10 }), []);
  assert.deepEqual(filterEntries([entries[0]], { limit: 10 }).map((entry) => entry.id), ["b"]);

  const many = Array.from({ length: 50 }, (_, index) => ({
    ...entries[0],
    id: `entry-${String(index).padStart(3, "0")}`,
    timestamp: entries[0].timestamp + index
  }));
  assert.equal(filterEntries(many, { limit: 100 }).length, 50);
  assert.deepEqual(filterEntries(many, { search: "does-not-exist", limit: 100 }), []);
  assert.equal(filterEntries(many, { search: "currency", limit: 100 }).length, 50);
});

test("filterEntries skips malformed records without mutating readable legacy records", () => {
  const legacy = {
    id: "legacy-1",
    timestamp: String(entries[1].timestamp),
    actorId: "a2",
    actorName: "Mage",
    userId: "u2",
    userName: "Bob",
    action: "update",
    category: "other",
    documentName: "Legacy",
    changes: null
  };
  const snapshot = structuredClone(legacy);
  const result = filterEntries([null, undefined, "broken", [], legacy], { limit: 10 });

  assert.deepEqual(result.map((entry) => entry.id), ["legacy-1"]);
  assert.deepEqual(legacy, snapshot);
});
