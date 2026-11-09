# Section 1 technical preparation — 2026-11-08

Change: enable-mangaupdates-cover-images. Only tasks 1.1 and 1.2 implemented.

## Behavior and scope

- Mapping validates original first, then thumbnail independently, then returns null. Search reuses the detail snapshot selection; materialization already delegates to details.
- Every existing cover-policy default remains omit. Production search still constructs the default adapter; remote detail/save still use default materialization and the placeholder. No productive reference-https call was added.
- Explicit reference-https accepts an absolute HTTPS initial URL on exactly cdn.mangaupdates.com, with no port or explicit canonical :443. Host/scheme case normalization remains supported.
- Raw whitespace/controls/backslashes, malformed percent escapes, credentials (including empty userinfo), other hosts, subdomains/suffixes, relative/protocol-relative forms, malformed authorities and noncanonical/unexpected ports are rejected before URL normalization. Parsed protocol/hostname/credentials/port checks remain in place.
- Only initial URL validation is established. Native Image may automatically follow redirects to other destinations; no final-host enforcement or redirect/rendering test is claimed. Technical acceptance grants no artwork rights.
- validation.ts was inspected and preserved: DTO image strings remain independent nullable fields; malformed DTO structures retain existing errors. Provider contracts and TMDB implementation are unchanged.
- No image probes, provider contact, real artwork, UI changes, dependencies, allowlist expansion, schema/backup changes, archive/sync or later-section implementation.

## Commands and results

Executed from D:\dev\despues-la-veo. Commands below used local dependencies; no actual provider HTTP or cover binary was fetched.

| Exact command | Exit/result |
| --- | --- |
| `node docs/testing/mangaupdates-cover-images/section-1-verification.cjs` | 0 on all three runs. First: 12 selection cases across 3 policy modes and 3 mapping entry points. Second/final also cover 4 accepted and 76 rejected URLs; every rejected original falls back to a valid thumbnail in all three entry points. Zero fetch calls. |
| `node docs/testing/expanded-media-domain/section-6-verification.cjs` | First run: 1, existing mojibake description expectation at line 65. After correcting the description and similarly corrupted emoji test expectations using Unicode escapes: 0. Identity/DTO/mapping/ratings/genres/HTTPS, transport stubs, errors/cache/spacing/retry and platform boundaries passed. Search expectation now requires original rather than thumbnail. |
| `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | 0. TMDB search/detail/materialization mapping, pure mapping and stubbed search capability passed. |
| `node docs/testing/expanded-media-domain/section-8-verification.cjs` | 0. Product gates, null-cover materialization, generic save/re-save/SQLite/backup compatibility passed using in-memory databases. Node emitted its SQLite ExperimentalWarning; no assertion failure. This regression run does not complete Section 4 of the active change. |
| `node docs/testing/expanded-media-domain/section-8-ui-verification.cjs` | 0. Existing hook-host route/detail/save/null-cover and platform-gate assertions passed. No real renderer or Android validation. This regression run does not complete Sections 2, 3 or 5. |
| `npx tsc --noEmit` | 0 on all three runs: after task 1.1, after URL hardening, and after regression expectation corrections. No diagnostics. Existing provider type-contract assertions are included by the project configuration. |

No unresolved test or TypeScript failures. No Android image rendering, native redirects, browser smoke or physical-device checks were performed.

## Files edited/created in this session

- src/providers/mangaupdates/mapping.ts
- docs/testing/expanded-media-domain/section-6-verification.cjs
- docs/testing/mangaupdates-cover-images/section-1-verification.cjs (new)
- docs/testing/mangaupdates-cover-images/section-1-validation.md (new)
- openspec/changes/enable-mangaupdates-cover-images/tasks.md (1.1/1.2 checkboxes only)

No Git command or index/branch mutation was performed, as requested. This is the session edit inventory, not a Git baseline comparison: pre-existing tracked/untracked changes were not enumerated and a clean working tree is not claimed. Unrelated files were not edited.

## Remaining work and checkpoint

Progress: 2/14 tasks complete. All later checkboxes remain unchecked:

- 2.1 policy composition across search/detail/materialization; 2.2 inactive remote-detail image preparation.
- 3.1 minimal reusable UI fallbacks; 3.2 identity/URL reset and recovery.
- 4.1 full synthetic URL/null save/re-save/preservation regression; 4.2 backup v6 and historical v1–v6 regression.
- 5.1 synthetic component/runtime coverage with developer-owned assets; 5.2 production/review Web smoke and platform isolation.
- 6.1 evidence and artwork-rights questions; 6.2 future independent activation handoff.
- 7.1 full affected regression, TypeScript and strict OpenSpec validation; 7.2 final reviewable report and overall review/checkpoint.

Stopped after Section 1. External real-diff review and the manual user checkpoint with explicit continuation are required before Section 2. Neither review nor checkpoint is claimed complete. No archive or sync was run.
