# Operations guide

## Initial setup

1. Enable the module and log in as GM.
2. Open the Actor Directory and select **Audit Ledger**.
3. Search for a player character.
4. Enable the desired default-sheet and/or Tidy-sheet tab.
5. Optionally configure full-log readers; only current non-GM Owners are eligible.
6. Confirm or adjust highlight categories and save.

## Export

1. Select one, several, or all visible characters.
2. Set optional filters.
3. Choose a combined file or one file per character.
4. Export JSONL for lossless machine processing or CSV for tabular review.

JSONL is the preferred archival format. CSV serializes the `changes` array as JSON in one cell and applies spreadsheet formula-injection mitigation to string cells.

## Capacity controls

| Setting | Default | Range |
|---|---:|---:|
| Entries retained per character | 5,000 | 500–50,000 |
| Entries per storage page | 200 | 50–500 |
| Sheet query maximum | 500 | fixed safety cap |
| Dashboard preview maximum | 500 | fixed safety cap |
| Offline client queue | 500 | fixed safety cap |

Lower page sizes reduce each document update payload but create more JournalEntry pages. Raising retention increases world database size and export/read cost.

## Recovery

- Queued player entries retry every 30 seconds and when user presence changes.
- The lexicographically first active GM user ID is the deterministic primary writer.
- If a managed JournalEntry is deleted manually, the next accepted entry creates a replacement and repairs the index.
- Do not manually edit managed page flags.
