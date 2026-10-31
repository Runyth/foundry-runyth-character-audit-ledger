// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
export class AdapterRegistry {
  #adapters = new Map();

  register(adapter) {
    if (!adapter?.id || typeof adapter.register !== "function") {
      throw new TypeError("Adapters require an id and register(classifier) function.");
    }
    this.#adapters.set(adapter.id, adapter);
  }

  activate(systemId, classifier) {
    for (const adapter of this.#adapters.values()) {
      if (adapter.systemIds?.includes(systemId) || adapter.systemIds?.includes("*")) {
        adapter.register(classifier);
      }
    }
  }

  list() {
    return [...this.#adapters.keys()];
  }
}
