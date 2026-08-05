# Security and trust model

## Protections implemented

- Storage journals grant default ownership `NONE`; only GMs receive the full collection data.
- Players query through a GM-mediated socket path rather than reading storage documents.
- Every player query requires current Actor Owner permission.
- Self-audit mode forcibly filters entries to the requesting user ID.
- Full-log access is stored per Actor and is accepted only for current non-GM Owners.
- The primary GM replaces Actor name/UUID, user name, system ID, category, highlight state, summary, and receipt time.
- Entry IDs, actions, document types, changed paths, and payload counts are validated.
- Secret-like path names are redacted recursively.
- Values are bounded by depth, object/array size, and string length.
- CSV export prefixes formula-like string cells to reduce spreadsheet formula injection risk.
- Writes are serialized to avoid page rotation and index update races.
- Player entries remain queued until acknowledged, reducing loss during GM disconnects.

## Inherent limitation

Foundry's `preUpdateDocument` hook executes only on the client initiating an update. That client is therefore the only client that can observe exact pre-change values without replacing Foundry's update workflow. Native module socket messages also do not provide a cryptographic attestation mechanism to another module client.

Consequently, Character Audit Ledger is designed for normal operational accountability. It prevents ordinary UI users from reading or modifying the stored ledger, but it cannot prove that a deliberately modified client reported every change honestly. It is not suitable as a legal, financial, anti-cheat, or cryptographically tamper-evident forensic record.

## Operational recommendations

- Keep Foundry and game-system versions patched.
- Restrict direct server and user-data-directory access.
- Back up the world before upgrades and before changing retention downward.
- Export JSONL periodically when long-term retention is required.
- Grant full-log sheet permission only to trusted Actor Owners.
