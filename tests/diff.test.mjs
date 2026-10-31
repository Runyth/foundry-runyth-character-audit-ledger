// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";

import { buildChanges } from "../scripts/audit/diff.mjs";

test("buildChanges records only submitted paths", () => {
  const before = { name: "Old", system: { currency: { gp: 2 }, hp: 10 } };
  const after = { name: "New", system: { currency: { gp: 5 }, hp: 10 } };
  assert.deepEqual(buildChanges(before, after, {
    name: "New",
    system: { currency: { gp: 5 } }
  }), [
    { path: "name", before: "Old", after: "New" },
    { path: "system.currency.gp", before: 2, after: 5 }
  ]);
});

test("buildChanges handles deletion syntax", () => {
  const changes = buildChanges(
    { system: { temporary: "value" } },
    { system: {} },
    { system: { "-=temporary": null } }
  );
  assert.deepEqual(changes, [{ path: "system.temporary", before: "value", after: null }]);
});

test("buildChanges redacts sensitive values", () => {
  const [change] = buildChanges(
    { flags: { integration: { accessToken: "old" } } },
    { flags: { integration: { accessToken: "new" } } },
    { flags: { integration: { accessToken: "new" } } }
  );
  assert.equal(change.before, "[REDACTED]");
  assert.equal(change.after, "[REDACTED]");
});
