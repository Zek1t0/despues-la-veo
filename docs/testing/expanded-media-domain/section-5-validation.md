# Section 5 — isolated synthetic media review

Implemented only tasks 5.1–5.7 of `add-expanded-media-domain-and-second-provider-foundation`. Fixtures demonstrate the existing domain and local pipeline, including anime and literature classification; they do not deliver remote anime discovery or validate MangaUpdates. MangaUpdates Web support is not claimed. SQLite remains v5; backup remains v6.

## Start and exit

From the repository in PowerShell, without editing package scripts:

```powershell
$env:EXPO_PUBLIC_MEDIA_REVIEW = '1'
npx expo start --web --localhost --port 8105
```

Open `http://localhost:8105/dev/media-review`. Activation requires both `__DEV__` and `EXPO_PUBLIC_MEDIA_REVIEW === "1"`. Release builds and development sessions without that exact flag select the unchanged production root and do not open/seed a review database. No TMDB credential is needed. Offline Metro startup may additionally use `$env:EXPO_OFFLINE = '1'`; this suppresses CLI network checks, not application transport.

The root selects review mode before importing/mounting the productive root. While opted in, visiting another route such as `/buscar` still renders the isolated review root. Harness navigation switches injected local IDs inside the container rather than visiting productive screens. The TEST banner remains visible; the review toolbar scrolls separately on narrow layouts.

To exit, stop Metro with Ctrl+C, close the review tab/app, remove the flag with `Remove-Item Env:EXPO_PUBLIC_MEDIA_REVIEW`, and restart normally. Remove `Env:EXPO_OFFLINE` too if set only for this review. Environment changes require a restart. Existing Android/iOS scripts remain untouched.

## Isolation and restart behavior

The two fixed SQLite names are `media-review-primary.db` and `media-review-restore.db`, opened through Expo SQLite in its normal platform database directory. On Web these are separate logical SQLite files backed by the browser origin's OPFS storage. They are not the productive database. Use one review app/tab at a time; concurrent Expo Web OPFS workers are not validated.

Repository closures capture the two handles. They call the existing WithDb operations and serialized transactions. The public `saveProviderTitle` receives an explicit review DB, sharing exactly the productive materialization/save implementation. There is no DB global swap, monkeypatch, hidden redirect or fallback to `initDb`.

Only review handles receive foreign-key/schema initialization via the existing version-aware `ensureLibrarySchema`. Reopening retains saved review data in the same two files; it does not create an unbounded number of databases. Reset closes both handles and deletes only those two captured names, then creates a fresh empty review session. It never enumerates/deletes personal databases or clears an entire browser origin.

Appearance and browsing preferences use session-memory persistence and reset on remount. They do not read/write personal preferences. The real `TmdbCredentialProvider` is not mounted. The original productive root was relocated without behavior changes to `ProductionRootLayout.tsx`; production defaults remain the original repository, theme and credential composition.

Automated proof uses actual schema/storage operations against two distinct physical Node SQLite files. `initDb` is replaced by a throwing test spy: zero calls across bootstrap/save/edit/pin/refresh/export/restore/reopen/reset. A separate hook-host mounts the actual review root, actual theme provider and shared screen components, verifying zero personal initialization, preference calls and credential mounts. Disabled flag/release combinations invoke no review opens. A throwing fetch guard observes zero provider/catalog network calls.

## Corpus and walkthrough

The JSON corpus contains 20 original, deterministic works. No title, description, catalog ID, cover or provider response was copied from a real provider. `fixture-review` is a review-only identity. Explicit synthetic TMDB references exist only for the requested compatibility/rating cases and perform no network request.

| Coverage | Cases |
| --- | --- |
| Audiovisual | Anime TV, movie, OVA, ONA, special, music; generic movie and TV |
| Comic | Manga/null format, manga one-shot, manhwa/webtoon, manhua/null format, general comic, general webtoon |
| Literature | Novel, light novel |
| Metadata | Null poster/year/overview, empty genres, long description, markup normalized to plain text, nullable family/format, loopback broken image |
| Identity | Multiple references; OVA plus `tmdb/movie`; same external ID in different providers/namespaces; decimal `9007199254740993` |
| Invalid inputs | Incompatible classification, unknown medium/format, empty title, malformed genres; non-TMDB own rating number/null/undefined |

1. Search the original corpus using **Buscar fixtures originales** and activate a fixture. This produces a `ProviderSearchResult`, then a synthetic remote detail using `ProviderMediaDetails`.
2. **Guardar en biblioteca de prueba** calls the real generic save pipeline. **Abrir detalle local guardado** uses its opaque local SavedTitle ID. Re-save retains that ID.
3. **Biblioteca de prueba** renders the actual Biblioteca screen with review bindings. Use its existing detail/mosaic views, local classification filters, search, status changes and pins. These are local filters, not productive remote provider categories.
4. Open a saved item and use the actual editor for tags, notes, status and personal rating. Audiovisual uses **Viendo**; comic/literature use **Leyendo**; mixed Biblioteca filtering uses **En curso**.
5. **Sembrar / resembrar corpus** saves all 20 through the same generic path; it is explicit, not automatic bootstrap. Re-seeding refreshes metadata and retains personal state. Classification remains monotonic, so it does not undo prior refinements. For a clean baseline, reset then seed.
6. In synthetic remote detail, run the labeled refresh pairs after seeding. Their targets are specified by the corpus, regardless of the currently displayed fixture. Open the resulting local ID to inspect preserved/refined classification and metadata.
7. **Simular sin red** disables synthetic source operations while retaining local Biblioteca/editor use. This is source unavailability simulation, not a browser-wide network toggle. No real remote provider is involved.
8. **Guardar con portada rota de prueba** uses `http://127.0.0.1:1/review-missing.png`, never a provider cover. The existing grid component renders its failure placeholder. Missing posters also use the existing fallback. The existing detailed Biblioteca row leaves a blank poster slot for failed non-null URLs; this pre-existing presentation limitation was observed and is not rewritten by Section 5.

Seven refresh pairs cover null→known family/format, manga null→one-shot, known+null preservation, known conflicts, medium mismatch rejection, anime movie plus TMDB null/movie, and OVA plus TMDB movie. Automated tests verify no writes on mismatch/invalid ratings; genres refresh; initialTags are creation-only; status/tags/notes/personalRating/pins/local ID/createdAt survive; updatedAt advances according to the existing contract. A generic/non-TMDB refresh omitting voteAverage preserves a historical TMDB score. Compatible TMDB-owned null is separately accepted; fixture ownership is not widened.

## TEST backup

**Exportar TEST v6** uses `getLibraryBackupExportDataWithDb` and `createLibraryBackupV6`. Web triggers a JSON download named `TEST-media-review-v6-<session>.json`; native uses the existing file-system/sharing dependencies. The JSON is also retained in session memory. **Restaurar TEST en segunda DB** parses and merges that exported JSON through the real `parseLibraryBackup`/`mergeLibraryBackupWithDb`, targeting only `media-review-restore.db`. It does not open a personal file picker or restore into personal storage. The restore button requires a current session export; after restart, export again. Backup appearance is deliberately unavailable; no personal Appearance is exported.

`TEST-section5-review-v6.json` is a generated test artifact from the physical-SQLite suite. TEST identification is its filename, documentation and harness handling, not a new schema property. A valid TEST file is a valid generic v6 backup; the productive importer has no fixture-specific rule and cannot prevent someone manually selecting it elsewhere. Do not select it in the personal app during review.

Tests cover classification, personal fields, multiple references, large IDs, pins, OVA/TMDB movie and independent identities. Newer eligible explicit v6 null clears family/format in the second DB, contrasting with provider refresh null preservation in the source DB. Local-only items without portable identity retain the existing export rejection. No sentinel property, binary cover, v7, importer special case or new persisted field was added.

## Actual manual validation

Performed with the Codex in-app Web browser on Windows, Expo localhost port 8105, desktop and narrow responsive layouts. Actual interactions covered TEST boot, discovery/filtering, synthetic detail, save/re-save, seed of 20, both library modes, local classification, status/tags/notes/personal rating/pins, one-shot refresh with personal data retained, sparse local detail, grid broken-image placeholder, source-disconnected local access, TEST export and second-DB restore (20 inserts and one pin), restored personal data, and reset to an empty library. Navigating/reloading `/buscar` while opted in stayed in the review root.

An initial prototype created fresh filenames at every remount and eventually exhausted the installed Expo Web VFS's six-file pool on the `127.0.0.1` test origin. The error stayed inside the TEST guard; there was no personal fallback. Final code uses two fixed names and the existing version-aware schema initializer. Final Web boot and full reload on `localhost` retained 20 records and the edited **Viendo**/**Leyendo** states. Physical-SQLite tests additionally prove reopen persistence and exact reset deletion. The old prototype test origin was not broadly cleared; leftover prototype review files may require deliberately targeted developer cleanup. Do not clear an origin containing personal data as a workaround. The final session's retained data belongs only to the two review databases.

Android device discovery (`adb devices -l`) exited 0 with no connected devices after a sandboxed daemon-start failure. No Android runtime smoke was performed. iOS was not validated on Windows. Native file sharing/cover behavior remains a manual runtime check; the review mode is not evidence for real MangaUpdates transport or native eligibility. Expo servers were stopped after Web review (Ctrl+C exit 1 is intentional).

## Automated validation

Every command below completed with final exit **0**. Node SQLite emitted its standard experimental warning.

| Command | Purpose |
| --- | --- |
| `node docs/testing/expanded-media-domain/section-5-verification.cjs` | Two physical DBs; corpus/save/edits/pins/refresh/ratings; real v6 restore/null semantics; reopen/reset; zero personal init/network |
| `node docs/testing/expanded-media-domain/section-5-ui-verification.cjs` | Actual guarded root/theme/shared library/detail; injected UI edits/pins/views; zero personal preferences/credentials |
| `node docs/testing/expanded-media-domain/section-1-verification.cjs` | Classification contracts |
| `node docs/testing/expanded-media-domain/section-2-verification.cjs` | v5 persistence and v6 backup |
| `node docs/testing/expanded-media-domain/section-3-verification.cjs` | Local consumers |
| `node docs/testing/expanded-media-domain/section-3-ui-verification.cjs` | Existing UI behavior |
| `node docs/testing/expanded-media-domain/section-4-verification.cjs` | Finite search and stale-request safety |
| `node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs` | Generic materialization/save regression |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | Existing detail/save regression |
| `node docs/testing/universal-media-identity/section-3-persistence-verification.cjs` | Historical migration/storage regression |
| `node docs/testing/global-appearance-themes/section-2-verification.cjs` | Appearance persistence contract |
| `node docs/testing/global-appearance-themes/section-3-verification.cjs` | Root/theme/navigation wiring |
| `node docs/testing/global-appearance-themes/section-4-verification.cjs` | Appearance route/settings |
| `node docs/testing/global-appearance-themes/section-11-verification.cjs` | Appearance regression coverage |
| `node docs/testing/personal-title-rating/section-6-verification.cjs` | Personal rating regression |
| `npx tsc --noEmit` | Type checking |
| `openspec validate add-expanded-media-domain-and-second-provider-foundation --strict` | Change validation |
| `git diff --check -- <Section 5 changed paths>` | Scoped tracked-file whitespace check; new files also scanned directly |

## Files and compatibility boundary

Created:

- `src/dev/mediaReview/mode.ts`, `fixtures.ts`, `session.ts`, `ReviewRoot.tsx`, `MediaReview.tsx`
- `app/dev/media-review.tsx`
- `src/components/ProductionRootLayout.tsx` (exact relocation of the original root composition, adjusted import paths)
- `docs/testing/expanded-media-domain/fixtures/review-corpus.json`
- `docs/testing/expanded-media-domain/section-5-verification.cjs`
- `docs/testing/expanded-media-domain/section-5-ui-verification.cjs`
- `docs/testing/expanded-media-domain/TEST-section5-review-v6.json`
- `docs/testing/expanded-media-domain/section-5-validation.md`

Modified:

- `app/_layout.tsx`: select review before productive imports/bootstrap
- `app/(tabs)/libreria.tsx`, `app/title/[id].tsx`: narrow mount-stable service/navigation bindings; reuse the same actual screens/editor/intent queues; suppress productive navigation headers when injected
- `src/storage/savedTitlesRepo.ts`, `libraryScreenSnapshot.ts`, `titleDetailPinSnapshot.ts`: optional explicit DB handles while preserving original productive defaults and authoritative implementations
- `src/theme/AppThemeProvider.tsx`: injected persistence boundary with original personal default
- `docs/testing/global-appearance-themes/section-3-verification.cjs`, `section-4-verification.cjs`: preserve existing static wiring assertions against the relocated productive root
- `openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md`: only 5.1–5.7 completion states

These are the minimum compatibility adaptations needed to reuse the real UI and save pipeline while bypassing every personal bootstrap path. No duplicate review library/detail product surfaces, registry, universal detail route or productive fixture adapter was introduced. Production Buscar remains unchanged and has no fixture catalog. No Section 6+, MangaUpdates transport/adapter, remote anime provider, schema migration, backup version change, package/dependency/lockfile change or Git mutation occurred. Previously completed and future task states remain unchanged; final progress is 27/36.
