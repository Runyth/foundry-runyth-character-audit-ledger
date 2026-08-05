import {
  DEFAULT_ACTOR_CONFIG,
  MAX_QUERY_ENTRIES,
  MODULE_ID,
  SENSITIVE_PATH_PATTERN
} from "./constants.mjs";

export function deepClone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return value === undefined ? undefined : structuredClone(value);
}

export function mergeActorConfig(value = {}) {
  return {
    ...deepClone(DEFAULT_ACTOR_CONFIG),
    ...deepClone(value),
    fullAuditUserIds: Array.isArray(value.fullAuditUserIds)
      ? [...new Set(value.fullAuditUserIds.filter(Boolean))]
      : []
  };
}

export function getActorConfig(actorId) {
  const all = game.settings.get(MODULE_ID, "actorConfig") ?? {};
  return mergeActorConfig(all[actorId]);
}

export function isPrimaryGM(user = game.user) {
  const primary = getPrimaryGM();
  return Boolean(primary && primary.id === user?.id);
}

export function getPrimaryGM() {
  return game.users
    ?.filter((user) => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null;
}

export function hasNonGmOwner(actor) {
  return game.users?.some((user) => {
    if (user.isGM) return false;
    return actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
  }) ?? false;
}

export function isAuditedActor(actor) {
  if (!actor) return false;
  const configs = game.settings.get(MODULE_ID, "actorConfig") ?? {};
  return hasNonGmOwner(actor) || Object.hasOwn(configs, actor.id);
}

export function resolveActorFromSheet(app, context = {}) {
  const candidates = [
    app?.actor,
    app?.document,
    app?.object,
    context?.actor,
    context?.document
  ];
  return candidates.find((candidate) => candidate?.documentName === "Actor") ?? null;
}

export function actorStorageId(actor) {
  if (!actor) return null;
  return actor.isToken && actor.token?.baseActor ? actor.token.baseActor.id : actor.id;
}

export function normalizePath(path) {
  return String(path ?? "")
    .split(".")
    .filter(Boolean)
    .map((segment) => segment.startsWith("-=") ? segment.slice(2) : segment)
    .join(".");
}

export function isSensitivePath(path) {
  return SENSITIVE_PATH_PATTERN.test(path);
}

export function sanitizeValue(value, path = "", depth = 0) {
  if (isSensitivePath(path)) return "[REDACTED]";
  if (depth >= 6) return "[TRUNCATED]";
  if (value === undefined) return null;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (Array.isArray(value)) {
    const entries = value.slice(0, 50).map((entry) => sanitizeValue(entry, path, depth + 1));
    if (value.length > 50) entries.push(`[TRUNCATED ${value.length - 50} ITEMS]`);
    return entries;
  }
  if (typeof value === "object") {
    const output = {};
    const entries = Object.entries(value);
    for (const [key, entry] of entries.slice(0, 50)) {
      const childPath = path ? `${path}.${key}` : key;
      output[key] = sanitizeValue(entry, childPath, depth + 1);
    }
    if (entries.length > 50) output.__truncated = `${entries.length - 50} properties`;
    return output;
  }
  return String(value);
}

export function flattenObject(value) {
  if (globalThis.foundry?.utils?.flattenObject) return foundry.utils.flattenObject(value);
  const output = {};
  const visit = (current, prefix = "") => {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      output[prefix] = current;
      return;
    }
    for (const [key, entry] of Object.entries(current)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) visit(entry, path);
      else output[path] = entry;
    }
  };
  visit(value);
  return output;
}

export function getProperty(object, path) {
  if (globalThis.foundry?.utils?.getProperty) return foundry.utils.getProperty(object, path);
  return normalizePath(path).split(".").reduce((value, key) => value?.[key], object);
}

export function randomId(length = 16) {
  if (globalThis.foundry?.utils?.randomID) return foundry.utils.randomID(length);
  return crypto.randomUUID().replaceAll("-", "").slice(0, length);
}

export function stableStringify(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function valuesEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

export function clampQueryLimit(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_QUERY_ENTRIES) : 250;
}

export function escapeCsv(value) {
  const text = value === null || value === undefined
    ? ""
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
  const safeText = /^[=+@-]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safeText) ? `"${safeText.replaceAll('"', '""')}"` : safeText;
}

export function entriesToCsv(entries) {
  const headers = [
    "id",
    "timestamp",
    "recordedAt",
    "actorId",
    "actorName",
    "userId",
    "userName",
    "action",
    "category",
    "highlighted",
    "documentType",
    "documentId",
    "documentName",
    "summary",
    "changes"
  ];
  const rows = entries.map((entry) => headers.map((header) => escapeCsv(
    header === "changes" ? entry.changes : entry[header]
  )).join(","));
  return [headers.join(","), ...rows].join("\r\n");
}

export function entriesToJsonl(entries) {
  return entries.map((entry) => JSON.stringify(entry)).join("\n");
}

export function localize(key, data) {
  return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

export function formatAuditSummary(entry) {
  const action = ["create", "update", "delete"].includes(entry?.action) ? entry.action : "update";
  const typeKey = `CAL.Documents.${entry?.documentType}`;
  const localizedType = game.i18n.has?.(typeKey) ? localize(typeKey) : String(entry?.documentType ?? "Document");
  const rawPaths = (entry?.changes ?? []).slice(0, 3).map((change) => change.path).join(", ");
  const paths = rawPaths ? ` (${rawPaths})` : "";
  const key = `CAL.Summaries.${action}`;
  if (!game.i18n.has?.(key)) return String(entry?.summary ?? "");
  return localize(key, {
    type: localizedType,
    name: String(entry?.documentName ?? entry?.actorName ?? ""),
    paths
  });
}
