# Changelog

All notable changes follow Keep a Changelog structure and Semantic Versioning.

## [1.0.1] - 2026-09-22

### Fixed

- Fixed the Foundry VTT 13.351 ApplicationV2 dashboard render failure by nesting the full-reader dialog inside the existing `main` part root, guaranteeing exactly one top-level HTMLElement.
- Kept loading, empty, populated, filtered, permission-restricted, and reader-dialog states inside the same stable dashboard root without ApplicationV1 fallback or warning suppression.
- Hardened read-time handling of malformed or legacy audit records so invalid records cannot crash dashboard queries or result rendering; persisted audit data is not rewritten.

### Tests

- Added structural ApplicationV2 part tests that reject multiple roots, top-level Handlebars branches, top-level comments, or non-whitespace text.
- Added regression coverage for empty, singleton, many-entry, zero-result, populated-filter, search, sorting, rerender binding, permissions, optional Tidy integration, and malformed legacy-record paths.

### Packaging

- Source releases now retain the repository `.git` history.
- Documentation releases remain documentation-only and no longer include `module.json`.

## [1.0.0] - 2026-08-05

### Added

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
