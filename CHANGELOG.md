# Changelog


## 1.0.4 — 2026-11-05

- Ported the Garb & Grime fleet aesthetic to the ledger's surfaces: dark petrol
  window gradient, gold section headings, gradient buttons with gold hover,
  dark field controls, pill-styled status rows and sheet toolbar band, thin
  scrollbars, and the gold focus ring across dashboard, sheet audit tab, and
  the full-readers dialog. Tokens are declared on the dashboard root so the
  look stands without Garb & Grime being installed.
- Reduced the reflow work that made window resizing janky on long audit
  lists: overflow clipping moved from `overflow-wrap: anywhere` to
  `overflow-wrap: break-word` (same visible wrapping, cheaper min-content
  layout), audit entries and actor rows render through `content-visibility: auto`
  with estimated intrinsic sizes so offscreen frames do not re-run layout
  during the resize loop, and the sheet toolbar sticky band paints an explicit
  background instead of inheriting the sheet gradient every frame. The results
  table stays a real table: content-visibility does not apply to internal
  table boxes.

## 1.0.3 — 2026-11-01

- Attributed the source licence headers to the same holder the README Licence chapter names so every module surface carries the same copyright holder.

- All notable changes follow Keep a Changelog structure and Semantic Versioning.

## 1.0.2 — 2026-10-31

- Renamed the unpublished module id to `runyth-character-audit-ledger`.
- Licensed the program under AGPL-3.0-or-later.
- Published install, source, and documentation archives as `-mod`, `-src`, and `-doc`.

## 1.0.1 — 2026-09-22

- Fixed the Foundry VTT 13.351 ApplicationV2 dashboard render failure by nesting the full-reader dialog inside the existing `main` part root, guaranteeing exactly one top-level HTMLElement.
- Kept loading, empty, populated, filtered, permission-restricted, and reader-dialog states inside the same stable dashboard root without ApplicationV1 fallback or warning suppression.
- Hardened read-time handling of malformed or legacy audit records so invalid records cannot crash dashboard queries or result rendering; persisted audit data is not rewritten.

- Added structural ApplicationV2 part tests that reject multiple roots, top-level Handlebars branches, top-level comments, or non-whitespace text.
- Added regression coverage for empty, singleton, many-entry, zero-result, populated-filter, search, sorting, rerender binding, permissions, optional Tidy integration, and malformed legacy-record paths.

- Source releases now retain the repository `.git` history.
- Documentation releases remain documentation-only and no longer include `module.json`.

## 1.0.0 — 2026-08-05

- System-agnostic auditing for player-owned Actor updates.
- Embedded Item and Active Effect create, update, and delete auditing.
- Generic semantic classifier plus a dnd5e currency and item-quantity adapter.
- GM-authoritative, serialized, chunked JournalEntry-page storage with configurable retention.
- At-least-once player queue with primary-GM acknowledgement and deduplication cache.
- ApplicationV2 GM dashboard with scalable character selection, filtering, highlighting, and remembered geometry.
- Combined and per-character JSONL/CSV exports.
- Per-character toggles for default Actor-sheet and Tidy 5e sheet tabs.
- Owner-only self-audit views and explicit per-character full-log reader permission, including GM changes.
- Supported Tidy 5e `HandlebarsTab` integration and render-hook default-sheet adapter with accessible fallback.
- English and German modular localization.
- Secret-path redaction, payload bounds, CSV formula-injection mitigation, and permission validation.
- Public classifier/adapter API, automated tests, static validation, architecture/security documentation, and reproducible release tooling.
