# Section 7 — final validation

Evaluated on 2026-10-04. No regression was found by the checks below. No production file, dependency, migration or backup format was changed. Section 6's `no extraction warranted` decision remains unchanged.

## Automated evidence

All 35 existing CJS verification scripts passed (exit 0):

- `provider-abstraction`: sections 2, 3, 4 and 5 (4 scripts). Search/detail mappings, absent/invalid fields, canonical references, corrected snapshot genres and separate initial tags; generic creation/refresh, preserved personal state and references, reference ownership/rollback, serialized concurrent saves; actual detail screen effects with mocked UI/network, one detail request per load/retry, integral `Promise.all`, route/generation/status/unmount invalidation and stale failure.
- `tmdb-user-credential`: sections 1–5 (5 scripts). Credential service/store/transport, initialization, replacement/removal and races, generation, query/debounce gating, current/stale request comparisons, retry, error presentation and TMDB/JustWatch attribution.
- `universal-media-identity`: sections 1–5 (5 scripts). Canonical ProviderReference and full triple lookup, movie/TV same-ID independence, multiple references, conflicts, SQLite v4 migration/rollback, backup v5 round-trip and historical imports, itemId pins, local/offline consumer boundaries.
- `personal-title-rating`: all 8 scripts. Domain/storage, editor intent queue, re-save preservation, historical rating backup, rating sorting and passive presentation.
- `global-appearance-themes`: sections 1–12 (12 scripts). Themes, selectors/recovery, library/search/tag browsing preference wiring, sort/pin/rating contracts, local/remote detail structure, attribution and appearance backup.
- `library-backup-integrity/controlled-sqlite-failure.cjs` (1 script). Disposable database only; injected historical import failure rolls back that item and processing continues. Temporary database removed by the harness.

Run the first five groups with `node docs/testing/<group>/<script>.cjs`, and the controlled-failure script with `node docs/testing/library-backup-integrity/controlled-sqlite-failure.cjs`.

`npx.cmd tsc --noEmit` passed. The project compilation includes both `provider-abstraction/type-contract.ts` (Section 1 and corrective genres contracts) and `section-4-type-contract.ts`; exact shared keys, readonly arrays and expected rejected DTO/descriptor/detail-capability inputs compile successfully.

`npx.cmd openspec validate add-provider-abstraction-foundation --strict` passed.

## Static architecture evidence

- Buscar imports `ProviderSearchResult` and `tmdbSearchCapability`, with no direct `TmdbSearchItem`, `searchMulti`, `media_type`, `poster_path`, title/name or release/first-air DTO branching. The explicit adapter calls TMDB search page 1 and maps before returning normalized readonly results. Credentials/errors and TMDB navigation remain explicit.
- The remote route has one movie/TV detail call in the existing details/credits/watch `Promise.all`. It retains the typed DTO for TMDB presentation and passes that same DTO to the pure movie/TV mapper and the separate initial-tag policy when saving. Save calls `createTmdbMaterializationInput` then `saveProviderTitle`; it does not construct a legacy snapshot or duplicate the request.
- `providerSavedTitle.ts` owns creation/refresh personal-state preservation and imports only normalized contracts/local core helpers. `saveProviderTitleWithDb` performs full-reference lookup, materialization, upsert and new-reference attachment; `saveProviderTitle` serializes its transaction. Those generic functions do not interpret TMDB DTOs, credentials, routes, React or backup DTOs. The existing repository module still hosts compatibility/backup operations and their imports; this is not a claim that the entire module's dependency graph is provider-free. Historical TMDB materializers/wrappers delegate to the authoritative generic materializer.
- Shared contracts expose only normalized search result, local-compatible snapshot (including readonly genres), portable details, separate materialization input and search capability. They contain no pagination, descriptor, remote detail capability, credentials, routing, attribution, credits or availability. No provider registry, orchestration, second provider or generic enrichment/configuration/routing framework exists.
- `DATABASE_SCHEMA_VERSION` remains 4; `LIBRARY_BACKUP_VERSION_V5` and current export remain 5. Reference storage remains provider/resource_namespace/external_id plus saved_title_id. Existing migration and historical import code are unchanged; credentials remain outside persisted library/backup payloads.

## Real-app QA status

Manual real-app QA was not executed.

The complete automated regression suite passed without detected regressions. The automated harnesses do not establish real browser visuals, real TMDB responses, or real offline application behavior.

Harnesses use pure tests, SQLite fixtures, source assertions and a mocked hook host. They do not establish real browser visuals, real TMDB responses or real offline application behavior. The user must confirm:

1. With TMDB configured, search a movie and a TV series in Buscar; check result text/cards/posters, navigation and absence of visible regressions.
2. Open both remote details; check title/year/poster/rating/genres/overview, movie runtime/director and TV runtime/seasons, cast/credits and watch providers/links.
3. Save a new movie and TV title; confirm each appears in Biblioteca and opens its local detail. Edit tags, rating, status and notes; reopen the remote detail and update it. Confirm personal state remains while snapshot metadata may refresh.
4. Open saved `/title/[id]` details offline; confirm local data remains usable.
5. Check unconfigured/replaced/removed credentials and a retryable search/detail failure: expected configuration/error/retry states, no stale result or detail replacing the current resource.

Task 7.5 stays unchecked until user confirmation. Task 7.6 stays unchecked until external review outside Codex. The change is not archived.
