// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import {
  MAX_PENDING_ENTRIES,
  MODULE_ID,
  SETTINGS,
  SOCKET_CHANNEL
} from "../constants.mjs";
import {
  actorStorageId,
  getPrimaryGM,
  randomId
} from "../utils.mjs";
import { logger } from "../log.mjs";

export class AuditSocket {
  #service;
  #pendingRequests = new Map();
  #flushTimer = null;
  #lastNoGmWarningAt = 0;

  constructor(service) {
    this.#service = service;
  }

  activate() {
    const flush = () => this.flushPending().catch((error) => {
      logger.error("Failed to flush queued audit entries.", error);
    });
    game.socket.on(SOCKET_CHANNEL, (message) => this.#onMessage(message));
    this.#flushTimer = globalThis.setInterval(flush, 30_000);
    flush();
    Hooks.on("updateUser", flush);
  }

  destroy() {
    if (this.#flushTimer) globalThis.clearInterval(this.#flushTimer);
  }

  async submit(entry) {
    const primaryGm = getPrimaryGM();
    if (!primaryGm) {
      await this.#queuePending(entry);
      if (Date.now() - this.#lastNoGmWarningAt > 60_000) {
        this.#lastNoGmWarningAt = Date.now();
        ui.notifications.warn(game.i18n.localize("CAL.Notifications.QueuedWithoutGM"));
      }
      return;
    }
    if (primaryGm.id === game.user.id) {
      await this.#service.persistValidated(entry, game.user.id);
      return;
    }
    await this.#queuePending(entry);
    game.socket.emit(SOCKET_CHANNEL, {
      type: "append",
      senderUserId: game.user.id,
      targetUserId: primaryGm.id,
      entry
    });
  }

  requestEntries(actorId, filters = {}) {
    if (game.user.isGM) return this.#service.queryLocal([actorId], filters);
    const primaryGm = getPrimaryGM();
    if (!primaryGm) return Promise.resolve([]);

    const requestId = randomId(24);
    return new Promise((resolve) => {
      const timeout = globalThis.setTimeout(() => {
        this.#pendingRequests.delete(requestId);
        resolve([]);
      }, 10_000);
      this.#pendingRequests.set(requestId, { resolve, timeout });
      game.socket.emit(SOCKET_CHANNEL, {
        type: "query",
        requestId,
        senderUserId: game.user.id,
        targetUserId: primaryGm.id,
        actorId,
        filters
      });
    });
  }

  async flushPending() {
    const primaryGm = getPrimaryGM();
    if (!primaryGm) return;
    const pending = game.settings.get(MODULE_ID, SETTINGS.PENDING_QUEUE)?.entries ?? [];
    if (!pending.length) return;

    if (primaryGm.id === game.user.id) {
      for (const entry of pending) await this.#service.persistValidated(entry, game.user.id);
      await game.settings.set(MODULE_ID, SETTINGS.PENDING_QUEUE, { entries: [] });
      return;
    }

    game.socket.emit(SOCKET_CHANNEL, {
      type: "appendBatch",
      senderUserId: game.user.id,
      targetUserId: primaryGm.id,
      entries: pending
    });
  }

  async #onMessage(message) {
    if (!message || message.targetUserId !== game.user.id) return;

    if (message.type === "response") {
      const pending = this.#pendingRequests.get(message.requestId);
      if (!pending) return;
      globalThis.clearTimeout(pending.timeout);
      this.#pendingRequests.delete(message.requestId);
      pending.resolve(message.entries ?? []);
      return;
    }

    if (message.type === "ack") {
      await this.#removeAcknowledged([
        ...(message.entryIds ?? []),
        ...(message.rejectedEntryIds ?? [])
      ]);
      if (message.rejectedEntryIds?.length) {
        ui.notifications.warn(game.i18n.format("CAL.Notifications.RejectedEntries", {
          count: message.rejectedEntryIds.length
        }));
      }
      return;
    }

    if (!this.#service.isPrimaryGM()) return;

    try {
      if (message.type === "append") {
        try {
          await this.#service.persistValidated(message.entry, message.senderUserId);
          this.#sendAcknowledgement(message.senderUserId, [message.entry?.id]);
        } catch (error) {
          logger.error("Rejected an audit append request.", error);
          this.#sendAcknowledgement(message.senderUserId, [], [message.entry?.id]);
        }
      } else if (message.type === "appendBatch") {
        const accepted = [];
        const rejected = [];
        for (const entry of message.entries ?? []) {
          try {
            await this.#service.persistValidated(entry, message.senderUserId);
            accepted.push(entry.id);
          } catch (error) {
            rejected.push(entry?.id);
            logger.error("Rejected an entry from an audit append batch.", error);
          }
        }
        this.#sendAcknowledgement(message.senderUserId, accepted, rejected);
      } else if (message.type === "query") {
        const entries = await this.#service.queryForUser(
          message.actorId,
          message.senderUserId,
          message.filters
        );
        game.socket.emit(SOCKET_CHANNEL, {
          type: "response",
          requestId: message.requestId,
          targetUserId: message.senderUserId,
          entries
        });
      }
    } catch (error) {
      logger.error("Socket request failed.", error, message);
    }
  }

  #sendAcknowledgement(targetUserId, entryIds, rejectedEntryIds = []) {
    game.socket.emit(SOCKET_CHANNEL, {
      type: "ack",
      targetUserId,
      entryIds: entryIds.filter(Boolean),
      rejectedEntryIds: rejectedEntryIds.filter(Boolean)
    });
  }

  async #queuePending(entry) {
    const current = game.settings.get(MODULE_ID, SETTINGS.PENDING_QUEUE)?.entries ?? [];
    const entries = [...current.filter((candidate) => candidate.id !== entry.id), entry]
      .slice(-MAX_PENDING_ENTRIES);
    await game.settings.set(MODULE_ID, SETTINGS.PENDING_QUEUE, { entries });
  }

  async #removeAcknowledged(entryIds) {
    const ids = new Set(entryIds);
    if (!ids.size) return;
    const current = game.settings.get(MODULE_ID, SETTINGS.PENDING_QUEUE)?.entries ?? [];
    await game.settings.set(MODULE_ID, SETTINGS.PENDING_QUEUE, {
      entries: current.filter((entry) => !ids.has(entry.id))
    });
  }
}
