# Test and validation report

Date: 2026-08-05  
Release: 1.0.0

## Automated result

| Check | Result |
|---|---|
| Node unit tests | 17 passed, 0 failed |
| JavaScript syntax validation | Passed for every runtime `.mjs` file |
| JSON parsing | Passed for manifest, package metadata, and both locales |
| Manifest file-reference validation | Passed |
| English/German localization key parity | Passed |
| Storage active-page reuse and rotation | Passed with Foundry document fakes |
| Diffing, sensitive-field redaction, classification, filtering, CSV/JSONL | Passed |
| Private-wrapper / legacy application-base guard | Passed |

Commands executed:

```text
npm test
npm run validate
```

## Defects found and corrected during testing

1. Sensitive values were redacted before equality comparison, causing a changed sensitive field to disappear from the log. Comparison now occurs on raw bounded values, while persisted before/after values remain redacted.
2. The storage record did not return its active page ID, which would have rotated to a new page for every entry. Active-page reuse now has dedicated regression coverage.
3. Initial offline queues were not flushed because a `ready` hook was registered after `ready`. Activation now flushes immediately and retains the periodic/user-presence retry paths.

## Not executed

Interactive smoke testing inside a licensed Foundry VTT v13.351 world with live dnd5e 5.3.x and Tidy 5e v13.7.0 was not available in this build environment. No claim of live runtime verification is made.
