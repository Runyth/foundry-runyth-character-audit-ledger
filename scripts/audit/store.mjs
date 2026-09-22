import {
  MODULE_ID,
  RECENT_ENTRY_ID_CACHE_SIZE,
  SETTINGS,
  STORAGE_ENTRIES_FLAG,
  STORAGE_FLAG_SCOPE,
  STORAGE_FOLDER_NAME
} from "../constants.mjs";
import { deepClone } from "../utils.mjs";
import { logger } from "../log.mjs";

export class AuditStore {
  #writeQueue = Promise.resolve();

  enqueue(task) {
    const run = this.#writeQueue.then(task, task);
    this.#writeQueue = run.catch((error) => logger.error("Serialized store operation failed.", error));
    return run;
  }

  async append(entry) {
    return this.enqueue(async () => {
      const actor = game.actors.get(entry.actorId);
      if (!actor) throw new Error(`Cannot persist audit entry for missing actor ${entry.actorId}.`);

      const index = deepClone(game.settings.get(MODULE_ID, SETTINGS.STORAGE_INDEX) ?? {});
      const record = await this.#ensureRecord(actor, index[entry.actorId]);
      const pageSize = game.settings.get(MODULE_ID, SETTINGS.PAGE_SIZE);
      let page = record.activePageId ? record.journal.pages.get(record.activePageId) : null;
      let entries = page?.getFlag(STORAGE_FLAG_SCOPE, STORAGE_ENTRIES_FLAG) ?? [];

      if (!page || entries.length >= pageSize) {
        page = await this.#createPage(record.journal);
        entries = [];
      }

      entries = [...entries, entry];
      await page.update({
        [`flags.${STORAGE_FLAG_SCOPE}.${STORAGE_ENTRIES_FLAG}`]: entries
      }, { render: false, diff: false });

      index[entry.actorId] = {
        journalId: record.journal.id,
        activePageId: page.id,
        activeCount: entries.length,
        entryCount: (record.entryCount ?? 0) + 1,
        recentEntryIds: [...new Set([...(record.recentEntryIds ?? []), entry.id])]
          .slice(-RECENT_ENTRY_ID_CACHE_SIZE),
        updatedAt: Date.now()
      };
      await game.settings.set(MODULE_ID, SETTINGS.STORAGE_INDEX, index);
      await this.#enforceRetention(entry.actorId, record.journal, index);
      return entry;
    });
  }

  async hasEntry(actorId, entryId) {
    const index = game.settings.get(MODULE_ID, SETTINGS.STORAGE_INDEX) ?? {};
    const record = index[actorId];
    if (!record) return false;
    if (Array.isArray(record.recentEntryIds)) return record.recentEntryIds.includes(entryId);
    return (await this.readActor(actorId)).some((entry) => entry.id === entryId);
  }

  async query(actorIds, filters = {}) {
    const uniqueActorIds = [...new Set(actorIds.filter(Boolean))];
    const entries = [];
    for (const actorId of uniqueActorIds) {
      entries.push(...await this.readActor(actorId));
    }
    return filterEntries(entries, filters);
  }

  async readActor(actorId) {
    const index = game.settings.get(MODULE_ID, SETTINGS.STORAGE_INDEX) ?? {};
    const journal = game.journal.get(index[actorId]?.journalId);
    if (!journal) return [];

    const pages = [...journal.pages.contents].sort((left, right) => left.sort - right.sort);
    return pages.flatMap((page) => page.getFlag(STORAGE_FLAG_SCOPE, STORAGE_ENTRIES_FLAG) ?? []);
  }

  async deleteActorLog(actorId) {
    return this.enqueue(async () => {
      const index = deepClone(game.settings.get(MODULE_ID, SETTINGS.STORAGE_INDEX) ?? {});
      const journalId = index[actorId]?.journalId;
      if (journalId) await JournalEntry.deleteDocuments([journalId]);
      delete index[actorId];
      await game.settings.set(MODULE_ID, SETTINGS.STORAGE_INDEX, index);
    });
  }

  async #ensureRecord(actor, current) {
    let journal = current?.journalId ? game.journal.get(current.journalId) : null;
    if (!journal) {
      const folder = await this.#ensureFolder();
      journal = await JournalEntry.create({
        name: `${actor.name} — ${actor.id}`,
        folder: folder.id,
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
        flags: {
          [STORAGE_FLAG_SCOPE]: {
            actorId: actor.id,
            managed: true
          }
        }
      }, { renderSheet: false });
    }
    return {
      journal,
      activePageId: current?.activePageId ?? null,
      entryCount: current?.entryCount ?? await this.#countEntries(journal),
      recentEntryIds: current?.recentEntryIds ?? []
    };
  }

  async #ensureFolder() {
    let folder = game.folders.find((candidate) => candidate.type === "JournalEntry" && candidate.name === STORAGE_FOLDER_NAME);
    if (!folder) {
      folder = await Folder.create({
        name: STORAGE_FOLDER_NAME,
        type: "JournalEntry",
        sorting: "a"
      });
    }
    return folder;
  }

  async #createPage(journal) {
    const highestSort = Math.max(0, ...journal.pages.map((page) => page.sort));
    const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [{
      name: `Audit ${String(journal.pages.size + 1).padStart(6, "0")}`,
      type: "text",
      sort: highestSort + 100000,
      text: {
        content: `<p>${game.i18n.localize("CAL.Storage.ManagedPage")}</p>`,
        format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML
      },
      flags: {
        [STORAGE_FLAG_SCOPE]: {
          [STORAGE_ENTRIES_FLAG]: []
        }
      }
    }], { render: false });
    return page;
  }

  async #countEntries(journal) {
    return journal.pages.reduce((count, page) => {
      return count + (page.getFlag(STORAGE_FLAG_SCOPE, STORAGE_ENTRIES_FLAG)?.length ?? 0);
    }, 0);
  }

  async #enforceRetention(actorId, journal, index) {
    const limit = game.settings.get(MODULE_ID, SETTINGS.RETENTION_LIMIT);
    let count = await this.#countEntries(journal);
    if (count <= limit) return;

    const pages = [...journal.pages.contents].sort((left, right) => left.sort - right.sort);
    for (const page of pages) {
      if (count <= limit) break;
      const pageEntries = page.getFlag(STORAGE_FLAG_SCOPE, STORAGE_ENTRIES_FLAG) ?? [];
      const excess = count - limit;
      if (pageEntries.length <= excess && page.id !== index[actorId]?.activePageId) {
        await journal.deleteEmbeddedDocuments("JournalEntryPage", [page.id], { render: false });
        count -= pageEntries.length;
        continue;
      }
      const retained = pageEntries.slice(Math.min(excess, pageEntries.length));
      await page.update({
        [`flags.${STORAGE_FLAG_SCOPE}.${STORAGE_ENTRIES_FLAG}`]: retained
      }, { render: false, diff: false });
      count -= pageEntries.length - retained.length;
    }

    index[actorId].entryCount = count;
    const activePage = journal.pages.get(index[actorId].activePageId);
    index[actorId].activeCount = activePage?.getFlag(STORAGE_FLAG_SCOPE, STORAGE_ENTRIES_FLAG)?.length ?? 0;
    await game.settings.set(MODULE_ID, SETTINGS.STORAGE_INDEX, index);
  }
}

export function filterEntries(entries, filters = {}) {
  const categories = new Set(filters.categories ?? []);
  const actorIds = new Set(filters.actorIds ?? []);
  const userIds = new Set(filters.userIds ?? []);
  const actions = new Set(filters.actions ?? []);
  const search = String(filters.search ?? "").trim().toLocaleLowerCase();
  const parsedFrom = filters.from ? new Date(filters.from).getTime() : Number.NEGATIVE_INFINITY;
  const parsedTo = filters.to ? new Date(filters.to).getTime() + 86_399_999 : Number.POSITIVE_INFINITY;
  const from = Number.isFinite(parsedFrom) ? parsedFrom : Number.NEGATIVE_INFINITY;
  const to = Number.isFinite(parsedTo) ? parsedTo : Number.POSITIVE_INFINITY;
  const offset = Math.max(0, Number.parseInt(filters.offset ?? 0, 10) || 0);
  const limit = Math.max(1, Number.parseInt(filters.limit ?? 250, 10) || 250);

  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .filter((entry) => !actorIds.size || actorIds.has(entry.actorId))
    .filter((entry) => !categories.size || categories.has(entry.category))
    .filter((entry) => !userIds.size || userIds.has(entry.userId))
    .filter((entry) => !actions.size || actions.has(entry.action))
    .filter((entry) => !filters.highlightedOnly || entry.highlighted)
    .filter((entry) => {
      const timestamp = Number(entry.timestamp);
      return Number.isFinite(timestamp) && timestamp >= from && timestamp <= to;
    })
    .filter((entry) => {
      if (!search) return true;
      const haystack = [
        entry.actorName,
        entry.userName,
        entry.documentName,
        entry.summary,
        entry.category,
        ...(Array.isArray(entry.changes) ? entry.changes : [])
          .map((change) => `${change?.path ?? ""} ${JSON.stringify(change?.before)} ${JSON.stringify(change?.after)}`)
      ].join(" ").toLocaleLowerCase();
      return haystack.includes(search);
    })
    .sort((left, right) => Number(right.timestamp) - Number(left.timestamp)
      || String(right.id ?? "").localeCompare(String(left.id ?? "")))
    .slice(offset, offset + limit);
}
