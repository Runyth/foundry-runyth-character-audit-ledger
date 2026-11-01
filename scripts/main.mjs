// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import {
  MODULE_ID,
  MODULE_TITLE,
  MODULE_VERSION
} from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { AuditClassifier } from "./audit/classifier.mjs";
import { AuditStore } from "./audit/store.mjs";
import { AuditService } from "./audit/service.mjs";
import { AuditSocket } from "./audit/socket.mjs";
import { AuditCapture } from "./audit/capture.mjs";
import { AdapterRegistry } from "./adapters/registry.mjs";
import { genericAdapter } from "./adapters/generic.mjs";
import { dnd5eAdapter } from "./adapters/dnd5e.mjs";
import { AuditDashboard } from "./ui/dashboard.mjs";
import { SheetAuditIntegration } from "./ui/sheet-tab.mjs";
import { logger } from "./log.mjs";

let runtime = null;

Hooks.once("init", () => {
  const classifier = new AuditClassifier();
  const adapters = new AdapterRegistry();
  adapters.register(genericAdapter);
  adapters.register(dnd5eAdapter);
  adapters.activate(game.system.id, classifier);

  const store = new AuditStore();
  const service = new AuditService({ store, classifier });
  const socket = new AuditSocket(service);
  service.setSocket(socket);
  const capture = new AuditCapture({ service, classifier });
  const sheetIntegration = new SheetAuditIntegration(service);
  sheetIntegration.activate();

  AuditDashboard.configure(service);
  registerSettings(AuditDashboard);
  registerActorDirectoryAccess();

  runtime = { classifier, adapters, store, service, socket, capture, sheetIntegration };
  game.modules.get(MODULE_ID).api = Object.freeze({
    version: MODULE_VERSION,
    openDashboard: () => new AuditDashboard().render({ force: true }),
    queryActor: (actorId, filters = {}) => service.queryLocal([actorId], filters),
    exportActor: (actorId, filters = {}) => service.queryAllLocal([actorId], filters),
    registerClassifierRule: (rule) => classifier.registerRule(rule),
    registerAdapter: (adapter) => {
      adapters.register(adapter);
      if (adapter.systemIds?.includes(game.system.id) || adapter.systemIds?.includes("*")) {
        adapter.register(classifier);
      }
    },
    getActorConfig: (actorId) => game.settings.get(MODULE_ID, "actorConfig")?.[actorId] ?? null
  });

  logger.info(`Initialized v${MODULE_VERSION} for system ${game.system.id}.`);
});

Hooks.once("ready", () => {
  if (!runtime) return;
  runtime.socket.activate();
  runtime.capture.activate();
  logger.info("Audit capture, storage, socket, and sheet integrations are active.");
});

function registerActorDirectoryAccess() {
  Hooks.on("renderActorDirectory", (_app, element) => {
    if (!game.user.isGM) return;
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root || root.querySelector(`[data-${MODULE_ID}-dashboard]`)) return;
    const host = root.querySelector(".directory-header .header-actions, .directory-header, header") ?? root;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cal-directory-button";
    button.setAttribute(`data-${MODULE_ID}-dashboard`, "true");
    button.innerHTML = `<i class="fa-solid fa-clipboard-list" aria-hidden="true"></i> ${game.i18n.localize("CAL.Dashboard.Open")}`;
    button.addEventListener("click", () => new AuditDashboard().render({ force: true }));
    host.append(button);
  });
}
