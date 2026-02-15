# CAAMP LAFS Compliance Profile

## Canonical protocol authority

- LAFS spec: `https://github.com/kryptobaseddev/lafs-protocol/blob/main/lafs.md`
- LAFS package: `@cleocode/lafs-protocol`

This document defines CAAMP adoption scope and evidence mapping only.

## Adopted version

- Package baseline: `@cleocode/lafs-protocol@^0.1.1`
- Registry and schema source: package exports and `schemas/v1/*`

## Scope

LAFS is currently applied to CAAMP advanced command output helpers in:

- `src/commands/advanced/lafs.ts`

## Compliance mapping

| LAFS Clause | CAAMP Component | Evidence | Status |
|---|---|---|---|
| 4.1 Format semantics | `runLafsCommand()` output and error paths | `src/commands/advanced/lafs.ts` | compliant |
| 5 Canonical envelope | Success/error envelopes use LAFS schema id and shape | `src/commands/advanced/lafs.ts` | compliant |
| 6 Error contract | Error category + retry fields + registered code fallback | `src/commands/advanced/lafs.ts` | compliant |
| 8 MVI/progressive disclosure | `mvi` metadata flag + `--details` expansion behavior in advanced commands | `src/commands/advanced/*.ts` | compliant |

## Local deltas (CAAMP-local)

None currently declared.
