import { MODULE_TITLE } from "./constants.mjs";

export const logger = Object.freeze({
  debug: (...args) => {
    if (globalThis.CONFIG?.debug?.hooks) console.debug(`${MODULE_TITLE} |`, ...args);
  },
  info: (...args) => console.info(`${MODULE_TITLE} |`, ...args),
  warn: (...args) => console.warn(`${MODULE_TITLE} |`, ...args),
  error: (...args) => console.error(`${MODULE_TITLE} |`, ...args)
});
