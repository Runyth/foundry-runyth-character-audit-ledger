# Test and validation report

Date: 2026-09-22
Release: 1.0.1

## Automated result

| Check | Result |
|---|---|
| Node unit/static tests | 26 passed, 0 failed |
| JavaScript syntax validation | Passed for every runtime `.mjs` file |
| JSON parsing | Passed for manifest, package metadata, and both locales |
| Manifest file-reference validation | Passed |
| English/German localization key parity | Passed |
| ApplicationV2 main-part root invariant | Passed: exactly one top-level HTMLElement |
| Top-level Handlebars/helper/comment guard | Passed: none outside the part root |
| Reader dialog containment | Passed: dialog is nested inside the `main` root |
| Dashboard rerender listener guard | Passed by static regression guard |
| Empty/singleton/many-result filtering | Passed |
| Zero-result/populated filtering | Passed |
| Search and newest-first sorting | Passed |
| GM/owner/outsider audit permissions | Passed |
| Tidy 5e optional integration guards | Passed |
| Malformed/legacy record handling | Passed without persistent-data mutation |
| Storage active-page reuse and rotation | Passed with Foundry document fakes |
| Diffing, sensitive-field redaction, classification, CSV/JSONL | Passed |
| Private-wrapper / legacy application-base guard | Passed |

Commands executed:

```text
npm test
npm run validate
```

## ApplicationV2 regression

The v1.0.0 dashboard template had two sibling top-level elements: `.cal-dashboard__layout` and `.cal-readers-dialog`. Foundry v13 Handlebars ApplicationV2 parts require one top-level HTMLElement.

v1.0.1 keeps `.cal-dashboard__layout` as the sole part root and moves `.cal-readers-dialog` inside it. No part ID, action selector, filter selector, event-delegation target, or dashboard shell class was renamed. `AuditDashboard.PARTS` still contains exactly one part, `main`, and partial rerenders still target `parts: ["main"]`.

The structural regression test walks the HBS/HTML token stream and fails if the part contains:

- more or fewer than one top-level element;
- Handlebars helpers at template depth 0;
- HTML comments at template depth 0;
- non-whitespace text outside the single root;
- unbalanced or mismatched HTML tags.

Because all `{{#if}}`, `{{#each}}`, loading/status content, empty-state content, populated content, filters, and permission controls are nested below the static root, template context cannot change the root count.

## Requested scenario coverage

| Scenario | Coverage |
|---|---|
| First dashboard open | Structural single-root test + manifest/ApplicationV2 static validation |
| Zero audit entries | Unit test |
| One audit entry | Unit test |
| Many audit entries | Unit test (50 entries) |
| Filtered zero entries | Unit test |
| Populated filtered results | Unit test |
| Search | Unit test |
| Sorting | Unit test (newest first) |
| Repeated rerenders | Idempotent `_onRender` listener guard + single-part replacement static guard |
| Repeated open/close cycles | No global dashboard listener is installed; per-instance binding guard statically verified |
| World reload | Persistent storage/settings code unchanged; storage regression suite passed |
| GM access | Permission test + dashboard constructor guard |
| Non-GM behavior | Owner self-only, full-reader, and outsider-denial tests |
| Tidy 5e active/inactive | Optional API guards and both default-sheet hooks statically verified |
| Malformed/legacy records | Unit tests; invalid records are skipped or normalized at read time without persistence changes |
| Loading/error state | Status UI remains nested beneath the invariant part root; no top-level state branch exists |
| Foundry VTT 13.351 | Manifest target and v13 ApplicationV2 contract verified against official API documentation |

## Not executed

Interactive smoke testing inside a licensed Foundry VTT v13.351 world with a live browser, dnd5e, and Tidy 5e was not available in this build environment. No claim of live runtime verification is made. The automated/static tests specifically cover the template contract that caused the reported Foundry rendering exception.
