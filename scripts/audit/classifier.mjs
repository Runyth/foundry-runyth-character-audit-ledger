// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { ACTIONS, CATEGORIES, DEFAULT_HIGHLIGHT_RULES } from "../constants.mjs";

const CURRENCY_SEGMENTS = new Set([
  "currency", "money", "coin", "coins", "gold", "silver", "copper", "platinum",
  "electrum", "gp", "sp", "cp", "pp", "ep", "credits", "credit", "wealth"
]);
const QUANTITY_SEGMENTS = new Set(["quantity", "amount", "count", "charges", "uses"]);
const IDENTITY_PATHS = new Set(["name", "img", "type"]);

export class AuditClassifier {
  #rules = [];

  constructor() {
    this.registerRule({
      id: "embedded-active-effect",
      priority: 100,
      test: (context) => context.documentType === "ActiveEffect",
      category: CATEGORIES.ACTIVE_EFFECT
    });
    this.registerRule({
      id: "embedded-item-create-delete",
      priority: 95,
      test: (context) => context.documentType === "Item" && context.action !== ACTIONS.UPDATE,
      category: CATEGORIES.ITEM
    });
    this.registerRule({
      id: "item-quantity",
      priority: 90,
      test: (context) => context.documentType === "Item" && context.paths.some(hasQuantitySegment),
      category: CATEGORIES.ITEM_QUANTITY
    });
    this.registerRule({
      id: "currency",
      priority: 85,
      test: (context) => context.paths.some(hasCurrencySegment),
      category: CATEGORIES.CURRENCY
    });
    this.registerRule({
      id: "ownership",
      priority: 80,
      test: (context) => context.paths.some((path) => path === "ownership" || path.startsWith("ownership.")),
      category: CATEGORIES.OWNERSHIP
    });
    this.registerRule({
      id: "identity",
      priority: 70,
      test: (context) => context.paths.some((path) => IDENTITY_PATHS.has(path)),
      category: CATEGORIES.IDENTITY
    });
    this.registerRule({
      id: "token",
      priority: 60,
      test: (context) => context.paths.some((path) => path.startsWith("prototypeToken.")),
      category: CATEGORIES.TOKEN
    });
    this.registerRule({
      id: "attribute",
      priority: 50,
      test: (context) => context.paths.some((path) => path.startsWith("system.")),
      category: CATEGORIES.ATTRIBUTE
    });
  }

  registerRule(rule) {
    if (!rule?.id || typeof rule.test !== "function" || !rule.category) {
      throw new TypeError("Audit classifier rules require id, test, and category.");
    }
    this.#rules = [...this.#rules.filter((existing) => existing.id !== rule.id), rule]
      .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
    return () => {
      this.#rules = this.#rules.filter((existing) => existing.id !== rule.id);
    };
  }

  classify({ action, documentType, changes, systemId }) {
    const context = {
      action,
      documentType,
      changes,
      paths: changes.map((change) => change.path),
      systemId
    };
    return this.#rules.find((rule) => rule.test(context))?.category ?? CATEGORIES.OTHER;
  }

  isHighlighted(category, highlightRules = DEFAULT_HIGHLIGHT_RULES) {
    return Boolean(highlightRules?.[category]);
  }
}

function pathSegments(path) {
  return String(path).toLowerCase().split(/[.[\]]+/).filter(Boolean);
}

function hasCurrencySegment(path) {
  return pathSegments(path).some((segment) => CURRENCY_SEGMENTS.has(segment));
}

function hasQuantitySegment(path) {
  return pathSegments(path).some((segment) => QUANTITY_SEGMENTS.has(segment));
}
