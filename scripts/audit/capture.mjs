// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import {
  ACTIONS,
  MODULE_ID,
  SETTINGS
} from "../constants.mjs";
import {
  actorStorageId,
  deepClone,
  isAuditedActor,
  randomId
} from "../utils.mjs";
import {
  buildChanges,
  summarizeCreate,
  summarizeDelete
} from "./diff.mjs";
import { logger } from "../log.mjs";

export class AuditCapture {
  #service;
  #classifier;
  #snapshots = new Map();

  constructor({ service, classifier }) {
    this.#service = service;
    this.#classifier = classifier;
  }

  activate() {
    this.#registerUpdateHooks("Actor");
    this.#registerUpdateHooks("Item");
    this.#registerCreateDeleteHooks("Item");
    this.#registerUpdateHooks("ActiveEffect");
    this.#registerCreateDeleteHooks("ActiveEffect");
  }

  #registerUpdateHooks(documentName) {
    Hooks.on(`preUpdate${documentName}`, (document, changes, options) => {
      if (!this.#shouldCapture(document)) return;
      const correlationId = randomId(24);
      options[MODULE_ID] = { correlationId };
      this.#snapshots.set(correlationId, {
        before: deepClone(document.toObject(false)),
        submitted: deepClone(changes),
        createdAt: Date.now()
      });
      this.#pruneSnapshots();
    });

    Hooks.on(`update${documentName}`, (document, changes, options, userId) => {
      if (userId !== game.user.id) return;
      const correlationId = options?.[MODULE_ID]?.correlationId;
      const snapshot = correlationId ? this.#snapshots.get(correlationId) : null;
      if (!snapshot && !this.#shouldCapture(document)) return;
      if (correlationId) this.#snapshots.delete(correlationId);
      const auditChanges = buildChanges(snapshot?.before ?? {}, document.toObject(false), snapshot?.submitted ?? changes);
      if (!auditChanges.length) return;
      this.#submit(document, ACTIONS.UPDATE, auditChanges).catch((error) => {
        logger.error(`Failed to capture ${documentName} update.`, error);
      });
    });
  }

  #registerCreateDeleteHooks(documentName) {
    Hooks.on(`create${documentName}`, (document, _options, userId) => {
      if (userId !== game.user.id || !this.#shouldCapture(document)) return;
      this.#submit(document, ACTIONS.CREATE, summarizeCreate(document)).catch((error) => {
        logger.error(`Failed to capture ${documentName} creation.`, error);
      });
    });

    Hooks.on(`delete${documentName}`, (document, _options, userId) => {
      if (userId !== game.user.id || !this.#shouldCapture(document)) return;
      this.#submit(document, ACTIONS.DELETE, summarizeDelete(document)).catch((error) => {
        logger.error(`Failed to capture ${documentName} deletion.`, error);
      });
    });
  }

  #shouldCapture(document) {
    if (!document) return false;
    if (document.documentName === "ActiveEffect"
      && !game.settings.get(MODULE_ID, SETTINGS.CAPTURE_ACTIVE_EFFECTS)) return false;
    return isAuditedActor(this.#resolveActor(document));
  }

  #resolveActor(document) {
    if (document.documentName === "Actor") return document;
    if (document.parent?.documentName === "Actor") return document.parent;
    if (document.parent?.parent?.documentName === "Actor") return document.parent.parent;
    return null;
  }

  async #submit(document, action, changes) {
    const actor = this.#resolveActor(document);
    const actorId = actorStorageId(actor);
    if (!actorId) return;
    const category = this.#classifier.classify({
      action,
      documentType: document.documentName,
      changes,
      systemId: game.system.id
    });
    const highlightRules = game.settings.get(MODULE_ID, SETTINGS.HIGHLIGHT_RULES);
    const summary = makeSummary(document, action, changes);
    await this.#service.submit({
      id: randomId(24),
      timestamp: Date.now(),
      actorId,
      actorUuid: actor.uuid,
      actorName: actor.name,
      userId: game.user.id,
      userName: game.user.name,
      action,
      category,
      highlighted: this.#classifier.isHighlighted(category, highlightRules),
      documentType: document.documentName,
      documentId: document.id,
      documentName: document.name ?? actor.name,
      summary,
      systemId: game.system.id,
      changes
    });
  }

  #pruneSnapshots() {
    const cutoff = Date.now() - 60_000;
    for (const [key, value] of this.#snapshots) {
      if (value.createdAt < cutoff) this.#snapshots.delete(key);
    }
  }
}

function makeSummary(document, action, changes) {
  const label = document.name ?? document.documentName;
  if (action === ACTIONS.CREATE) return `Created ${document.documentName}: ${label}`;
  if (action === ACTIONS.DELETE) return `Deleted ${document.documentName}: ${label}`;
  const paths = changes.slice(0, 3).map((change) => change.path).join(", ");
  return `Updated ${document.documentName}: ${label}${paths ? ` (${paths})` : ""}`;
}
