import {
  ACTIONS,
  CATEGORIES,
  DEFAULT_HIGHLIGHT_RULES,
  MODULE_ID,
  SETTINGS
} from "../constants.mjs";
import {
  clampQueryLimit,
  getActorConfig,
  isPrimaryGM,
  mergeActorConfig,
  sanitizeValue
} from "../utils.mjs";
import { filterEntries } from "./store.mjs";

const ALLOWED_ACTIONS = new Set(Object.values(ACTIONS));
const ALLOWED_DOCUMENT_TYPES = new Set(["Actor", "Item", "ActiveEffect"]);
const ENTRY_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export class AuditService {
  constructor({ store, classifier }) {
    this.store = store;
    this.classifier = classifier;
    this.socket = null;
  }

  setSocket(socket) {
    this.socket = socket;
  }

  isPrimaryGM() {
    return isPrimaryGM();
  }

  async submit(entry) {
    return this.socket.submit(this.#normalizeEntry(entry));
  }

  async persistValidated(entry, senderUserId) {
    const normalized = this.#normalizeEntry(entry);
    const actor = game.actors.get(normalized.actorId);
    const sender = game.users.get(senderUserId);
    if (!actor || !sender) throw new Error("Audit append rejected: actor or user does not exist.");
    if (!sender.isGM && !actor.testUserPermission(sender, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
      throw new Error("Audit append rejected: user does not own the actor.");
    }
    if (normalized.userId !== senderUserId) {
      throw new Error("Audit append rejected: origin user mismatch.");
    }
    if (!ENTRY_ID_PATTERN.test(normalized.id)) {
      throw new Error("Audit append rejected: invalid entry identifier.");
    }
    if (!ALLOWED_ACTIONS.has(normalized.action) || !ALLOWED_DOCUMENT_TYPES.has(normalized.documentType)) {
      throw new Error("Audit append rejected: unsupported action or document type.");
    }
    if (!normalized.changes.length) throw new Error("Audit append rejected: no changes were supplied.");
    if (await this.store.hasEntry(normalized.actorId, normalized.id)) return normalized;

    normalized.recordedAt = Date.now();
    normalized.timestamp = Math.min(normalized.timestamp, normalized.recordedAt + 300_000);
    normalized.userName = sender.name;
    normalized.actorName = actor.name;
    normalized.actorUuid = actor.uuid;
    normalized.systemId = game.system.id;
    normalized.category = this.classifier.classify(normalized);
    normalized.highlighted = this.classifier.isHighlighted(
      normalized.category,
      game.settings.get(MODULE_ID, SETTINGS.HIGHLIGHT_RULES)
    );
    normalized.summary = makeStableSummary(normalized);
    return this.store.append(normalized);
  }

  async queryLocal(actorIds, filters = {}) {
    const entries = [];
    for (const actorId of [...new Set(actorIds)]) entries.push(...await this.store.readActor(actorId));
    const highlighted = entries.map((entry) => this.#withCurrentHighlight(entry));
    return filterEntries(highlighted, {
      ...filters,
      limit: clampQueryLimit(filters.limit)
    });
  }

  async queryAllLocal(actorIds, filters = {}) {
    const entries = [];
    for (const actorId of [...new Set(actorIds)]) entries.push(...await this.store.readActor(actorId));
    const highlighted = entries.map((entry) => this.#withCurrentHighlight(entry));
    return filterEntries(highlighted, {
      ...filters,
      limit: Number.MAX_SAFE_INTEGER
    });
  }

  async queryForUser(actorId, userId, filters = {}) {
    const actor = game.actors.get(actorId);
    const user = game.users.get(userId);
    if (!actor || !user) return [];
    if (!user.isGM && !actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) return [];

    const config = getActorConfig(actorId);
    const canReadAll = user.isGM || config.fullAuditUserIds.includes(userId);
    return this.queryLocal([actorId], {
      ...filters,
      userIds: canReadAll ? filters.userIds : [userId],
      limit: Math.min(clampQueryLimit(filters.limit), 500)
    });
  }

  async requestSheetEntries(actorId, filters = {}) {
    return this.socket.requestEntries(actorId, { ...filters, limit: Math.min(filters.limit ?? 250, 500) });
  }

  async saveActorConfigs(configs) {
    if (!game.user.isGM) throw new Error("Only a GM can update audit configuration.");
    const current = game.settings.get(MODULE_ID, SETTINGS.ACTOR_CONFIG) ?? {};
    const next = { ...current };
    for (const [actorId, config] of Object.entries(configs)) {
      const actor = game.actors.get(actorId);
      if (!actor) continue;
      const merged = mergeActorConfig(config);
      merged.fullAuditUserIds = merged.fullAuditUserIds.filter((userId) => {
        const user = game.users.get(userId);
        return user && !user.isGM
          && actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
      });
      next[actorId] = merged;
    }
    await game.settings.set(MODULE_ID, SETTINGS.ACTOR_CONFIG, next);
    Hooks.callAll(`${MODULE_ID}.configChanged`, next);
  }

  async saveHighlightRules(rules) {
    if (!game.user.isGM) throw new Error("Only a GM can update highlighting rules.");
    const next = Object.fromEntries(Object.values(CATEGORIES).map((category) => [
      category,
      Boolean(rules?.[category] ?? DEFAULT_HIGHLIGHT_RULES[category])
    ]));
    await game.settings.set(MODULE_ID, SETTINGS.HIGHLIGHT_RULES, next);
    Hooks.callAll(`${MODULE_ID}.highlightRulesChanged`, next);
  }

  #withCurrentHighlight(entry) {
    const rules = game.settings.get(MODULE_ID, SETTINGS.HIGHLIGHT_RULES) ?? DEFAULT_HIGHLIGHT_RULES;
    return {
      ...entry,
      highlighted: this.classifier.isHighlighted(entry.category, rules)
    };
  }

  #normalizeEntry(entry) {
    const occurredAt = Number(entry?.timestamp ?? Date.now());
    return {
      id: String(entry?.id ?? "").slice(0, 64),
      timestamp: Number.isFinite(occurredAt) && occurredAt >= 0 ? occurredAt : Date.now(),
      recordedAt: Number(entry?.recordedAt ?? 0),
      actorId: String(entry?.actorId ?? "").slice(0, 128),
      actorUuid: "",
      actorName: "",
      userId: String(entry?.userId ?? "").slice(0, 128),
      userName: "",
      action: String(entry?.action ?? ACTIONS.UPDATE),
      category: CATEGORIES.OTHER,
      highlighted: false,
      documentType: String(entry?.documentType ?? "Actor"),
      documentId: String(entry?.documentId ?? "").slice(0, 128),
      documentName: String(entry?.documentName ?? "").slice(0, 500),
      summary: "",
      systemId: "",
      changes: Array.isArray(entry?.changes)
        ? entry.changes.slice(0, 250).map((change) => ({
          path: String(change.path ?? "").slice(0, 500),
          before: sanitizeValue(change.before, change.path),
          after: sanitizeValue(change.after, change.path)
        })).filter((change) => change.path)
        : []
    };
  }
}

function makeStableSummary(entry) {
  const paths = entry.changes.slice(0, 3).map((change) => change.path).join(",");
  return [entry.action, entry.documentType, entry.documentName, paths].join(":").slice(0, 1000);
}
