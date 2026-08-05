# Character Audit Ledger

A Foundry Virtual Tabletop v13 module that records player-character changes and provides a scalable GM audit dashboard, optional character-sheet tabs, configurable highlighting, permission-filtered player views, and JSONL/CSV exports.

## Compatibility

| Component | Target |
|---|---|
| Foundry Virtual Tabletop | v13, verified manifest target `13.351` |
| Game systems | System-agnostic Actor, embedded Item, and Active Effect capture |
| D&D 5e | Semantic adapter for currency and item quantity paths |
| Tidy 5e Sheets | Supported `tidy5e-sheet.ready` and `registerCharacterTab` API |
| Default and custom Actor sheets | `renderActorSheetV2` / legacy render-hook adapter with accessible fallback panel |

The audit core does not require dnd5e or Tidy 5e Sheets. Currency and quantity classification is heuristic for unknown systems; systems can register a dedicated classifier adapter through the public module API.

## Installation

1. Back up the Foundry user-data directory.
2. Extract the installable ZIP into `Data/modules/`.
3. Ensure the resulting path is `Data/modules/character-audit-ledger/module.json`.
4. Enable **Character Audit Ledger** in the target world.
5. As GM, open **Game Settings → Configure Settings → Module Settings → Open Character Audit Ledger**, or use the **Audit Ledger** button in the Actor Directory.

## Behavior

- Audits Actors that currently have a non-GM Owner, plus Actors previously configured in the dashboard.
- Captures Actor updates and embedded Item / Active Effect creation, updates, and deletion.
- Serializes writes through the elected primary active GM.
- Keeps player-originated entries in an at-least-once local queue until acknowledged by the primary GM.
- Stores records in GM-only JournalEntry pages, chunked to bound update size.
- Defaults to 5,000 retained entries per character and 200 entries per storage page; both are configurable.
- Redacts secret-like paths and bounds nested payload depth, collection size, and string length.
- Recalculates highlight state at read time, so changing rules updates existing entries without rewriting storage.

## Dashboard

The dashboard supports:

- search and scalable character selection;
- select all, one character, or any subset;
- independent default-sheet and Tidy-sheet tab toggles per character;
- per-character selection of Owner users allowed to read all entries, including GM entries;
- filters for text, date range, category, originating user, action, and highlighted-only;
- combined or per-character JSONL and CSV export;
- configurable highlight categories with money, item add/remove, item quantity, and ownership enabled by default;
- resizable, remembered window geometry and keyboard-accessible controls.

## Player sheet tab

By default, an Owner sees only entries whose originating user ID is their own. A GM can grant an Owner full-log access for a character, which includes other players' and GM-originated entries. The sheet tab never reads the hidden storage documents directly; it requests a permission-filtered view from the active primary GM.

## Public API

Available after `init` at `game.modules.get("character-audit-ledger").api`:

| Function | Purpose |
|---|---|
| `openDashboard()` | Open the GM dashboard. |
| `queryActor(actorId, filters)` | Query a bounded local GM view. |
| `exportActor(actorId, filters)` | Query all retained local entries for export. |
| `registerClassifierRule(rule)` | Register a prioritized semantic classification rule. |
| `registerAdapter(adapter)` | Register a system adapter with `id`, `systemIds`, and `register(classifier)`. |
| `getActorConfig(actorId)` | Read the stored per-character configuration. |

## Development

Requirements: Node.js 20+ and Python 3.11+.

```text
npm test
npm run validate
python tools/build-release.py
```

The release builder creates deterministic archives when `SOURCE_DATE_EPOCH` is set.

## Important security boundary

The storage and player read path are GM-authoritative, and ordinary players cannot access or edit storage journals. Foundry's pre-update hook runs only on the initiating client, however, so this module is an operational accountability log rather than a cryptographically tamper-proof forensic ledger. A deliberately modified client can omit or forge its submitted pre-change details. See `SECURITY.md` in the documentation bundle.

## References

- Foundry VTT v13 API: https://foundryvtt.com/api/v13/
- Foundry v13.351 release: https://foundryvtt.com/releases/13.351
- Tidy 5e Sheets API: https://kgar.github.io/foundry-vtt-tidy-5e-sheets/
- Tidy API class reference: https://kgar.github.io/foundry-vtt-tidy-5e-sheets/classes/Tidy5eSheetsApi.html
