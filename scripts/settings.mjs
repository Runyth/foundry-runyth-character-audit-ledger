import {
  DEFAULT_HIGHLIGHT_RULES,
  DEFAULT_PAGE_SIZE,
  DEFAULT_RETENTION_LIMIT,
  MODULE_ID,
  MODULE_TITLE,
  SETTINGS
} from "./constants.mjs";

export function registerSettings(DashboardClass) {
  game.settings.registerMenu(MODULE_ID, "dashboard", {
    name: "CAL.Settings.Dashboard.Name",
    label: "CAL.Settings.Dashboard.Label",
    hint: "CAL.Settings.Dashboard.Hint",
    icon: "fa-solid fa-clipboard-list",
    type: DashboardClass,
    restricted: true
  });

  game.settings.register(MODULE_ID, SETTINGS.ACTOR_CONFIG, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, SETTINGS.HIGHLIGHT_RULES, {
    scope: "world",
    config: false,
    type: Object,
    default: { ...DEFAULT_HIGHLIGHT_RULES }
  });

  game.settings.register(MODULE_ID, SETTINGS.STORAGE_INDEX, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, SETTINGS.RETENTION_LIMIT, {
    name: "CAL.Settings.Retention.Name",
    hint: "CAL.Settings.Retention.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    default: DEFAULT_RETENTION_LIMIT,
    range: {
      min: 500,
      max: 50000,
      step: 500
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.PAGE_SIZE, {
    name: "CAL.Settings.PageSize.Name",
    hint: "CAL.Settings.PageSize.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    default: DEFAULT_PAGE_SIZE,
    range: {
      min: 50,
      max: 500,
      step: 50
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.CAPTURE_ACTIVE_EFFECTS, {
    name: "CAL.Settings.CaptureEffects.Name",
    hint: "CAL.Settings.CaptureEffects.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.PENDING_QUEUE, {
    scope: "client",
    config: false,
    type: Object,
    default: { entries: [] }
  });

  game.settings.register(MODULE_ID, SETTINGS.DASHBOARD_POSITION, {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });

  console.info(`${MODULE_TITLE} | Settings registered.`);
}
