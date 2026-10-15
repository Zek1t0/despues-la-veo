# Section 2 validation — expanded media persistence

Date: 2026-10-09. Change: `add-expanded-media-domain-and-second-provider-foundation`.
Scope: tasks **2.1–2.7 only**, after the checkpointed Section 1. No Section 3+ implementation.

## Result and task coverage

Current SQLite schema/user_version: **5**. Current exported backup: **6**. Dispatcher accepts **v1, v2, v3, v4, v5 and v6**; each historical parser validates its own frozen shape before conversion. Historical validator files v1–v5 were not modified in this section.

| Task | Implementation and evidence |
| --- | --- |
| 2.1 | Direct fresh v5 installation and transactional v4→v5 reconstruction of parent and all three dependent tables with foreign keys ON. Independent required medium and nullable family/format, vocabulary/matrix CHECK constraints, no active type column. Historical chain through v4 remains and then reaches v5. SQL copies raw data without clock/materialization calls, verifies counts, bidirectional equality, classification conversion, indexes and foreign keys before publishing 5. |
| 2.2 | Current readers/writers use medium/content_family/primary_format directly. Writes validate classification before SQL. TMDB references require canonical movie/tv IDs and audiovisual medium, never namespace=local-format. Expanded resources persist without the historical lossless projection; WithDb/queue/transaction composition and cascades preserved. |
| 2.3 | Separate current libraryBackupV6 parser/exporter and dispatcher branch. Required nullable keys, no active type, rating/references/duplicates/legacy identity/pins/metadata validation. Historical DTOs and validators retained unchanged; historical family is omitted from update representation and defaults to null on insertion. |
| 2.4 | Complete-reference/exact-legacy resolution, medium conflicts before metadata/reference/pin application, freshness and field presence preserved. Eligible newer v6 restores explicit null or different valid non-null family/format. Historical absence preserves known family; historical type supplies audiovisual medium and movie/tv format. Provider refresh remains monotonic and separate. |
| 2.5 | Local-ID collision remapping only with portable identity, local-only occupied-ID conflicts, divergent identity conflicts, compatible additive references, item/pin savepoints and final-ID pin mapping. Counts/mappings are published only after successful item savepoint release. Appearance remains a separate deferred operation after successful restore commit and reports its actual persistence outcome. |
| 2.6 | Real SQLite rollback at six migration hook stages, two actual verification corruption failures, invalid v4 type and future schema. Recovery/reopen and historical migration chain pass. No downgrade implementation. |
| 2.7 | Actual Ajustes export/import uses v6 and reports v1–v6 support with compatible-medium merge language. Existing download/picker/share, partial reports and Appearance flow retained. Real web import/export/reopen smoke completed with synthetic TEST data only. |

## Real SQLite migration matrix

Engine: Node `node:sqlite` DatabaseSync. All new migration tests enable `PRAGMA foreign_keys=ON` and verify it stays enabled after failures. No migration claim relies solely on mocks.

- Empty fresh database → direct v5; no row migration.
- Historical valid v0 with an existing parent, v1, v2 and v3 → unchanged historical chain → v4 → v5 (existing universal-identity suite).
- Valid v4 movie, TV and manual rows → audiovisual/null/movie or audiovisual/null/tv, with no anime inference from an anime-looking title or Animation genre.
- Valid v5 reopen verifies the schema without remigration or data/timestamp changes, including closing a file-backed SQLite connection and reopening that same database in a new connection.
- Unsupported future SQLite user_version 6 rejects with unchanged contents/version.
- Invalid v4 type anime rejects without coercion/reset; exact original v4 snapshot survives.
- v4 data equality includes every non-taxonomy column, createdAt/updatedAt, raw metadata JSON, personal rating/status/tags/notes, local IDs, complete provider references, exact whitespace-sensitive legacy identities, pins/pinnedAt, preferences and all dependent ownership relationships. FK targets point to saved_titles, not a renamed old parent; foreign_key_check is empty.
- Failure injection: after target creation, item copy, dependent copy, before verification, before version publication and after version publication. Each leaves the exact original schema/data/user_version intact; subsequent retry succeeds.
- Actual verification failures: corrupt copied notes and drop the reference index. Both roll back the entire reconstruction.

**Rollback reality:** after a successful v5 migration, an older v4 application is not expected to read this database. Returning to the older app requires restoring a pre-migration v4 copy. There is no lossy automatic v5→v4 conversion, and this section does not create such a copy automatically.

## Backup validation, round-trip and merge matrix

New real-SQLite tests cover all ten requested classifications:

- audiovisual/null/movie; audiovisual/anime/tv; audiovisual/anime/ova;
- comic/manga/null; comic/manga/one-shot; comic/manhwa/webtoon; comic/manhua/null; comic/null/null;
- literature/null/novel; literature/null/light-novel.

Round-trip preserves snapshots, complete references, personal rating, TMDB voteAverage, tags, notes, status, timestamps, pins and Appearance. OVA + tmdb/movie and audiovisual/null/null + tmdb/movie validate; no permanent namespace/format invariant. tmdb/movie/77 and tmdb/tv/77 remain separate items and pins.

v1–v5 each have successful insertion and newer update into an anime item with family preservation, plus rejection of manga type and rejection of a current classification replacing the historical required type. Original historical validator files remain unchanged, including v5's historical TMDB namespace/type validation and ID canonicalization behavior.

v6 tests required keys (including explicit nullable family/format), incompatible/unknown vocabulary, invalid personal rating, noncanonical TMDB ID/namespace, duplicate references/items and invalid metadata. Generic opaque references remain valid. Export rejects a local-only item without any portable reference or exact legacy identity; legacy-only local items round-trip without fabricating a provider. Defensive free-ID local-only import succeeds, occupied unresolvable ID conflicts.

Freshness tests include older/equal/newer v6 updates, explicit-null clearing of known family/format, valid different non-null replacement and preserved createdAt/local ID. Historical family omission stays absent-on-update. Existing field-presence behavior for optional metadata remains. Medium disagreements neither add references nor apply metadata/pins. Divergent resolved references never fuse. Compatible free references can be attached while stale metadata is skipped.

Item/reference failures, savepoint release failure and pin failures retain successful peers and truthful counters; failed items do not produce final-ID pin mappings. ID collisions with portable identities remap pins to the final ID. Tag changes clean inapplicable tag pins. Deletes cascade through references, legacy identities and pins; no orphans.

## Appearance

v6 export includes only available confirmed/default preference; unavailable Appearance is omitted and incompatible imported Appearance is reported separately. Current coordinator and Settings ordering are preserved.

New tests exercise the actual public serialized restore API with real SQLite transactions and a test-only DB binding: successful commit, injected pre-commit failure, partial pin failure and independent Appearance persistence failure. The deferred Appearance writer can run only after commit; pre-commit failure rolls back items, discards the handle and writes no Appearance. Partial item/pin outcomes remain truthful; an Appearance persistence failure never reports applied. Existing Appearance trust/availability/deferred-race suite also passes. Test bindings never call a personal production DB.

## Commands and final exit codes

| Command | Exit code |
| --- | --- |
| `node docs/testing/expanded-media-domain/section-1-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-2-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-1-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-3-persistence-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-11-verification.cjs` | 0 |
| `npx tsc --noEmit` | 0 |
| `openspec validate add-expanded-media-domain-and-second-provider-foundation --strict` | 0 |

The tsc command initially returned a running session; its final completion was explicitly polled and returned exit 0. The final focused migration/backup suite and tsc were repeated after adding disk-reopen coverage and explicit own-key checks, both exit 0. Section 1 and historical-v5 backup checks were also repeated. OpenSpec strict validation was repeated after task bookkeeping and passed with exit 0.

All twelve verification suites pass. Initial runs found outdated current-schema fixture/expected-version assumptions in prior suites; these were updated to current v5 while retaining their historical JSON inputs and migration seeds. Historical movie/TV disagreement tests now test an actual incompatible medium, because movie and TV are formats within the same audiovisual medium. The Section 1 storage test now proves the v4 projection is removed while retaining historical helper and provider-refresh tests. No historical validator was broadened or historical fixture weakened.

## Manual Settings/web smoke actually performed

Local Expo/Metro, existing dependencies only:

- `$env:CI='1'; npx expo start --web --port 8097`: initial sandboxed listener unavailable; stopped, no smoke success claimed for that server. Intentional Ctrl+C termination returned exit 1.
- `$env:CI='1'; $env:EXPO_OFFLINE='1'; npx expo start --web --localhost --port 8097`: approved local listener worked; stopped after restarting final source. Intentional Ctrl+C termination returned exit 1.
- `$env:EXPO_OFFLINE='1'; Remove-Item Env:CI -ErrorAction SilentlyContinue; npx expo start --web --localhost --port 8097`: final source served locally with watch enabled. Development servers were stopped after verification, rather than left running; intentional Ctrl+C termination returned exit 1, not a verification failure. Temporary browser tabs were closed.

Browser control used the real app at http://localhost:8097/ajustes and http://127.0.0.1:8097/ajustes, separate browser origins for synthetic test state, not an application review harness. No personal production DB was opened by test code. TMDB configuration visibly remained Not configured; no discovery search/API call was needed.

Observed via actual buttons, file chooser, confirmation dialog, DOM/accessibility state and screenshots:

1. Current explanatory label says export v6 and import v1–v6; controls are available.
2. Empty export completed: 0 titles, 0 pins, Appearance included.
3. TEST synthetic v6 file validated 10 valid items, 10 valid pins, 0 invalid entries and the existing confirmation message.
4. First confirmed import on 127.0.0.1 origin: **10 inserted, 10 pins inserted**, zero skipped/conflicts/invalid/failed items or pins; Appearance applied and saved.
5. Repeated confirmed import on localhost origin: **10 skipped, 10 pins preserved**, zero conflicts/invalid/failed entries; Appearance actually applied and saved.
6. Actual download reported **v6, 10 titles, 10 pins, Appearance included**. The downloaded JSON was read from the browser-returned path and compared against the synthetic input: every item snapshot and reference matched (reference array order canonicalized), every pin matched and Appearance matched. The captured export is TEST-section2-web-export-v6.json.
7. Ajustes was reloaded successfully against the persisted v5 database; no reset/remigration error surfaced. The succeeding repeat/export used persisted data.

Screenshots: section-2-settings-import-web.jpg and section-2-settings-web.jpg. At the normal 1280×720 viewport, the screenshot shows the beginning of the restore result; the full pin/Appearance outcome was also verified in the accessibility/DOM state. No UI layout change was introduced to expand the result view.

Warnings: Node's experimental SQLite notice; existing Metro NO_COLOR/FORCE_COLOR warning; Browserslist data is 9 months old; offline dependency validation skipped. No dependency/toolchain update was performed. Browser file-selection/dialog timing required recovery of a temporary tab; only subsequently observed completed outcomes are claimed.

No physical Android/iOS manual verification was performed. Full visible browsing/local-detail/mobile adaptation belongs to Section 3; Section 2 persistence/domain behavior has real-SQLite and web coverage, and compilation passes.

## Files created

- `src/core/libraryBackupV6.ts`
- `docs/testing/expanded-media-domain/section-2-settings-import-web.jpg`
- `docs/testing/expanded-media-domain/section-2-settings-web.jpg`
- `docs/testing/expanded-media-domain/section-2-verification.cjs`
- `docs/testing/expanded-media-domain/TEST-section2-backup-v6.json`
- `docs/testing/expanded-media-domain/TEST-section2-web-export-v6.json`
- `docs/testing/expanded-media-domain/section-2-validation.md`

## Files modified

- `src/core/libraryBackup.ts`
- `src/storage/databaseSchema.ts`
- `src/storage/libraryBackupExport.ts`
- `src/storage/libraryBackupMerge.ts`
- `src/storage/savedTitleIntegrity.ts`
- `src/storage/savedTitleStorage.ts`
- `src/storage/titlePinsRepo.ts`
- `app/(tabs)/ajustes.tsx`
- `docs/testing/expanded-media-domain/section-1-verification.cjs`
- `docs/testing/global-appearance-themes/section-11-verification.cjs`
- `docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs`
- `docs/testing/provider-abstraction/section-5-detail-verification.cjs`
- `docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs`
- `docs/testing/universal-media-identity/section-3-persistence-verification.cjs`
- `docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs`
- `docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs`
- `openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md`

## Boundaries and protected data

Only task checkboxes 2.1–2.7 were newly completed. 1.1–1.5 remain complete; tasks 3.1 onward remain unchecked. Overall: **12/39 tasks complete**, 27 remain. No required Section 2 criterion remains incomplete.

No Search category architecture, fixture/review harness, new provider API/client/network path, registry, progress, relations, linking/fusion, ratings-source system or Section 3 UI adaptation was introduced. TEST backup files and screenshots are verification artifacts, not a production catalog/adapter or a provider special case in the importer. Historical projection helpers remain for explicit historical backup compatibility, but current persistence/current export no longer use them.

package.json SHA-256 before/after: `262E90681FAFF16686F79D3F14CE6A6CAE158442D432038F31616B4E2E990C78`. Unchanged, including `android: expo run:android` and `ios: expo run:ios`. No dependencies added. No Git operation, staging, commit, push, reset, stash or branch change was performed.
