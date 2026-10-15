# Section 8 validation — MangaUpdates product vertical

Date: 2026-10-14. Change: add-expanded-media-domain-and-second-provider-foundation.
Scope: 8.1–8.3 only. 9.2 is not implemented or marked complete.

## Acceptance status

Tasks 8.1, 8.2 and 8.3 passed; progress 35/36. Task 9.2 remains unchecked and out of scope. Android is the validated native platform and is enabled. Web remains disabled because of CORS; iOS remains disabled because no iOS runtime was validated.

The physical-device checks were operated by the user because ADB touch injection was denied. Codex independently obtained runtime facts, inspected the app hierarchy and verified selected fields of the app-generated backup. The user confirmed the native search/detail/save/edit/refresh, restart/offline/recovery and available-TMDB-state checks, then confirmed the final import retained the personal data and did not duplicate the title. This does not claim an independently captured successful live TMDB query.

## Implementation boundary

Finite category resolution explicitly accepts TMDB movie/tv and MangaUpdates Manga/Manhwa/Manhua capabilities. Production wrappers gate the native platform before constructing/executing the real Section 6 adapter. Shared ProviderSearchCapability is unchanged. One category performs one source search. No registry, arbitrary provider execution, merged ranking, generic detail capability or generic route.

The explicit app/mangaupdates/series/[id].tsx route validates canonical decimal ID before work and gates platform before HTTP/cache. It reuses the Section 6 client and mangaUpdatesMaterializationInput, then the existing saveProviderTitle and full-reference lookup. Route generation/abort checks prevent stale detail or save completion from replacing another route. Local navigation uses the returned opaque ID. Creation defaults, refresh, personal fields, references and pins are still owned by existing core/storage code.

Search keeps query/category/source/sequence/retry identity and applies mutable TMDB configuration generation only to TMDB. Missing TMDB credentials never block MangaUpdates. MangaUpdates errors are presented separately, with bounded user retry for transient failures and no token/settings actions. Existing TMDB UI is preserved.

Mapping remains comic/manga|null-format, comic/manhwa|null-format, comic/manhua|null-format. There is no inferred webtoon/one-shot/novel or additional taxonomy. Novel and all other unsupported types are excluded by the Section 6 validators. Products always use the default omit cover policy: posterUrl null and existing placeholder; no image download, binary backup or offline cover claim. MangaUpdates inputs have initialTags [] and no own voteAverage property; generic creation yields local null and omitted refresh preserves an existing historical score.

## Attribution and offline locality

Remote detail visibly renders Datos: MangaUpdates with the canonical API source link. About adds the provider website credit after the existing product/TMDB credits, without altering TMDB/JustWatch attribution. Local detail derives source labels from valid complete MangaUpdates references, with no fetch or title heuristic. In-app source navigation is offered only on an enabled native platform; Web/iOS retain informational attribution and an explicit external provider website link. Unknown references remain untouched.

Local SavedTitle reading/editing, status Leyendo, notes/tags/personalRating/pins and backup remain provider-independent. Unit verification reads and restores MangaUpdates snapshots with HTTP disabled. No domain/storage/schema/importer implementation changed.

## Physical Android evidence and execution

- ADB initially listed no devices; the user connected the configured device during this run.
- Serial: 6def17ba; ADB model: 23129RA5FL; product sapphire_global/device sapphire; Android release 15.
- Existing installed app: com.zekito.despueslaveo, versionName 1.0.0/versionCode 1, DEBUGGABLE flag.
- Existing native development binary; this run served the current Android JS bundle through Metro/USB reverse on port 8081. No new native build/install, dependency change or production release claim.
- EXPO_PUBLIC_MEDIA_REVIEW=0, normal productive root. ADB hierarchy showed normal Biblioteca and tabs, empty initial library, no TEST UI.
- Sandbox-only ADB daemon/socket access initially failed. ADB and Metro were rerun with the required host permissions; the real Android bundle loaded. This was environment access, not a provider transport defect.
- Device denied ADB touch injection (INJECT_EVENTS). Native interaction was performed manually by the human operator; Codex did not bypass security controls.
- Berserk search/detail was confirmed by the user; a native hierarchy from the app showed title, description, approved genres, Datos: MangaUpdates and save action. Response success and type/ID admission used the real client, not Node fixtures. Exact HTTP status was not separately recorded.
- User confirmed the requested native block: save Berserk → Biblioteca/local detail, Leyendo, tag/note/personalRating, pin/unpin, re-save preserving edits, Solo Leveling Manhwa and The Ravages of Time Manhua details, and no Novel treated as comic.
- The operator later confirmed restart/offline/recovery/One Punch-Man/TMDB checks within available credential state. No independent successful live TMDB query was captured.
- The real app-generated v6 export was copied locally from app cache to /sdcard/Download/TEST-section8-native-backup-v6.json, without sending it to an external service or retaining its full contents in the repository. Selected fields verified: opaque local ID 4583152d-3701-4ce3-b6f4-51f75f970e7a; mangaupdates/series/51239621230; comic/manga/null; watching; personalRating 10; voteAverage null. Export had no tags/notes/pins, so it does not verify their native round-trip. No new export with those fields or completed native import was observed. User chose to defer this check; Android was disabled again. The generic two-database deterministic round-trip passed separately.
- An attempted screenshot coincided with another app; that accidental screenshot was immediately deleted from workspace/device and is not retained or used as evidence. No further screenshots were taken without an app foreground check.
- iOS is not available/validated on this Windows host and remains disabled. Desktop HTTP success is not native acceptance.

## Production Web and isolated review smoke

Production Metro ran with review flag 0 on localhost:8081. In-app browser actually verified: normal Biblioteca/root, no TEST banner, Buscar only Películas/Series, same Matrix query switched between those categories, unchanged missing-TMDB-credential message and token/settings actions, empty query reset, blocked direct MangaUpdates route, and About provider credit with original TMDB/JustWatch notice. No credential was requested, changed or printed. Live TMDB search was not possible in this fresh Web credential context.

Zero MangaUpdates HTTP is proved by executable platform-gate tests with forbidden-fetch stubs, including a direct remote route. Browser resource instrumentation was unavailable in the read-only evaluator; no successful network-log capture is claimed.

A separate Metro process with __DEV__ and EXPO_PUBLIC_MEDIA_REVIEW=1 on localhost:8082 opened /dev/media-review. Actual Web UI showed TEST banner, media-review-primary.db and media-review-restore.db, synthetic fixture list and explicit personal-DB exclusion. This was a smoke only; existing Section 5 isolation suites passed again. It is not native MangaUpdates acceptance.

## Deterministic tests and real SQLite backup

New Section 8 suites exercise platform visibility with both outcomes of a test-local Android validation boundary, finite exact-capability resolution, no Web/iOS HTTP even when Android is simulated enabled, strict ID/destination rejection, provider errors, unsupported Novel, cross-provider/category stale response/error ordering, retry/empty/debounce/config isolation, missing TMDB token, actual SearchScreen/detail hooks, stale detail, generic save invocation, attribution and null-cover placeholder.

Real node:sqlite databases exercise generic public saveProviderTitle with explicit DB handle, re-save identity/createdAt/clock, personal metadata and pins, genres/creation-only tags, known formats preserved under incoming null, medium mismatch without mutation, historical score omission preserved and number/null/undefined ownership rejection. Exporter/parser/merge are the real existing v6 implementations. Round-trip includes three families, large decimal series references, nullable primaryFormat, personal state/pins, multiple/unknown references, and unchanged SQLite user_version 5. No real catalog records are committed as fixtures: minimal payload is the existing original handwritten Section 6 shape.

## Initial failures and resolution

1. Section 6 static test forbade MangaUpdates imports/new remote route because Section 6 had no consumer. Replaced with checks that the finite catalog has no client/adapter HTTP implementation and the explicit route consumes the product gate; platform activation now follows the explicit Android validation boundary. Section 4 similarly permits only the boundary-approved Android categories; Web/iOS remain unchanged. Both simulated outcomes are independently tested in Section 8.
2. Universal identity test matched item.providerReferences as legacy item.provider. Added word boundaries; legacy item.provider/item.externalId remain forbidden.
3. TMDB attribution test hardcoded two total About links; the required third MangaUpdates credit now has an explicit primitive assertion and updated count. Original TMDB/JustWatch URL/notice/accessibility assertions remain intact.
4. No real domain/storage/migration regression was found and no product fix outside Section 8 was needed.

## Commands and final exits

All 44 deterministic scripts below exited 0 after the stale assertions were corrected. The Section 5 generated TEST JSON was preserved byte-for-byte around batch execution. Live verification scripts were excluded; deterministic tests never query providers.

| Command | Exit |
| --- | --- |
| `node docs/testing/expanded-media-domain/section-1-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-2-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-ui-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-4-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-5-ui-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-5-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-6-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-8-ui-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-8-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-1-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-3-persistence-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-1-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-2-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-3-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-4-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-5-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-1-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-10-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-11-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-12-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-2-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-3-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-4-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-5-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-6-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-7-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-8-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-9-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-1-badge-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-1-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-2-integration-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-2-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-3-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-4-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-5-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-6-verification.cjs` | 0 |
| `npx tsc --noEmit` | 0 |
| `openspec validate add-expanded-media-domain-and-second-provider-foundation --strict` | 0 |
| `git diff --check -- <Section 8 changed paths>` | 0 before pause; one extra EOF blank line was corrected |

After resume and completed native import, the final Android-enabled configuration passed Section 4, Section 5 UI/isolation, Section 6 and both Section 8 suites again (all exit 0), plus npx tsc --noEmit (exit 0). Both disabled/enabled Android boundaries are exercised by Section 8 tests. Temporary Metro servers were stopped during the earlier pause; the normal development server was restarted for the resumed native import.

## Files created

- app/mangaupdates/series/[id].tsx
- src/components/search/mangaUpdatesSearch.ts
- src/providers/mangaupdates/availability.ts
- src/providers/mangaupdates/product.ts
- src/providers/mangaupdates/errorPresentation.ts
- docs/testing/expanded-media-domain/section-8-verification.cjs
- docs/testing/expanded-media-domain/section-8-ui-verification.cjs
- docs/testing/expanded-media-domain/section-8-validation.md

## Files modified

- app/(tabs)/buscar.tsx
- app/title/[id].tsx
- app/settings/about.tsx
- src/components/search/searchCategories.ts
- src/providers/mangaupdates/attribution.ts
- src/providers/mangaupdates/errors.ts
- docs/testing/expanded-media-domain/section-4-verification.cjs
- docs/testing/expanded-media-domain/section-6-verification.cjs
- docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs
- docs/testing/tmdb-user-credential/section-5-verification.cjs

- openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md: only 8.1–8.3 marked complete; all other checkboxes unchanged.

## Remaining constraints and exclusions

The existing Section 6 engineering/provider eligibility policy is reused; no new provider permission or legal clearance is claimed. Retention/export/commercial scope, numeric official quota/TTL and cover/hotlink rights remain unresolved for wider release review. Covers stay null. CORS remains blocked; no Web enablement, Origin/User-Agent spoofing, proxy or backend. No iOS claim, anime remote provider, Novel/literature delivery, registry, ratings model, matching/fusion, chapters/progress or unrelated scope.

SQLite remains v5, backup remains v6. Domain/persistence/backup implementations, package.json (including personal android/ios scripts), package-lock.json and dependencies remain byte-identical to this run's baseline. No Git mutation, stage/commit/push/checkout/reset/stash or review bundle. Task 9.2 and prior completion states remain unchanged.

## Resumed native backup acceptance

The first Downloads copy was later found to be empty. The copy procedure was corrected by reading the original app cache export, validating JSON v6, writing a temporary UTF-8 file, pushing it with adb and comparing destination contents exactly. The temporary PC copy was deleted. This was a validation-file transfer error, not a product exporter/importer bug. The first valid file (2310 bytes) imported as one omitted item because local data was equal/newer, as expected.

The operator then generated a new export with personal metadata and an active pin. Its filename was despues-la-veo-backup-2026-10-15T02-03-02-522Z.json (provider-independent export UTC timestamp). The 2507-byte JSON v6 was verified identical at /sdcard/Download/TEST-section8-native-backup-v6.json. Selected fields verified without printing note/tag contents: local ID 4583152d-3701-4ce3-b6f4-51f75f970e7a; mangaupdates/series/51239621230; comic/manga/null; watching; nonempty note; one tag; personalRating 10; one pin; voteAverage null. The local ID and canonical large string reference match the earlier export.

The user imported this JSON in the existing native development installation and confirmed that the personal data/pin were retained without a duplicate ("todo correcto"). Reimport into the same database may correctly omit an equal/newer item; it is not evidence of inserting into an empty native database. Actual restore into a second empty database, all three families, multiple/unknown references and null-format round-trip are covered separately by the real SQLite deterministic suites. No personal title was deleted to force an insert, and no fixture sentinel or new backup contract was introduced.

With this remaining native check completed, the Android validation constant is true. Web/iOS remain false, covers remain null, and 9.2 remains pending. No package/dependency/persistence version or Git mutation was introduced.
