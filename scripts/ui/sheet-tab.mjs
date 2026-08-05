import {
  MODULE_ID,
  TAB_ID
} from "../constants.mjs";
import {
  formatAuditSummary,
  getActorConfig,
  localize,
  resolveActorFromSheet
} from "../utils.mjs";
import { logger } from "../log.mjs";

export class SheetAuditIntegration {
  #service;
  #tidyRegistered = false;

  constructor(service) {
    this.#service = service;
  }

  activate() {
    Hooks.on("renderActorSheetV2", (app, element, context) => {
      this.#injectDefaultSheetTab(app, element, context);
    });
    Hooks.on("renderActorSheet", (app, element, context) => {
      this.#injectDefaultSheetTab(app, element, context);
    });
    Hooks.once("tidy5e-sheet.ready", (api) => this.#registerTidyTab(api));
    Hooks.once("ready", () => {
      const api = game.modules.get("tidy5e-sheet")?.api;
      if (api) this.#registerTidyTab(api);
    });
  }

  #registerTidyTab(api) {
    if (this.#tidyRegistered || !api?.models?.HandlebarsTab) return;
    try {
      api.registerCharacterTab(new api.models.HandlebarsTab({
        title: "CAL.SheetTab.Title",
        iconClass: "fa-solid fa-clock-rotate-left",
        path: `/modules/${MODULE_ID}/templates/sheet-audit-tab.hbs`,
        tabId: TAB_ID,
        tabContentsClasses: ["cal-sheet-tab"],
        enabled: (context) => {
          const actor = resolveActorFromSheet(context?.app ?? context?.sheet, context);
          return this.#canShow(actor, "tidySheetEnabled");
        },
        getData: async (context) => {
          const actor = resolveActorFromSheet(context?.app ?? context?.sheet, context);
          return {
            ...context,
            calAudit: await this.#prepareView(actor)
          };
        },
        onRender: ({ tabContentsElement, app }) => {
          const actor = resolveActorFromSheet(app);
          this.#bindPanel(tabContentsElement, actor);
        }
      }), {
        includeAsDefaultTab: true,
        layout: "all"
      });
      this.#tidyRegistered = true;
      logger.info("Registered the supported Tidy 5e character-sheet tab.");
    } catch (error) {
      logger.error("Tidy 5e tab registration failed.", error);
    }
  }

  async #injectDefaultSheetTab(app, element, context) {
    const root = normalizeElement(element);
    if (!root || root.classList.contains("tidy5e-sheet") || root.querySelector(".tidy5e-sheet")) return;
    const actor = resolveActorFromSheet(app, context);
    if (!this.#canShow(actor, "defaultSheetEnabled")) return;
    if (root.querySelector(`[data-cal-tab-id="${TAB_ID}"]`)) return;

    const nav = findNavigation(root);
    const tabContainer = findTabContainer(root, nav);
    if (!nav || !tabContainer) {
      this.#injectFallbackButton(app, root, actor);
      return;
    }

    const control = document.createElement(nav.matches("ul, ol") ? "li" : "button");
    control.dataset.calTabId = TAB_ID;
    control.dataset.tab = TAB_ID;
    control.dataset.group = nav.dataset.group ?? "primary";
    control.classList.add("item", "cal-sheet-tab-control");
    if (control.tagName === "BUTTON") control.type = "button";
    else control.tabIndex = 0;
    control.setAttribute("role", "tab");
    control.setAttribute("aria-selected", "false");
    control.innerHTML = `<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span>${localize("CAL.SheetTab.Title")}</span>`;
    control.setAttribute("aria-label", localize("CAL.SheetTab.Title"));
    nav.append(control);

    const panel = document.createElement("section");
    panel.className = "tab cal-sheet-tab";
    panel.dataset.tab = TAB_ID;
    panel.dataset.group = control.dataset.group;
    panel.dataset.calTabId = TAB_ID;
    panel.id = `${TAB_ID}-${actor.id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-label", localize("CAL.SheetTab.Title"));
    control.setAttribute("aria-controls", panel.id);
    panel.hidden = true;
    panel.innerHTML = buildPanelSkeleton();
    tabContainer.append(panel);
    this.#bindPanel(panel, actor);

    const activate = async (event) => {
      event.preventDefault();
      for (const sibling of tabContainer.querySelectorAll(`:scope > [data-tab]`)) {
        sibling.classList.toggle("active", sibling === panel);
        if (sibling === panel) sibling.hidden = false;
      }
      for (const sibling of nav.querySelectorAll("[data-tab]")) {
        const selected = sibling === control;
        sibling.classList.toggle("active", selected);
        if (sibling.hasAttribute("role")) sibling.setAttribute("aria-selected", String(selected));
      }
      await this.#refreshPanel(panel, actor);
    };
    control.addEventListener("click", activate);
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") activate(event);
    });

    nav.addEventListener("click", (event) => {
      const target = event.target.closest("[data-tab]");
      if (target && target !== control) {
        panel.classList.remove("active");
        panel.hidden = true;
        control.classList.remove("active");
        control.setAttribute("aria-selected", "false");
      }
    }, true);
  }

  #injectFallbackButton(app, root, actor) {
    const header = root.querySelector("header") ?? root;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cal-sheet-fallback-button";
    button.dataset.calTabId = TAB_ID;
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = `<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> ${localize("CAL.SheetTab.Title")}`;
    button.addEventListener("click", () => {
      const existing = root.querySelector(`.cal-sheet-tab[data-cal-fallback="true"]`);
      const panel = existing ?? document.createElement("section");
      if (!existing) {
        panel.className = "cal-sheet-tab cal-sheet-tab--fallback";
        panel.dataset.calFallback = "true";
        panel.id = `${TAB_ID}-${actor.id}-fallback`;
        panel.setAttribute("role", "region");
        panel.setAttribute("aria-label", localize("CAL.SheetTab.Title"));
        button.setAttribute("aria-controls", panel.id);
        panel.innerHTML = buildPanelSkeleton();
        panel.hidden = false;
        button.setAttribute("aria-expanded", "true");
        root.append(panel);
        this.#bindPanel(panel, actor);
        return;
      }
      panel.hidden = !panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) this.#refreshPanel(panel, actor);
    });
    header.append(button);
    logger.warn(`No standard tab container was found for ${app.constructor.name}; installed the accessible sheet fallback panel.`);
  }

  #canShow(actor, configKey) {
    if (!actor || !game.user) return false;
    const config = getActorConfig(actor.id);
    if (!config[configKey]) return false;
    return game.user.isGM
      || actor.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
  }

  async #prepareView(actor) {
    if (!actor) return { actorId: null, entries: [], canReadAll: false };
    const config = getActorConfig(actor.id);
    const canReadAll = game.user.isGM || config.fullAuditUserIds.includes(game.user.id);
    const entries = await this.#service.requestSheetEntries(actor.id, { limit: 250 });
    return {
      actorId: actor.id,
      entries: entries.map(formatEntry),
      canReadAll,
      empty: entries.length === 0
    };
  }

  #bindPanel(panel, actor) {
    if (!panel || panel.dataset.calBound === "true") return;
    panel.dataset.calBound = "true";
    panel.addEventListener("click", (event) => {
      const action = event.target.closest("[data-cal-action]")?.dataset.calAction;
      if (action === "refresh") this.#refreshPanel(panel, actor);
    });
    panel.addEventListener("input", () => this.#filterRenderedRows(panel));
    if (!panel.querySelector("[data-cal-entries]")?.children.length) this.#refreshPanel(panel, actor);
  }

  async #refreshPanel(panel, actor) {
    if (!panel || !actor) return;
    const status = panel.querySelector("[data-cal-status]");
    if (status) status.textContent = localize("CAL.Common.Loading");
    const entries = await this.#service.requestSheetEntries(actor.id, { limit: 500 });
    renderEntries(panel.querySelector("[data-cal-entries]"), entries);
    if (status) status.textContent = entries.length
      ? localize("CAL.SheetTab.EntryCount", { count: entries.length })
      : localize("CAL.SheetTab.Empty");
    this.#filterRenderedRows(panel);
  }

  #filterRenderedRows(panel) {
    const search = panel.querySelector("[data-cal-filter='search']")?.value.trim().toLocaleLowerCase() ?? "";
    const category = panel.querySelector("[data-cal-filter='category']")?.value ?? "";
    for (const row of panel.querySelectorAll("[data-cal-entry]")) {
      const matchesSearch = !search || row.textContent.toLocaleLowerCase().includes(search);
      const matchesCategory = !category || row.dataset.category === category;
      row.hidden = !(matchesSearch && matchesCategory);
    }
  }
}

function normalizeElement(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return null;
}

function findNavigation(root) {
  return root.querySelector([
    "nav.tabs[data-group='primary']",
    ".sheet-tabs.tabs[data-group='primary']",
    "nav.tabs",
    ".sheet-tabs.tabs",
    "[role='tablist']"
  ].join(","));
}

function findTabContainer(root, nav) {
  const group = nav?.dataset.group;
  const tabs = [...root.querySelectorAll(".tab[data-tab], section[data-tab], [role='tabpanel'][data-tab]")]
    .filter((element) => !group || !element.dataset.group || element.dataset.group === group);
  return tabs[0]?.parentElement ?? null;
}

function buildPanelSkeleton() {
  return `
    <div class="cal-sheet-tab__toolbar">
      <input type="search" data-cal-filter="search" placeholder="${localize("CAL.Filters.Search")}" aria-label="${localize("CAL.Filters.Search")}">
      <select data-cal-filter="category" aria-label="${localize("CAL.Filters.Category")}">
        <option value="">${localize("CAL.Filters.AllCategories")}</option>
        ${["currency", "item", "itemQuantity", "attribute", "activeEffect", "ownership", "identity", "token", "other"]
          .map((category) => `<option value="${category}">${localize(`CAL.Categories.${category}`)}</option>`).join("")}
      </select>
      <button type="button" data-cal-action="refresh"><i class="fa-solid fa-rotate" aria-hidden="true"></i> ${localize("CAL.Common.Refresh")}</button>
    </div>
    <p class="cal-sheet-tab__status" data-cal-status></p>
    <ol class="cal-audit-entries" data-cal-entries></ol>
  `;
}

function renderEntries(container, entries) {
  if (!container) return;
  container.replaceChildren();
  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "cal-audit-entry";
    item.dataset.calEntry = entry.id;
    item.dataset.category = entry.category;
    item.classList.toggle("cal-audit-entry--highlighted", entry.highlighted);

    const header = document.createElement("div");
    header.className = "cal-audit-entry__header";
    const title = document.createElement("strong");
    title.textContent = formatAuditSummary(entry);
    const meta = document.createElement("span");
    meta.textContent = `${new Date(entry.timestamp).toLocaleString()} · ${entry.userName} · ${localize(`CAL.Categories.${entry.category}`)}`;
    header.append(title, meta);

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = localize("CAL.SheetTab.Details", { count: entry.changes.length });
    const list = document.createElement("dl");
    for (const change of entry.changes) {
      const term = document.createElement("dt");
      term.textContent = change.path;
      const description = document.createElement("dd");
      description.textContent = `${formatValue(change.before)} → ${formatValue(change.after)}`;
      list.append(term, description);
    }
    details.append(summary, list);
    item.append(header, details);
    container.append(item);
  }
}

function formatValue(value) {
  if (value === null || value === undefined) return "∅";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function formatEntry(entry) {
  return {
    ...entry,
    summary: formatAuditSummary(entry),
    timestampLabel: new Date(entry.timestamp).toLocaleString(),
    categoryLabel: localize(`CAL.Categories.${entry.category}`),
    changes: entry.changes.map((change) => ({
      ...change,
      beforeLabel: formatValue(change.before),
      afterLabel: formatValue(change.after)
    }))
  };
}
