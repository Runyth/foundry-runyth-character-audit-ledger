// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
export const genericAdapter = Object.freeze({
  id: "generic",
  systemIds: ["*"],
  register() {
    // The classifier's built-in semantic rules are the generic adapter.
  }
});
