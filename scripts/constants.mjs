// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
export const MODULE_ID = "runyth-character-audit-ledger";
export const MODULE_TITLE = "Runyth Character Audit Ledger";
export const MODULE_VERSION = "1.0.2";

export const SETTINGS = Object.freeze({
  ACTOR_CONFIG: "actorConfig",
  HIGHLIGHT_RULES: "highlightRules",
  STORAGE_INDEX: "storageIndex",
  RETENTION_LIMIT: "retentionLimit",
  PAGE_SIZE: "pageSize",
  PENDING_QUEUE: "pendingQueue",
  DASHBOARD_POSITION: "dashboardPosition",
  CAPTURE_ACTIVE_EFFECTS: "captureActiveEffects"
});

export const SOCKET_CHANNEL = `module.${MODULE_ID}`;
export const STORAGE_FOLDER_NAME = `[${MODULE_TITLE}] Audit Storage`;
export const STORAGE_FLAG_SCOPE = MODULE_ID;
export const STORAGE_ENTRIES_FLAG = "entries";
export const TAB_ID = `${MODULE_ID}-audit`;

export const ACTIONS = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete"
});

export const CATEGORIES = Object.freeze({
  CURRENCY: "currency",
  ITEM: "item",
  ITEM_QUANTITY: "itemQuantity",
  ATTRIBUTE: "attribute",
  ACTIVE_EFFECT: "activeEffect",
  OWNERSHIP: "ownership",
  IDENTITY: "identity",
  TOKEN: "token",
  OTHER: "other"
});

export const DEFAULT_HIGHLIGHT_RULES = Object.freeze({
  [CATEGORIES.CURRENCY]: true,
  [CATEGORIES.ITEM]: true,
  [CATEGORIES.ITEM_QUANTITY]: true,
  [CATEGORIES.ATTRIBUTE]: false,
  [CATEGORIES.ACTIVE_EFFECT]: false,
  [CATEGORIES.OWNERSHIP]: true,
  [CATEGORIES.IDENTITY]: false,
  [CATEGORIES.TOKEN]: false,
  [CATEGORIES.OTHER]: false
});

export const DEFAULT_ACTOR_CONFIG = Object.freeze({
  defaultSheetEnabled: false,
  tidySheetEnabled: false,
  fullAuditUserIds: []
});

export const MAX_PENDING_ENTRIES = 500;
export const RECENT_ENTRY_ID_CACHE_SIZE = 1024;
export const MAX_QUERY_ENTRIES = 5000;
export const DEFAULT_PAGE_SIZE = 200;
export const DEFAULT_RETENTION_LIMIT = 5000;
export const SENSITIVE_PATH_PATTERN = /(?:password|secret|credential|cookie|api[-_.]?key|access[-_.]?token|refresh[-_.]?token|private[-_.]?key)/i;
