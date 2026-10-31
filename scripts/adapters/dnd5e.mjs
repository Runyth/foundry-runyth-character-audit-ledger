// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { CATEGORIES } from "../constants.mjs";

export const dnd5eAdapter = Object.freeze({
  id: "dnd5e",
  systemIds: ["dnd5e"],
  register(classifier) {
    classifier.registerRule({
      id: "dnd5e-currency",
      priority: 200,
      category: CATEGORIES.CURRENCY,
      test: ({ paths }) => paths.some((path) => path.startsWith("system.currency."))
    });
    classifier.registerRule({
      id: "dnd5e-item-quantity",
      priority: 190,
      category: CATEGORIES.ITEM_QUANTITY,
      test: ({ documentType, paths }) => documentType === "Item"
        && paths.some((path) => path === "system.quantity" || path.startsWith("system.uses."))
    });
  }
});
