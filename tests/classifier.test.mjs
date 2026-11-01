// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";

import { AuditClassifier } from "../scripts/audit/classifier.mjs";
import { dnd5eAdapter } from "../scripts/adapters/dnd5e.mjs";
import { CATEGORIES } from "../scripts/constants.mjs";

function classify(classifier, documentType, action, paths) {
  return classifier.classify({
    documentType,
    action,
    systemId: "test",
    changes: paths.map((path) => ({ path, before: 1, after: 2 }))
  });
}

test("generic classifier recognizes important semantic categories", () => {
  const classifier = new AuditClassifier();
  assert.equal(classify(classifier, "Actor", "update", ["system.money.gold"]), CATEGORIES.CURRENCY);
  assert.equal(classify(classifier, "Item", "update", ["system.quantity"]), CATEGORIES.ITEM_QUANTITY);
  assert.equal(classify(classifier, "Item", "create", ["item"]), CATEGORIES.ITEM);
  assert.equal(classify(classifier, "Actor", "update", ["ownership.user1"]), CATEGORIES.OWNERSHIP);
  assert.equal(classify(classifier, "Actor", "update", ["system.attributes.hp.value"]), CATEGORIES.ATTRIBUTE);
});

test("dnd5e adapter registers exact high-priority paths", () => {
  const classifier = new AuditClassifier();
  dnd5eAdapter.register(classifier);
  assert.equal(classify(classifier, "Actor", "update", ["system.currency.gp"]), CATEGORIES.CURRENCY);
  assert.equal(classify(classifier, "Item", "update", ["system.uses.spent"]), CATEGORIES.ITEM_QUANTITY);
});
