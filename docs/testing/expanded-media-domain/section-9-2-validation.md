# Task 9.2 — final integrated regression

Date: 2026-10-14 (America/Buenos_Aires).
Branch verified read-only: feat/anime-manga-provider.
Change: add-expanded-media-domain-and-second-provider-foundation.
Scope: **task 9.2 only**, after checkpointed Sections 1–6, 8.1–8.3 and 9.1.

## Result and completion boundary

PASS. All 44 materially relevant deterministic verification scripts were executed again for this milestone and exited 0 on their first run. TypeScript passed. Actual production Web and opt-in review smokes passed. A fresh focused smoke on the connected physical Android was operated and confirmed by the user. Only 9.2 is marked complete: **36/36**. This is not an archive or release; external final-diff review and checkpoint remain required.

No application code, test assertion, dependency, schema or provider policy was changed. Created this report and changed the 9.2 checkbox only. The pre-existing package.json personal edit was preserved byte-for-byte, including android=expo run:android and ios=expo run:ios.

## Final platform matrix

| MangaUpdates runtime | Product availability | Evidence |
| --- | --- | --- |
| Android | Enabled | Completed Section 8.3 physical acceptance; fresh small 9.2 native smoke confirmed by operator |
| Web | Disabled | Categories hidden; direct route unavailable; executable forbidden-fetch/platform-gate tests |
| iOS | Disabled | Not validated on Windows; no support claim |

ADB listed the same device, serial 6def17ba and model 23129RA5FL. Android release 15 was read again. No additional device facts are inferred. Android availability remains based on the completed native acceptance, not desktop HTTP, browser width or fixtures. TMDB remains independent and follows its own credential state.

## Fresh manual production Web smoke

Used the existing normal development server at http://localhost:8081 with review mode off. The in-app browser actually visited and inspected:

- Normal Biblioteca root, its status/classification controls and local empty-library state; no TEST banner or fixture catalog. Local classification filters can include Anime/Manga/etc.; these are not remote search controls.
- Buscar with only Películas and Series. No Manga, Manhwa, Manhua or Anime remote controls.
- Matrix entered in Películas, then the same query switched to Series; category/input label updated and existing TMDB credential UI remained specific to TMDB. The query was then cleared.
- Current Web credential context reports TMDB no está configurado, with Obtener token/Configurar TMDB actions. No credentials were requested, printed or changed. No live TMDB success is claimed.
- Etiquetas opened with its normal empty-state/search/options presentation.
- Ajustes opened normally with Appearance, TMDB status, v6 export and historical v1–v6 import description.
- About opened through its real button: existing TMDB notice and JustWatch attribution/link intact; Datos: MangaUpdates and provider link visible, with independent-app/no-endorsement wording.
- Direct /mangaupdates/series/51239621230 hydrated to the explicit unavailable-on-this-platform message; no save/detail functionality was offered.

Zero MangaUpdates product HTTP is established by the executed forbidden-fetch/platform-gate tests, including cache/diagnostic override rejection and direct route gating. Browser network instrumentation was not captured and is not claimed. Local imported MangaUpdates snapshots, editable personal fields, source labels and unavailable in-app navigation are verified by the real SQLite/hook-host suites without network, rather than inserting test data into the production Web database.

## Fresh review-mode smoke and isolation

Started a separate process without script changes:

PowerShell: set EXPO_PUBLIC_MEDIA_REVIEW=1 and EXPO_OFFLINE=1, then npx expo start --localhost --port 8122.

Opened http://localhost:8122/dev/media-review in a separate browser tab/origin. Actual UI showed:

- TEST · revisión de medios · DBs aisladas banner.
- media-review-primary.db and media-review-restore.db.
- Original synthetic fixture catalog, test library/restore controls and explicit personal-DB exclusion.

This was a small fresh boot smoke, not a repeat of the entire Section 5 walkthrough and not evidence of MangaUpdates native acceptance. Executed Section 5 suites separately verify __DEV__ AND exact flag=1, release/opt-out normal root, zero personal initDb/theme/preferences/credential access, separate DBs, reset only captured review names, real generic save/materialization/backup reuse and zero provider/catalog HTTP. No release build was compiled in 9.2; release exclusion was exercised by those deterministic gating tests.

The temporary 8122 review server was stopped after the smoke. The pre-existing normal server was reused rather than replaced; it was not started or reconfigured by 9.2. EXPO_OFFLINE controls Expo CLI checks, not simulated provider responses.

## Fresh Android smoke and historical acceptance

The same physical Android was readily connected. Because Section 8 had established that device security rejects ADB touch injection, the final smoke was manually operated by the human user, without bypassing security or repeating the exhaustive acceptance.

The exact requested small checklist was normal app/no TEST, Películas/Series/Manga/Manhwa/Manhua visible, one real Berserk Manga search and remote detail, then the saved Berserk opened from Biblioteca. The operator explicitly confirmed all three steps ("sip"). This is fresh native smoke evidence, distinct from the historical Section 8 acceptance.

Codex independently checked ADB connectivity/model and Android release. A guarded native hierarchy attempt was skipped because the app was not foreground at that instant; no unrelated app screenshot or UI was captured. No new native build/install or independently captured HTTP status is claimed.

The broader search/detail/save/re-save/edit/pins/restart/offline/recovery/backup acceptance remains the historical evidence in [Section 8 validation](section-8-validation.md), including its resumed native backup acceptance. That record identifies a valid 2507-byte v6 export with the same opaque local ID, canonical large MangaUpdates series reference, comic/manga/null, note, tag, personal rating and pin, followed by user-confirmed reimport without loss/duplication. Reimporting equal/newer local data may correctly omit it; neither milestone claims that this was insertion into an empty native database. Empty-target restore is verified separately in real SQLite.

No full native offline/backup walkthrough was repeated for 9.2. iOS remains unvalidated and disabled.

## Executed coverage and inspected final invariants

| Area | Final regression evidence/result |
| --- | --- |
| Local taxonomy | Section 1 and runtime suites retain audiovisual/comic/literature, exact family/format vocabulary and null; invalid matrix combinations reject. Anime requires audiovisual; manga/manhwa/manhua require comic; literature family null. No new tokens. |
| Namespace/identity | Opaque local IDs and complete references remain independent. anime/OVA with tmdb/movie remains valid; mangaupdates/series does not impose a local format. Strict positive decimal string IDs preserve large values and reject malformed/unsafe numeric inputs. No arbitrary provider routes or automatic matching/fusion. |
| Refresh vs restore | Medium mismatch rejects before write; local null refines; known classification survives incoming null/conflict while other metadata can refresh. Backup newer explicit v6 null can clear eligible family/format; historical absent fields do not become erasure. |
| Ratings | TMDB finite/null updates remain valid; no-TMDB number/null/undefined own-properties reject. MangaUpdates mapper/input omit voteAverage entirely, creation defaults local null, omitted refresh preserves historical score. Personal rating stays 10..100 or null. |
| Browsing/personal state | Library TMDB rating-desc uses finite voteAverage only, missing last, deterministic ties/pin grouping; no personal/provider-score fallback. Status/tags/notes/rating/pins/ID/createdAt/references survive appropriate refresh/import; clocks and freshness remain tested. Genres refresh; initialTags [] is creation-only. Leyendo/Viendo/En curso semantics retain their existing contracts. |
| SQLite | Real node:sqlite suites cover fresh v5, historical evolution/reopen, FK ON, constraints, cascades/no orphan refs/pins, rollback and future-version rejection. PRAGMA user_version remains 5. No new migration. |
| Backup | Historical v1–v5 validation/conversion and current v6 dispatcher/export/import/merge, older/equal/newer, nullable/absent, ID/createdAt, partial restore, Appearance, pins, multiple/unknown references, portable local-only rules and OVA+movie pass. Real-style MangaUpdates three-family/null-format/large-string-ID round-trip passes. No v7, sentinel or binary cover. |
| TMDB | Mapping, exact movie/tv search destinations, debounce/empty/retry/staleness, credentials/config generation and errors, remote detail/save/refresh/OVA compatibility, attribution and personal preservation pass. Live success unavailable in the observed Web credential context; not fabricated. |
| MangaUpdates | Exact three type-bound capabilities; unsupported Novel/Doujinshi/OEL/Artbook/other types excluded; no inferred webtoon/one-shot/novel/light-novel. Explicit series route validates ID and gates platform before HTTP/cache, rejects stale route completion and handles cancellation. Actual Section 6 client/mapper and generic save are reused. |
| Search lifecycle | Same-query Manga↔Manhwa↔Manhua and cross-source movie/tv switches, reversed completion/stale errors, retry/empty/debounce, category/source/query/sequence/retry identity, no TMDB generation on MangaUpdates and no merged querying/ranking pass. |
| Local-first/provenance | Local reads/edits/provenance require no provider fetch. Valid full-reference source recognition only; unavailable Web/iOS in-app links absent; unknown references untouched. Android source uses the explicit route. |
| Attribution/covers | Remote Datos: MangaUpdates and validated provenance, local source and About values pass. TMDB/JustWatch preserved. Product always uses omit/default posterUrl null and placeholder; technical reference-https is not enabled. |
| Review/production | Real root selection, isolated theme/preferences/DBs/credentials, exact opt-in/release and no production fixture execution/catalog pass; actual Web normal/review boot checks agree. |

The status labels are Viendo for audiovisual, Leyendo for comic/literature and En curso in global/mixed views. No stored status token or classification authority moved to a provider.

## MangaUpdates request-policy regression

Executed Section 6 tests use injected time/transport rather than sleeping against the provider:

- Bounded in-memory LRU: 32 entries; search TTL 60 seconds and detail TTL 300 seconds.
- Serialized starts at least 1200 ms apart; maximum 16 pending operations; timeout 12 seconds and cancellation/listener/timer cleanup.
- Unsignaled duplicate in-flight coalescing, isolated signaled lifecycle, cache hit/expiry/eviction, failure recovery without poisoning cache or queue.
- At most one automatic HTTP 429 retry, practical valid Retry-After honored, long waits surfaced, fallback 3 seconds and local/repeated cooldown without retry storm. Automatic wait ceiling 30 seconds.
- No automatic retry of unrelated HTTP/network/access errors. Public/no-auth operations, no credential setting, no Origin/User-Agent spoof/proxy and browser gate cannot be overridden or bypassed through cached values.

These numeric values remain implementation engineering policy, not official MangaUpdates quotas or TTLs. No load/rate-limit test, bulk scan, dedicated diagnostic live script, browser CORS workaround or additional provider API call was run by the automated batch. The only requested real-provider smoke was the ordinary user-initiated Android search/detail.

## Commands and exits

All **44 scripts below were actually run for 9.2**, once each, all exit 0. No initial automated failure, stale assertion update or product fix occurred. The generated Section 5 TEST JSON was restored byte-for-byte after its suite. No dependency installation or package script change was required.

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
| `openspec status --change add-expanded-media-domain-and-second-provider-foundation --json` | 0 |
| `openspec instructions apply --change add-expanded-media-domain-and-second-provider-foundation --json` | 0 |
| `openspec validate add-expanded-media-domain-and-second-provider-foundation --strict` | 0 |
| `git diff --check -- docs/testing/expanded-media-domain/section-9-2-validation.md openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md` | 0 |

## Failure classification and limits

- **Real regression:** none found.
- **Stale verification assumption:** none changed in 9.2.
- **Environment/manual limitation:** existing Android ADB input restriction handled with operator-driven smoke; app not foreground at a guarded capture meant capture was skipped. Missing Web TMDB credential is the correct observed product state, not a failed or fabricated live search. No browser network instrumentation and no iOS runtime.
- Node prints its existing experimental SQLite warning; all real SQLite suites still exit 0. No weakening of tests, security controls, transport safeguards or architecture was needed.

## Eligibility, rights and future scope

Existing Section 6 evidence and conservative personal/open-source/non-commercial engineering eligibility remain in force; this milestone does not re-audit live provider policies or claim explicit approval/endorsement of DespuésLaVeo, silence-as-authorization or complete legal clearance. Indefinite local retention/backup/export terms, broader/commercial distribution, precise official numeric limits and cover display/hotlink/cache/redistribution rights remain documented uncertainties requiring review before a materially wider/commercial release. Metadata API access does not establish cover artwork rights; productive covers stay null.

Anime remains local taxonomy/filter/fixture support with remote provider deferred. Literature/Open Library, manual local creation, ExternalRating, provider registry/protocol, generic arbitrary route, authors/publication persistence, chapters/reading/progress, relations/recommendations, accounts/sync and cross-provider fusion remain outside this change. None is needed for closure and none was added.

## Files, hygiene and final state

Created:
- docs/testing/expanded-media-domain/section-9-2-validation.md

Modified:
- openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md — only 9.2 checkbox.

Source/storage/provider/UI/test files and protected manifests are checked against this run's initial SHA-256 baseline. The existing package.json personal edit is not part of 9.2. SQLite v5, backup v6, SavedTitle/ProviderReference/personalRating/voteAverage/local identity contracts are unchanged. No package-lock/dependency change, Git mutation, stage/commit/push/checkout/reset/stash, archive, proxy or persistent image download.

Final checks: strict OpenSpec validation exit 0; scoped git diff --check exit 0; direct whitespace scan of this new report passed. Task count verified 36/36 and the actual task diff changes only 9.2. Initial/final SHA-256 comparison found only this new report and tasks.md changed across app/src/docs/testing/change artifacts; package.json and package-lock.json are byte-identical to the initial baseline. The pre-existing package.json edit remains present and untouched. The temporary review Metro process was intentionally stopped with Ctrl+C (process exit 1 from intentional shutdown, not a failed test). The change remains active for external final-diff review/checkpoint; do not archive automatically.
