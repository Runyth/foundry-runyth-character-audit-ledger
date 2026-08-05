# Changelog

All notable changes follow Keep a Changelog structure and Semantic Versioning.

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
