# Compatibility report

## Supported baseline

- Foundry VTT v13 manifest minimum `13`, verified `13.351`, maximum `13`.
- Tidy 5e Sheets is optional and integrated through its documented API.
- The included dnd5e adapter targets the stable dnd5e 5.3.x data paths used by Tidy 5e v13.7.0.

## Sheet integration strategy

| Sheet | Integration | Failure behavior |
|---|---|---|
| Tidy 5e character sheet | `tidy5e-sheet.ready`, `api.models.HandlebarsTab`, `api.registerCharacterTab` | Logs an error and leaves the sheet unchanged if the supported API is unavailable. |
| Foundry ActorSheetV2/default sheets | `renderActorSheetV2` and semantic tab-container discovery | Adds a standard tab when recognizable. |
| Legacy/custom Actor sheets | `renderActorSheet` compatibility hook | Adds the same tab where possible; otherwise adds an explicit accessible collapsible panel button. |

No private Tidy internals, prototype overrides, wrappers, or hard dependency are used.

## System-agnostic scope

Guaranteed generic capture:

- Actor document updates;
- embedded Item create/update/delete;
- embedded Active Effect create/update/delete;
- ownership, identity, prototype-token, and arbitrary `system.*` paths;
- exports, filtering, storage, permissions, and sheet views.

System-specific semantics:

- Exact meaning of money, quantity, charges, and attributes varies by system.
- Generic names are classified heuristically.
- A system adapter can supply exact path rules without changing storage or UI code.

## Runtime-validation status

The release was statically validated and tested outside Foundry. A licensed Foundry runtime and live Tidy installation were not available in the build environment, so interactive runtime smoke testing is documented as pending rather than claimed as completed.
