import test from "node:test";
import assert from "node:assert/strict";

import { AuditService } from "../scripts/audit/service.mjs";
import { MODULE_ID, SETTINGS } from "../scripts/constants.mjs";

function installGame({ fullAuditUserIds = [] } = {}) {
  const owner = { id: "u1", name: "Owner", isGM: false };
  const outsider = { id: "u2", name: "Outsider", isGM: false };
  const gm = { id: "gm1", name: "GM", isGM: true };
  const actor = {
    id: "actor-1",
    testUserPermission(user) {
      return user.isGM || user.id === owner.id;
    }
  };

  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };
  globalThis.game = {
    actors: new Map([[actor.id, actor]]),
    users: new Map([[owner.id, owner], [outsider.id, outsider], [gm.id, gm]]),
    settings: {
      get(scope, key) {
        assert.equal(scope, MODULE_ID);
        if (key === SETTINGS.ACTOR_CONFIG) {
          return { [actor.id]: { defaultSheetEnabled: true, tidySheetEnabled: true, fullAuditUserIds } };
        }
        if (key === SETTINGS.HIGHLIGHT_RULES) return {};
        return undefined;
      }
    }
  };

  return { actor, owner, outsider, gm };
}

function makeService() {
  const records = [
    null,
    {
      id: "entry-owner",
      timestamp: 20,
      actorId: "actor-1",
      actorName: "Hero",
      userId: "u1",
      userName: "Owner",
      action: "update",
      category: "attribute",
      documentType: "Actor",
      documentName: "Hero",
      changes: [{ path: "system.hp", before: 1, after: 2 }]
    },
    {
      id: "entry-gm",
      timestamp: 10,
      actorId: "actor-1",
      actorName: "Hero",
      userId: "gm1",
      userName: "GM",
      action: "update",
      category: "currency",
      documentType: "Actor",
      documentName: "Hero",
      changes: [{ path: "system.currency.gp", before: 1, after: 2 }]
    },
    {
      id: "legacy",
      timestamp: "5",
      actorId: "actor-1",
      actorName: "Hero",
      userId: "u1",
      userName: "Owner",
      changes: null
    }
  ];
  return new AuditService({
    store: { async readActor() { return records; } },
    classifier: { isHighlighted(category) { return category === "currency"; } }
  });
}

test("owner reads only self-originated audit entries by default", async () => {
  const { owner } = installGame();
  const result = await makeService().queryForUser("actor-1", owner.id, { limit: 50 });
  assert.deepEqual(result.map((entry) => entry.id), ["entry-owner", "legacy"]);
  assert.equal(result.find((entry) => entry.id === "legacy").category, "other");
  assert.deepEqual(result.find((entry) => entry.id === "legacy").changes, []);
});

test("explicit full reader and GM can read all entries while outsider reads none", async () => {
  const { owner, outsider, gm } = installGame({ fullAuditUserIds: ["u1"] });
  const service = makeService();

  assert.deepEqual(
    (await service.queryForUser("actor-1", owner.id, { limit: 50 })).map((entry) => entry.id),
    ["entry-owner", "entry-gm", "legacy"]
  );
  assert.deepEqual(await service.queryForUser("actor-1", outsider.id, { limit: 50 }), []);
  assert.deepEqual(
    (await service.queryForUser("actor-1", gm.id, { limit: 50 })).map((entry) => entry.id),
    ["entry-owner", "entry-gm", "legacy"]
  );
});
