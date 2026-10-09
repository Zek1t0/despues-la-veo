# Section 1 — Domain evolution verification

Change: `add-expanded-media-domain-and-second-provider-foundation`. Scope: tasks 1.1–1.5 only. Verified 2026-10-09. No Git operations or external API requests were performed.

## Results by task

| Task | Implementation and verification |
| --- | --- |
| 1.1 | MediaClassification vocabulary and full compatibility matrix; required known medium, nullable family/format; deterministic historical movie/TV conversion without inference. Exhaustive medium/family/format combinations plus invalid/missing tokens pass. |
| 1.2 | Active SavedTitle and portable snapshot no longer contain type. Historical DTOs are independent; TMDB retains movie/TV namespaces. Reference-only TMDB module avoids circular materializer imports. Canonical reference/medium validation allows anime OVA with movie reference without permanent format equality. |
| 1.3 | New classification copied; refresh fills unknowns and preserves known values under null/disagreement; medium mismatch rejected. Explicit own-property voteAverage validation rejects no-TMDB ownership, undefined and nonfinite data; omission preserves existing score or defaults new to null. Personal state, timestamps, references, genres and creation-only initialTags verified through pure and actual SQLite WithDb/serialized repository tests. |
| 1.4 | Shared Spanish classification, medium-aware watching and year labels; no new status tokens. All requested examples and nullable fallbacks tested. |
| 1.5 | Minimal current consumer adaptations use classification or normalized display labels; existing movie/TV filters remain the only options. Lossless transitional projection keeps SQLite v4 and backup v5 functional, with frozen historical validators. TypeScript passes. |

## Deliberate Section 2 boundary

`legacyMediaBoundary.ts` is a temporary adapter, not a second domain authority. Reads of current v4 rows convert the historical type. Writes/export accept only audiovisual/null/movie or audiovisual/null/tv, which are exactly representable by current persisted formats. A family, OVA, comic, literature or unknown format that would be lost is rejected before any write rather than flattened. The pure domain/materializer supports all approved classifications; expanded persistence remains Section 2. The v4 projection must be removed when v5/v6 are implemented; frozen historical import DTOs remain.

No schema/PRAGMA changes, table rebuilds, backup v6, category architecture, dev review UI, fixture provider, new network provider or source-aware rating system were implemented. The synthetic values in the automated test are test-only and never enter personal storage.

## Commands and final results

All commands below completed with exit code **0**. SQLite tests emit Node's existing experimental node:sqlite warning; there were no assertion or compile failures in the final run.

| Command | Result |
| --- | --- |
| `node docs/testing/expanded-media-domain/section-1-verification.cjs` | Classification, monotonic refresh, rating ownership/presence, labels, real SQLite no-write rejection and unchanged v4/v5 round-trip PASS |
| `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | TMDB mapping PASS |
| `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | Existing normalized Buscar boundary/debounce/credentials/navigation PASS |
| `node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs` | Pure materialization and real serialized/transactional generic save/refresh/reference ownership/concurrency PASS |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | Actual TMDB screen hook-host, mapping, save/re-save and enrichment PASS with mocked UI/network |
| `node docs/testing/universal-media-identity/section-1-verification.cjs` | Identity and independent namespace/classification contracts PASS |
| `node docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs` | Existing v4 schema/migration/rollback PASS |
| `node docs/testing/universal-media-identity/section-3-persistence-verification.cjs` | Historical v3→v4 runtime integration PASS |
| `node docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs` | Backup v5 and historical imports PASS |
| `node docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs` | Existing runtime consumers PASS |
| `npx tsc --noEmit` | PASS; no diagnostics |
| `openspec validate add-expanded-media-domain-and-second-provider-foundation --strict` | PASS |

Historical parsing validation was not broadened. Tests that previously expected active `type` snapshots were updated to classification; the old test expecting namespace/format disagreement to throw now accepts that valid combination. Existing pure/generic refresh tests now preserve known format and omit non-owned voteAverage.

No visual redesign or new UI surface was introduced. Existing persisted movie/TV labels and remote kindLabel presentation remain equivalent. The hook-host check does not replace browser visual QA; no manual browser/mobile review is claimed for this domain-only section.

## Files created

- `src/core/mediaClassification.ts`
- `src/core/historicalSavedTitle.ts`
- `src/core/legacyMediaBoundary.ts`
- `src/core/tmdbProviderReference.ts`
- `src/core/providerMaterializationValidation.ts`
- `docs/testing/expanded-media-domain/section-1-verification.cjs`
- `docs/testing/expanded-media-domain/section-1-validation.md`

## Files modified

- `src/core/savedTitle.ts`
- `src/core/providerSavedTitle.ts`
- `src/core/tmdbSavedTitle.ts`
- `src/core/savedTitleProviderReferences.ts`
- `src/core/presentationLabels.ts`
- `src/core/libraryView.ts`
- `src/core/libraryBackupV1.ts`
- `src/core/libraryBackupV3.ts`
- `src/core/libraryBackupV4.ts`
- `src/core/libraryBackupV5.ts`
- `src/providers/providerContracts.ts`
- `src/providers/tmdb/tmdbMappers.ts`
- `src/storage/savedTitlesRepo.ts`
- `src/storage/savedTitleStorage.ts`
- `src/storage/savedTitleIntegrity.ts`
- `src/storage/libraryBackupMerge.ts`
- `src/components/browsing/TitleGridCard.tsx`
- `app/(tabs)/buscar.tsx`
- `app/(tabs)/libreria.tsx`
- `app/(tabs)/etiquetas.tsx`
- `app/title/[id].tsx`
- `docs/testing/provider-abstraction/type-contract.ts`
- `docs/testing/provider-abstraction/section-4-type-contract.ts`
- `docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs`
- `docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs`
- `docs/testing/universal-media-identity/section-1-verification.cjs`
- `openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md` (checkboxes 1.1–1.5 only)

## Protected files and bookkeeping

SHA-256 before/after matches:

- `package.json`: `262E90681FAFF16686F79D3F14CE6A6CAE158442D432038F31616B4E2E990C78`
- `src/storage/databaseSchema.ts`: `C17CFEF90E598C19BF09D41AC00B70BA273CE53D07216A76EBB1189899031BBF`
- `src/storage/db.ts`: `B00A36B39036B64EA1C40C47D8CD584D629C1573F82C446CDD64FF82EF63581B`

SQLite stays at schema/user_version 4; backup remains version 5 with v1–v4 imports preserved. package.json and the personal `android: expo run:android` / `ios: expo run:ios` scripts are unchanged. No Git command, commit, staging or push occurred. No dependencies added.

Tasks 1.1–1.5 complete; 34 tasks in Sections 2–9 remain unchecked. No Section 1 requirement remains unimplemented. Expanded classification persistence is deliberately unavailable until Section 2, not silently approximated. The change as a whole is not complete or ready to archive.
