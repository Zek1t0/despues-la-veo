# Task 9.1 — integrated regression after Sections 1–5

Date: 2026-10-13 (America/Buenos_Aires). Branch: `feat/anime-manga-provider`. Checkpoint: `55e1a9e629591d78d50624693391556232d9d84e` (`feat: add isolated provider-neutral media review`). Sections 1–5 were already complete. Only task 9.1 is evaluated here; 6.1–6.4, 8.1–8.3 and 9.2 remain unchecked.

Result: **PASS with the explicit manual/environment limits below**. All 41 relevant existing Node verification suites pass, plus TypeScript and strict OpenSpec validation. No product regression or application-code fix was found. Six outdated verification scripts were adapted without removing their underlying assertions. Progress after bookkeeping: **28/36**.

## Production and review mode results

Production Web was started with `EXPO_PUBLIC_MEDIA_REVIEW` unset, on a fresh localhost browser origin at port 8111, using the real production root and normal storage defaults. The review harness was not substituted for this smoke. No test backup/fixture data was imported into productive storage; no credential was entered, changed, printed or copied. The productive browser database was empty.

| Area | Evidence and outcome |
| --- | --- |
| Normal root and default bindings | Actual Web boot landed in Librería, with Librería/Buscar/Etiquetas/Ajustes tabs, no TEST banner/session. Biblioteca and local detail ran without injected bindings. Guard matrix tests also select the productive root outside exact opt-in, without any review DB opens. |
| Search | Only Películas and Series were exposed. Entering Matrix in Películas showed the actual missing-credential state; switching to Series retained the same query and correct category; clearing it restored the empty-query message. Narrow layout remained usable. No Anime/Manga/Manhwa/Manhua remote controls, source selector or fixture catalog appeared. |
| Search lifecycle and errors | Automated tests cover movie/tv endpoint separation, debounce, empty query, same-query switches, reversed completion, stale results/loading/errors, retry sequence and TMDB-only configuration generations. Missing/invalid/storage/network states and explicit recognized destinations remain covered; arbitrary references cannot execute routes or create merged search. |
| Remote detail | Manual visits to `/tmdb/movie/42` and `/tmdb/tv/42` rendered the correct Película/Serie screens and missing-credential actions. No live detail payload was available. Existing automated mapping/detail/save suites cover both resources, canonical references, repeat save, generic refresh and personal/local identity preservation. |
| Local browsing/detail | Manual Biblioteca/Etiquetas empty states, existing filters/options, and Biblioteca Detalle/Mosaico controls worked. `/title/9-1-not-present` opened the expected No encontrado state. This empty origin had no saved item: populated production detail, tags/notes/rating/pins and filtering/order are automated coverage, not a claimed populated manual Web run. The existing Section 3 hook-host calls the default local screen without injected bindings across expanded classifications and references. |
| Personal state | Tests preserve status/tags/notes/personalRating/pins/local ID/createdAt/references, advance freshness as specified, and retain 10..100 integer or null rating semantics. Genres are refreshable; initialTags remain creation-only. Non-TMDB omission preserves historical voteAverage, explicit TMDB null remains valid, other own-property rating inputs reject before writes. OVA/anime classification survives tmdb/movie refresh and navigation. |
| Appearance/preferences | Normal Ajustes → Apariencia and Ajustes → Configurar TMDB navigation worked. Claro took effect and remained selected after full reload; the original Oscuro/Original choice was restored. Search and Library view controls were exercised and restored to Detalle. Automated suites cover preference persistence/failures/hydration/navigation theme and the extracted production root. No credentials were modified. |
| SQLite | Real SQLite tests cover fresh v5, historical migration and reopen, foreign keys/cascades/orphans, classification/rating constraints, rollback at controlled phases, invalid history and future-version rejection. Production schema files did not change. |
| Backup | Historical frozen v1–v5 contracts and current v6 dispatch/export/import/merge pass: full/unknown/multiple references, independent namespaces, freshness, identity/createdAt, pins, personal fields, Appearance and partial restore. Eligible explicit v6 null clears family/format, historical absent fields preserve them, and provider refresh keeps known classification. Local-only items remain locally usable and retain portable-identity export rejection. No new backup version or fixture-specific importer rule. |
| Review isolation | Separate Web opt-in smoke on port 8112 showed the TEST banner, original corpus, `media-review-primary.db` and `media-review-restore.db`, plus their separate empty library views. No full Section 5 walkthrough was repeated. Its automated suites re-prove exact dev/flag gate, separate physical SQLite files, scoped reset/reopen, zero personal initDb/preferences/credential mounts/provider-network calls, and real generic save/materialization/export/import reuse. |

### Actual manual commands

```powershell
Remove-Item Env:EXPO_PUBLIC_MEDIA_REVIEW -ErrorAction SilentlyContinue
$env:EXPO_OFFLINE = '1'
npx expo start --web --localhost --port 8111
```

A separate process used `$env:EXPO_PUBLIC_MEDIA_REVIEW = '1'` and `npx expo start --web --localhost --port 8112`. EXPO_OFFLINE suppresses Expo CLI checks; it does not fake provider responses. Both servers bundled successfully and were stopped with Ctrl+C after review (intentional process exit 1).

Web evidence: [production narrow Buscar](section-9-1-production-web.png), [separate TEST review boot](section-9-1-review-web.png). The screenshots contain no credentials.

## Initial failures and exact fixes

The initial 41-suite run had 35 passes and six exits of 1:

| Script | Failure classification | Resolution |
| --- | --- | --- |
| tmdb-user-credential/section-3-verification.cjs | Static route assertion still read the old root location | Read ProductionRootLayout; preserve all credential/settings route assertions. |
| tmdb-user-credential/section-5-verification.cjs | Static About/credits route assertion still read the old root location | Read ProductionRootLayout; preserve attribution/navigation assertions. |
| personal-title-rating/section-1-verification.cjs | Row fixture lacked new classification; fresh/current schema still expected v4 and treated v5 as future | Supply valid classification to the rating-specific invalid row; verify current v5/rating constraints; retain historical source schemas, rollback checks and future rejection using version 6. |
| personal-title-rating/section-2-verification.cjs | Handcrafted current storage fixture used type rather than classification | Adapt test-table columns and local fixtures to active classification. Check repository primaryFormat instead of removed type. The frozen legacy mapper assertion now requires known movie format to survive a less-specific/conflicting TV proposal, following the approved monotonic contract. Personal/rating/clock/identity assertions remain. |
| personal-title-rating/section-3-verification.cjs | Historical backup merge targeted an obsolete handcrafted storage schema, leaving no inserted current row | Adapt only current test-table/local-item classification. Keep historical v1–v3 backup payload shapes/parser/export/presence/null contracts unchanged. |
| personal-title-rating/section-2-integration-verification.cjs | Static assertion expected inlined rating accessibility code | Follow the shared savedTitleOpenAccessibilityLabel wiring. Add executable helper assertions for exactly one personal rating announcement, Leyendo, omission by default, and no TMDB-score fallback. Preserve badge/grid/accessibility checks. |

All six passed individually after adjustment. Then all 41 suites were rerun and passed. No application/core/storage/theme/provider code was edited. Temporary test-generated TEST backup bytes were restored to their checkpoint contents after each batch so running the regression did not churn committed artifacts.

Manual automation encountered a locator mismatch between AX checkbox descriptions and DOM button roles, a disappearing back link after a full navigation reload, and a transient modal/clipboard focus timing error. DOM/state inspection followed by the correct control/navigation resolved them; none was treated as an application failure.

## Automated commands and final exit codes

Every listed suite was executed, not inferred from earlier reports. Each `node` command below has final exit 0. Tests use deterministic stubs/temporary SQLite databases; they do not claim live TMDB responses. Node SQLite emitted its standard experimental warning.

| Command | Final exit |
| --- | --- |
| `node docs/testing/expanded-media-domain/section-1-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-2-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-ui-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-4-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-5-ui-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-5-verification.cjs` | 0 |
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
| `git diff --check -- <only the 9.1 changed paths>` | 0 |

## Native and live-network limitations

`adb devices -l` exited 0 with no connected devices. Android regression smoke was **not repeated**; Section 3's Redmi Note 13 validation on 2026-10-12 is historical evidence only, not a 9.1 run. iOS is explicitly unvalidated on Windows.

The app's actual browser credential state was **No configurado**, even though the existing environment exposes a legacy variable name during Expo startup. No secret value was read or copied and no credential was changed to expand coverage. **No live TMDB API search/detail/save smoke was performed.** Both remote route guards and production search's missing-credential state were manually observed; working results, invalid/storage/network errors, save/re-save and refresh are automated evidence.

The fresh browser origin's library was empty, so populated production local detail was not manually reviewed in 9.1. Existing actual default-screen hook tests and physical-SQLite save/refresh/merge tests cover it. No personal library/test import was created solely to remove this limitation.

## Known non-blocking issue and scope preservation

The detailed Biblioteca row can leave a blank poster slot when a non-null remote URL fails. Its poster-rendering block is whitespace-normalized identical to commit `999cf12`, before the expanded-domain Sections 1–5; both lack onError in that block. This confirms pre-existing behavior. Grid/local-detail image failure placeholders remain tested. No visual redesign was made.

This milestone does not validate or activate any real second provider. MangaUpdates stays unimplemented and invisible in production; Sections 6/8 and 9.2 remain pending. No remote anime vertical, provider registry, universal detail route, new product functionality, SQLite migration/schema-version change, backup v7/version change, dependency/manifest/lockfile change or Git mutation occurred. The pre-existing personal package.json modification is preserved byte-for-byte, including the protected Android/iOS scripts.

Created files:
- `docs/testing/expanded-media-domain/section-9-1-validation.md`
- `docs/testing/expanded-media-domain/section-9-1-production-web.png`
- `docs/testing/expanded-media-domain/section-9-1-review-web.png`

Modified files:
- `docs/testing/tmdb-user-credential/section-3-verification.cjs`
- `docs/testing/tmdb-user-credential/section-5-verification.cjs`
- `docs/testing/personal-title-rating/section-1-verification.cjs`
- `docs/testing/personal-title-rating/section-2-verification.cjs`
- `docs/testing/personal-title-rating/section-3-verification.cjs`
- `docs/testing/personal-title-rating/section-2-integration-verification.cjs`
- `openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md` (9.1 checkbox only)

