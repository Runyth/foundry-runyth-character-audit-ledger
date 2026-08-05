# Architecture

## Components

| Component | Responsibility |
|---|---|
| `AuditCapture` | Observes initiating-client pre-update state and post-operation hooks for Actor, Item, and Active Effect documents. |
| `AuditClassifier` | Maps changed paths and document actions to stable categories. |
| `AdapterRegistry` | Adds system-specific semantic rules without coupling the core to a game system. |
| `AuditSocket` | Elects the lexicographically first active GM as primary, queues player entries until acknowledged, and brokers permission-filtered reads. |
| `AuditService` | Validates origin/ownership, normalizes payloads, recomputes categories and highlighting, and enforces read permissions. |
| `AuditStore` | Serializes writes and stores bounded chunks in GM-only JournalEntry pages. |
| `AuditDashboard` | ApplicationV2 review, configuration, filtering, and export UI. |
| `SheetAuditIntegration` | Supported Tidy tab registration and generic Actor-sheet render integration. |

## Write flow

1. The initiating client snapshots the pre-update document in `preUpdateActor`, `preUpdateItem`, or `preUpdateActiveEffect`.
2. The corresponding post-operation hook computes a bounded field-level diff.
3. The origin client stores the entry in its client queue before sending it to the primary GM.
4. The primary GM validates user identity claims against the entry, Actor existence, Owner permission, action/document allowlists, and payload bounds.
5. The GM recomputes category, highlight state, Actor identity, system ID, receipt time, and stable summary.
6. `AuditStore` appends through one serialized promise queue, rotates pages at the configured size, updates the index, and prunes oldest entries past retention.
7. The GM acknowledges accepted or rejected IDs; the origin removes them from its queue.

## Read flow

- GM dashboard reads locally from GM-only journals.
- A player sheet sends a query to the primary GM.
- The service requires Actor Owner permission.
- Without explicit full-log permission, `userIds` is forcibly replaced with the requesting user's ID.
- Returned data contains only the bounded filtered entries; storage Journal documents remain inaccessible to players.

## Storage shape

Each audited Actor has one managed JournalEntry. JournalEntry pages contain an array under:

```text
flags.character-audit-ledger.entries
```

The world setting `storageIndex` maps Actor IDs to the JournalEntry, active page, counts, recent entry IDs, and update timestamp. The recent-ID cache makes normal acknowledgement retries O(1) without storing an unbounded global ID index.

## System adapters

The generic classifier recognizes common currency and quantity path segments and the Foundry document model. The dnd5e adapter adds exact rules for `system.currency.*`, `system.quantity`, and `system.uses.*`.

Additional systems can register a rule or adapter through the public API. Capture itself remains system-independent because Actor, embedded Item, Active Effect, ownership, and update hooks are Foundry document concepts.
