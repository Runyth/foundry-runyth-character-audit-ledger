import {
  flattenObject,
  getProperty,
  isSensitivePath,
  normalizePath,
  sanitizeValue,
  valuesEqual
} from "../utils.mjs";
import { MODULE_ID } from "../constants.mjs";

export function buildChanges(beforeSource, afterSource, updateData) {
  const flattened = flattenObject(updateData ?? {});
  const changes = [];

  for (const [rawPath, submittedValue] of Object.entries(flattened)) {
    const path = normalizePath(rawPath);
    if (!path || path.startsWith(`flags.${MODULE_ID}.`)) continue;
    const beforeRaw = getProperty(beforeSource, path);
    const deleted = rawPath.split(".").some((segment) => segment.startsWith("-="));
    const afterRaw = deleted ? null : getProperty(afterSource, path) ?? submittedValue;
    if (valuesEqual(beforeRaw, afterRaw)) continue;
    const sensitive = isSensitivePath(path);
    changes.push({
      path,
      before: sensitive ? "[REDACTED]" : sanitizeValue(beforeRaw, path),
      after: sensitive ? "[REDACTED]" : sanitizeValue(afterRaw, path)
    });
  }

  return changes;
}

export function summarizeCreate(document) {
  return [{
    path: document.documentName === "Item" ? "item" : "document",
    before: null,
    after: sanitizeValue(document.toObject?.() ?? document)
  }];
}

export function summarizeDelete(document) {
  return [{
    path: document.documentName === "Item" ? "item" : "document",
    before: sanitizeValue(document.toObject?.() ?? document),
    after: null
  }];
}
