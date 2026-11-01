// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";

import { AuditStore } from "../scripts/audit/store.mjs";
import {
  MODULE_ID,
  SETTINGS,
  STORAGE_ENTRIES_FLAG,
  STORAGE_FLAG_SCOPE
} from "../scripts/constants.mjs";

class FakePages {
  contents = [];

  get size() {
    return this.contents.length;
  }

  get(id) {
    return this.contents.find((page) => page.id === id) ?? null;
  }

  map(callback) {
    return this.contents.map(callback);
  }

  reduce(callback, initial) {
    return this.contents.reduce(callback, initial);
  }
}

class FakePage {
  constructor(id, sort, entries = []) {
    this.id = id;
    this.sort = sort;
    this.entries = entries;
  }

  getFlag(scope, key) {
    assert.equal(scope, STORAGE_FLAG_SCOPE);
    assert.equal(key, STORAGE_ENTRIES_FLAG);
    return this.entries;
  }

  async update(data) {
    this.entries = data[`flags.${STORAGE_FLAG_SCOPE}.${STORAGE_ENTRIES_FLAG}`];
  }
}

class FakeJournal {
  constructor(id) {
    this.id = id;
    this.pages = new FakePages();
  }

  async createEmbeddedDocuments(_type, [data]) {
    const page = new FakePage(`page-${this.pages.size + 1}`, data.sort, []);
    this.pages.contents.push(page);
    return [page];
  }

  async deleteEmbeddedDocuments(_type, ids) {
    this.pages.contents = this.pages.contents.filter((page) => !ids.includes(page.id));
  }
}

function installFoundryFakes({ pageSize = 200, retention = 5000 } = {}) {
  const settings = new Map([
    [`${MODULE_ID}.${SETTINGS.STORAGE_INDEX}`, {}],
    [`${MODULE_ID}.${SETTINGS.PAGE_SIZE}`, pageSize],
    [`${MODULE_ID}.${SETTINGS.RETENTION_LIMIT}`, retention]
  ]);
  const actor = { id: "actor-1", name: "Hero" };
  const journals = new Map();
  let journalCounter = 0;

  globalThis.CONST = {
    DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0 },
    JOURNAL_ENTRY_PAGE_FORMATS: { HTML: 1 }
  };
  globalThis.game = {
    actors: new Map([[actor.id, actor]]),
    folders: [],
    journal: journals,
    i18n: { localize: (key) => key },
    settings: {
      get(scope, key) {
        return settings.get(`${scope}.${key}`);
      },
      async set(scope, key, value) {
        settings.set(`${scope}.${key}`, value);
        return value;
      }
    }
  };
  globalThis.Folder = {
    async create(data) {
      const folder = { id: "folder-1", ...data };
      game.folders.push(folder);
      return folder;
    }
  };
  globalThis.JournalEntry = {
    async create() {
      const journal = new FakeJournal(`journal-${++journalCounter}`);
      journals.set(journal.id, journal);
      return journal;
    },
    async deleteDocuments(ids) {
      for (const id of ids) journals.delete(id);
    }
  };

  return { actor, journals, settings };
}

function entry(id) {
  return {
    id,
    actorId: "actor-1",
    timestamp: Date.now(),
    changes: [{ path: "name", before: "A", after: "B" }]
  };
}

test("AuditStore reuses the active page until page size is reached", async () => {
  const { journals } = installFoundryFakes({ pageSize: 2 });
  const store = new AuditStore();
  await store.append(entry("entry-0001"));
  await store.append(entry("entry-0002"));

  const [journal] = journals.values();
  assert.equal(journal.pages.size, 1);
  assert.deepEqual(journal.pages.contents[0].entries.map((value) => value.id), ["entry-0001", "entry-0002"]);
});

test("AuditStore rotates pages and retains recent IDs", async () => {
  const { journals, settings } = installFoundryFakes({ pageSize: 1 });
  const store = new AuditStore();
  await store.append(entry("entry-0001"));
  await store.append(entry("entry-0002"));

  const [journal] = journals.values();
  assert.equal(journal.pages.size, 2);
  assert.equal(await store.hasEntry("actor-1", "entry-0002"), true);
  const index = settings.get(`${MODULE_ID}.${SETTINGS.STORAGE_INDEX}`);
  assert.deepEqual(index["actor-1"].recentEntryIds, ["entry-0001", "entry-0002"]);
});
