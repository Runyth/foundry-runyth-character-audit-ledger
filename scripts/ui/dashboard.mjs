// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import {
  CATEGORIES,
  DEFAULT_HIGHLIGHT_RULES,
  MODULE_ID,
  SETTINGS
} from "../constants.mjs";
import {
  entriesToCsv,
  entriesToJsonl,
  formatAuditSummary,
  getActorConfig,
  hasNonGmOwner,
  localize
} from "../utils.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AuditDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
  static service = null;

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-dashboard`,
    classes: [MODULE_ID, "cal-dashboard"],
    tag: "section",
    window: {
      title: "CAL.Dashboard.Title",
      icon: "fa-solid fa-clipboard-list",
      resizable: true,
      minimizable: true
    },
    position: {
      width: 1180,
      height: 820
    }
  };

  static PARTS = {
    main: {
      template: `/modules/${MODULE_ID}/templates/dashboard.hbs`,
      scrollable: [".cal-dashboard__actors", ".cal-dashboard__results"]
    }
  };

  #readerSelections = new Map();
  #lastEntries = [];

  static configure(service) {
    this.service = service;
  }

  constructor(options = {}) {
    super({
      ...options,
      position: {
        ...game.settings.get(MODULE_ID, SETTINGS.DASHBOARD_POSITION),
        ...options.position
      }
    });
    if (!game.user.isGM) throw new Error("Only a GM can open Character Audit Ledger.");
    if (!this.constructor.service) throw new Error("AuditDashboard was not configured with an AuditService.");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actors = game.actors.contents
      .filter(hasNonGmOwner)
      .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang))
      .map((actor) => {
        const config = getActorConfig(actor.id);
        this.#readerSelections.set(actor.id, new Set(config.fullAuditUserIds));
        return {
          id: actor.id,
          name: actor.name,
          img: actor.img,
          type: actor.type,
          config,
          readerCount: config.fullAuditUserIds.length
        };
      });
    const users = game.users.contents
      .filter((user) => !user.isGM)
      .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang))
      .map((user) => ({ id: user.id, name: user.name, active: user.active }));
    const highlightRules = {
      ...DEFAULT_HIGHLIGHT_RULES,
      ...(game.settings.get(MODULE_ID, SETTINGS.HIGHLIGHT_RULES) ?? {})
    };

    return {
      ...context,
      actors,
      users,
      categories: Object.values(CATEGORIES).map((id) => ({
        id,
        label: localize(`CAL.Categories.${id}`),
        highlighted: Boolean(highlightRules[id])
      })),
      hasActors: actors.length > 0
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (root.dataset.calBound === "true") return;
    root.dataset.calBound = "true";
    root.addEventListener("click", (event) => this.#onClick(event));
    root.addEventListener("change", (event) => this.#onChange(event));
    root.addEventListener("input", (event) => this.#onInput(event));
  }

  async close(options = {}) {
    const { left, top, width, height } = this.position;
    await game.settings.set(MODULE_ID, SETTINGS.DASHBOARD_POSITION, { left, top, width, height });
    return super.close(options);
  }

  async #onClick(event) {
    const actionElement = event.target.closest("[data-cal-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.calAction;
    if (action === "save-config") await this.#saveConfiguration();
    else if (action === "load") await this.#loadEntries();
    else if (action === "export-jsonl") await this.#export("jsonl");
    else if (action === "export-csv") await this.#export("csv");
    else if (action === "configure-readers") this.#openReadersDialog(actionElement.dataset.actorId);
    else if (action === "save-readers") this.#saveReadersDialog();
    else if (action === "close-readers") this.#closeReadersDialog();
  }

  #onChange(event) {
    if (event.target.matches("[data-cal-select-all]")) {
      for (const checkbox of this.element.querySelectorAll("[data-cal-select-actor]")) {
        checkbox.checked = event.target.checked;
      }
    }
  }

  #onInput(event) {
    if (!event.target.matches("[data-cal-actor-search]")) return;
    const query = event.target.value.trim().toLocaleLowerCase();
    for (const row of this.element.querySelectorAll("[data-cal-actor-row]")) {
      row.hidden = Boolean(query) && !row.dataset.actorName.toLocaleLowerCase().includes(query);
    }
  }

  async #saveConfiguration() {
    const configs = {};
    for (const row of this.element.querySelectorAll("[data-cal-actor-row]")) {
      const actorId = row.dataset.actorId;
      configs[actorId] = {
        defaultSheetEnabled: row.querySelector("[data-cal-config='default']").checked,
        tidySheetEnabled: row.querySelector("[data-cal-config='tidy']").checked,
        fullAuditUserIds: [...(this.#readerSelections.get(actorId) ?? [])]
      };
    }
    const rules = {};
    for (const checkbox of this.element.querySelectorAll("[data-cal-highlight-rule]")) {
      rules[checkbox.value] = checkbox.checked;
    }
    await this.constructor.service.saveActorConfigs(configs);
    await this.constructor.service.saveHighlightRules(rules);
    ui.notifications.info(localize("CAL.Notifications.ConfigurationSaved"));
    await this.render({ parts: ["main"] });
  }

  async #loadEntries() {
    const actorIds = this.#selectedActorIds();
    if (!actorIds.length) {
      ui.notifications.warn(localize("CAL.Notifications.SelectActor"));
      return;
    }
    this.#setStatus(localize("CAL.Common.Loading"));
    const entries = await this.constructor.service.queryLocal(actorIds, {
      ...this.#readFilters(),
      limit: 500
    });
    this.#lastEntries = entries;
    this.#renderResults(entries);
    this.#setStatus(localize("CAL.Dashboard.LoadedCount", { count: entries.length }));
  }

  async #export(format) {
    const actorIds = this.#selectedActorIds();
    if (!actorIds.length) {
      ui.notifications.warn(localize("CAL.Notifications.SelectActor"));
      return;
    }
    const rawEntries = await this.constructor.service.queryAllLocal(actorIds, this.#readFilters());
    const entries = rawEntries.map((entry) => ({ ...entry, summary: formatAuditSummary(entry) }));
    const mode = this.element.querySelector("[data-cal-export-mode]")?.value ?? "combined";
    if (mode === "per-character") {
      for (const actorId of actorIds) {
        const actorEntries = entries.filter((entry) => entry.actorId === actorId);
        const actorName = game.actors.get(actorId)?.name ?? actorId;
        this.#download(format, actorEntries, `character-audit-${slug(actorName)}`);
      }
    } else {
      this.#download(format, entries, "character-audit-selected");
    }
    ui.notifications.info(localize("CAL.Notifications.Exported", { count: entries.length }));
  }

  #download(format, entries, basename) {
    const isJsonl = format === "jsonl";
    const content = isJsonl ? entriesToJsonl(entries) : entriesToCsv(entries);
    const mime = isJsonl ? "application/x-ndjson" : "text/csv;charset=utf-8";
    downloadText(content, mime, `${basename}.${format}`);
  }

  #selectedActorIds() {
    return [...this.element.querySelectorAll("[data-cal-select-actor]:checked")]
      .map((checkbox) => checkbox.value);
  }

  #readFilters() {
    return {
      search: this.element.querySelector("[data-cal-filter='search']")?.value ?? "",
      categories: [...this.element.querySelectorAll("[data-cal-filter-category]:checked")]
        .map((checkbox) => checkbox.value),
      userIds: [...this.element.querySelectorAll("[data-cal-filter-user]:checked")]
        .map((checkbox) => checkbox.value),
      actions: [...this.element.querySelectorAll("[data-cal-filter-action]:checked")]
        .map((checkbox) => checkbox.value),
      highlightedOnly: this.element.querySelector("[data-cal-filter='highlighted']")?.checked ?? false,
      from: this.element.querySelector("[data-cal-filter='from']")?.value ?? "",
      to: this.element.querySelector("[data-cal-filter='to']")?.value ?? ""
    };
  }

  #renderResults(entries) {
    const body = this.element.querySelector("[data-cal-results]");
    body.replaceChildren();
    for (const entry of entries) {
      const row = document.createElement("tr");
      row.classList.toggle("cal-result--highlighted", entry.highlighted);

      const timestamp = document.createElement("td");
      timestamp.textContent = new Date(entry.timestamp).toLocaleString();
      const actor = document.createElement("td");
      actor.textContent = entry.actorName;
      const user = document.createElement("td");
      user.textContent = entry.userName;
      const category = document.createElement("td");
      category.textContent = localize(`CAL.Categories.${entry.category}`);
      const action = document.createElement("td");
      action.textContent = localize(`CAL.Actions.${entry.action}`);
      const summary = document.createElement("td");
      const details = document.createElement("details");
      const detailsSummary = document.createElement("summary");
      detailsSummary.textContent = formatAuditSummary(entry);
      const list = document.createElement("dl");
      for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
        const term = document.createElement("dt");
        term.textContent = change.path;
        const description = document.createElement("dd");
        description.textContent = `${displayValue(change.before)} → ${displayValue(change.after)}`;
        list.append(term, description);
      }
      details.append(detailsSummary, list);
      summary.append(details);
      row.append(timestamp, actor, user, category, action, summary);
      body.append(row);
    }
  }

  #openReadersDialog(actorId) {
    const dialog = this.element.querySelector("[data-cal-readers-dialog]");
    dialog.dataset.actorId = actorId;
    const selected = this.#readerSelections.get(actorId) ?? new Set();
    const actor = game.actors.get(actorId);
    for (const checkbox of dialog.querySelectorAll("[data-cal-reader-user]")) {
      const user = game.users.get(checkbox.value);
      const isOwner = Boolean(actor && user
        && actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
      checkbox.disabled = !isOwner;
      checkbox.checked = isOwner && selected.has(checkbox.value);
      checkbox.closest("label").hidden = !isOwner;
    }
    dialog.querySelector("[data-cal-readers-actor-name]").textContent = actor?.name ?? actorId;
    dialog.showModal();
  }

  #saveReadersDialog() {
    const dialog = this.element.querySelector("[data-cal-readers-dialog]");
    const actorId = dialog.dataset.actorId;
    const selected = new Set([...dialog.querySelectorAll("[data-cal-reader-user]:checked:not(:disabled)")]
      .map((checkbox) => checkbox.value));
    this.#readerSelections.set(actorId, selected);
    const button = this.element.querySelector(`[data-cal-action='configure-readers'][data-actor-id='${actorId}']`);
    if (button) button.querySelector("[data-cal-reader-count]").textContent = String(selected.size);
    dialog.close();
  }

  #closeReadersDialog() {
    this.element.querySelector("[data-cal-readers-dialog]").close();
  }

  #setStatus(text) {
    const status = this.element.querySelector("[data-cal-dashboard-status]");
    if (status) status.textContent = text;
  }
}

function downloadText(content, mime, filename) {
  if (typeof globalThis.saveDataToFile === "function") {
    globalThis.saveDataToFile(content, mime, filename);
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function slug(value) {
  return String(value).normalize("NFKD").replaceAll(/[^\p{Letter}\p{Number}]+/gu, "-").replaceAll(/^-|-$/g, "").toLocaleLowerCase() || "character";
}

function displayValue(value) {
  if (value === null || value === undefined) return "∅";
  return typeof value === "string" ? value : JSON.stringify(value);
}
