# Section 6 — real MangaUpdates foundation validation

Date: 2026-10-13 (America/Buenos_Aires). Change: `add-expanded-media-domain-and-second-provider-foundation`. Branch: `feat/anime-manga-provider`. Scope: **6.1–6.4 only**; no Section 8/9.2 integration or native acceptance. Result: **PASS for the foundation**, with development eligibility and platform/rights limits below. Completion count: **32/36**; 8.1–8.3 and 9.2 remain pending.

## Eligibility and task alignment

[Provider evidence](mangaupdates-evidence.md) records CONDITIONAL GO for conservative personal/open-source/non-commercial development under the already-approved policy. Published API policies sufficiently compatible with the documented intended use OR explicit authorization can support eligibility. MangaUpdates has not explicitly approved DespuésLaVeo; silence is not authorization and no complete legal clearance is claimed.

The policy evidence is the official material already recorded in design 8.1 from the 2026-10-11 exploration: public search/detail observed without credentials, required credit/caching/reasonable spacing, prohibited fraudulent/illegal/spam/database-harming use, and external-Origin/preflight 403. The AUP is not claimed as freshly re-reviewed during this run. New technical observations are identified separately below.

Unresolved: indefinite local snapshot retention, backups/export retention and redistribution, broader/commercial release, exact provider quota/TTL, cover hotlink/display/cache/redistribution rights and cover runtime/redirect behavior. These remain review items before materially broader/commercial release. No provider contact was made. Use is limited to explicit search/detail and small selected-work snapshots/backups, with no scraping, mirroring, polling or permanent artwork download.

Existing OpenSpec 6.2 groups contract reconciliation; 6.3 groups DTO/transport/mapping and policy. The user grouped transport as 6.2 and request policy as 6.4. Implementation satisfies both groupings. 6.4 wording was reconciled to reusable attribution/provenance/About values and production-off availability; final UI insertion belongs to Section 8 as explicitly requested. Proposal's global milestone scope remains valid and was not edited.

## Implementation and public API boundary

- Provider-specific modules under `src/providers/mangaupdates/`; no universal transport/errors/detail capability, provider registry or credential/settings mechanism.
- Public search: `POST https://api.mangaupdates.com/v1/series/search`. Body: trimmed search, stype title, **singleton type array**, page 1 and perpage 25 by default. Perpage 5 was used only for the small live checks.
- Public detail: `GET https://api.mangaupdates.com/v1/series/{id}`.
- Search capability retains the existing `search(query)` contract. No shared pagination fields, merged ranking, cross-provider deduplication, extra page fetches or N detail calls per search.
- Type is one of Manga/Manhwa/Manhua. Empty direct-context query performs no HTTP. Invalid query/type/ID fails before HTTP.
- A lazy provider-local shared client avoids import-time HTTP; future explicit consumers can share its queue/cache. It is not connected to production search resolution.
- Transport uses Accept and POST Content-Type only; no Authorization, credentials/settings dependency, Origin/User-Agent spoof, proxy or alternate base. Redirects are requested as errors; final response URL, when supplied by the runtime, must retain the canonical HTTPS API origin. Native handling remains for real Section 8 validation.
- Browser runtime is rejected before HTTP or cache use and cannot be overridden with diagnostic options. Android/iOS product availability remains false; standalone direct-development HTTP is not app/native acceptance.

Runtime validation accepts unknown JSON only after checking envelope counts/page/per_page and result records. It validates consumed series identity/title/type/year/description/image URL fields/genre entries, discards unsupported or wrong-type search records, and rejects malformed consumed data. Detail ID must match the requested canonical ID, and a selected type must match the returned type. Alternative hit_title is not used as canonical title or identity. Unknown unconsumed provider fields (including ratings, categories, authors and relations) are not copied or modeled.

Responses over one million text characters and search arrays over 100 records reject as engineering safety bounds; they are not provider limits. No additional pages are fetched. DTO/cache records retain only consumed fields.

Provider-specific errors: invalid-request, network, timeout, cancelled, HTTP, access-rejected (401/403), rate-limited (429/local queue/cooldown), not-found, invalid-response, unsupported-type and platform-unavailable. Errors do not expose raw remote bodies or ask for TMDB/MangaUpdates credentials.

## Identity and mapping

Canonical reference:
```text
provider: mangaupdates
resourceNamespace: series
externalId: positive canonical decimal string
```

String IDs reject zero, signs, whitespace, leading zeroes, fractions, exponent notation, path/slug fragments and non-string caller inputs. No Number conversion of string IDs or 32-bit truncation. The API declares integer series_id: already-safe positive JSON numbers convert once with String; unsafe numbers reject. Arbitrarily precise canonical string IDs are preserved, including beyond JavaScript's safe integer range. Namespace remains external identity and never local format authority. The future destination helper is explicit `/mangaupdates/series/<validated-id>`, not a catch-all route.

| Admitted provider type | medium | contentFamily | primaryFormat |
| --- | --- | --- | --- |
| Manga | comic | manga | null |
| Manhwa | comic | manhwa | null |
| Manhua | comic | manhua | null |

Novel and all other types are excluded/deferred. No webtoon/one-shot/light-novel precision from categories/country/title/counts/cultural knowledge.

Snapshot fields are enumerated explicitly: canonical title, unambiguous four-digit provider year or null, safe readable description or null, approved genres, classification, and cover under explicit policy. No new persisted fields. HTML active blocks/tags/comments are removed; common entities and paragraph breaks are normalized; common Markdown links/formatting become plain text. No DOM execution, link/image fetch or markup renderer.

**Exact genre allowlist:** Action, Adventure, Comedy, Drama, Fantasy, Horror, Mystery, Romance, Sci-fi, Slice of Life, Sports, Supernatural, Psychological, Historical, Tragedy. Input names match trim/case; Science Fiction aliases to Sci-fi. Approved duplicate genres are removed while preserving order. Shounen/Shoujo/Seinen/Josei, other demographic/audience/category/source/theme values and unknown strings are omitted. Only `genres[].genre` is consumed; categories never become genres or tags. This small choice is deliberate rather than an exhaustive ontology. The official genre vocabulary was checked once; no runtime genre endpoint/client was added.

**Ratings/tags:** normalized DTO, snapshot and materialization input do not own voteAverage. Bayesian/rating_votes data is ignored. initialTags is always []. Generic materialization creates local voteAverage null for a new MangaUpdates item and preserves an existing historical value on omission. Unit integration checks also preserve personal state/local ID and known webtoon classification while rejecting non-TMDB number/null/undefined own-properties.

**Covers:** default policy `omit` yields null, including live detail. Future explicit `reference-https` accepts only absolute HTTPS URLs on cdn.mangaupdates.com without embedded credentials/nonstandard ports; invalid values return null. The flag is not rights authorization. No cover download, persistent cache, binary backup or offline-cover guarantee. Cover render/hotlink/redirect rights remain separate future checks.

## Cache, spacing and retry — engineering defaults

These numbers are **implementation choices, not official MangaUpdates quotas/TTLs**:

| Policy | Behavior |
| --- | --- |
| Cache | In-memory LRU, maximum 32 validated search/detail entries; search 60 seconds, detail 300 seconds; no DB/cache schema or persistence |
| Duplicate work | Unsignaled equal requests share an in-flight promise. Signaled callers keep independent cancellation lifecycle and check cache again at queue execution |
| Queue | One serialized request stream per shared client; at most 16 pending operations |
| Spacing | Request starts at least 1200 ms apart, including retries |
| Timeout | 12 seconds per fetch/body read, with AbortController cancellation |
| Automatic retry | HTTP 429 only, at most one retry |
| Retry-After | Nonnegative seconds or valid HTTP date; waits up to 30 seconds automatically, otherwise surfaces rate-limit error/cooldown |
| Fallback | 3-second delay for missing/invalid Retry-After |
| Repeated 429/long wait | Cooldown retained; subsequent non-cached requests fail without polling or converting local cooldown into another HTTP retry |
| Other failures | No automatic retry, never cached, queue remains usable |

Timing is injectable in focused tests, so spacing/cache expiry/backoff tests do not sleep for production durations. No load/rate-limit probe was made against the real provider.

## Attribution/provenance and activation

Reusable values supply **Datos: MangaUpdates**, the official website link, and a canonical public API record source link after complete reference validation. The API link is honest provenance without guessing a website slug. About consumes the website attribution data later; source/provenance does not become local identity.

No attribution was inserted into unrelated TMDB UI. No MangaUpdates screen, About/local source UI insertion, production category button/resolver connection, Android/iOS product activation or generic routing was created. Existing production availability still exposes only Películas/Series → TMDB. The one existing search file change is a stale comment correction: a foundation now exists, but product integration/native eligibility remain pending.

## Real network work actually performed

Seven total public HTTP reads/metadata operations were performed conservatively:

1. Official OpenAPI read — HTTP 200. Its search type is an array and the consumed record shapes were confirmed.
2. Manga/Berserk search — successful validated 2xx, page 1/per_page 5/five admitted records; target ID 51239621230 present.
3. Manhwa/Solo Leveling search — successful validated 2xx, page 1/per_page 5/five admitted records; target ID 15180124327 present.
4. Manhua/The Ravages of Time search — successful validated 2xx, page 1/per_page 5/five admitted records.
5. One Punch-Man detail 30535847369 — successful validated 2xx; Manga/year 2012 → comic/manga/null, six approved narrative genres, no own voteAverage and cover null.
6. Official genre vocabulary read — HTTP 200; spelling confirmation only, no runtime operation added.
7. Final detail-only repeat 30535847369 after browser/redirect safeguards — **HTTP 200**, same validated mapping, final client used.

The initial four-call live script did not retain exact status numbers, so those outcomes are stated as successful 2xx rather than fabricated 200 logs. The final detail and document/vocabulary reads retained explicit 200. No complete real records were committed. Berserk/Solo Leveling years remain prior-exploration evidence; this run does not claim their detail/year checks.

Context: Windows Node/direct HTTP, no auth or external Origin. It is not Expo Web, Android or iOS validation. No CORS reprobe, provider-origin spoof, cover request or rate/load test. Existing browser 403 evidence remains the Web exclusion basis.

## Automated validation

All **42 deterministic suites** below ended with exit 0. Live verification is separately and explicitly invoked; it is excluded from the batch. Existing tests use temporary SQLite/stubs, not new provider network traffic. Section 5's generated backup bytes were restored to checkpoint contents after the batch.

| Command | Final exit |
| --- | --- |
| `node docs/testing/expanded-media-domain/section-1-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-2-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-ui-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-4-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-5-ui-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-5-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-6-verification.cjs` | 0 |
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
| `node docs/testing/expanded-media-domain/section-6-live-verification.cjs` (initial four calls) | 0 |
| `node docs/testing/expanded-media-domain/section-6-live-verification.cjs --detail-only` (final one call) | 0 |
| `npx tsc --noEmit` | 0 |
| `openspec validate add-expanded-media-domain-and-second-provider-foundation --strict` | 0 |
| `git diff --check -- <only Section 6 changed paths>` | 0 |

Focused Section 6 tests cover large/malformed IDs, unsafe JSON numbers, exact POST/GET/filter bodies, consumed-field/envelope validation, wrong/mismatched/unsupported types, sparse data, honest year fallback, malicious/long overview, exact genres/demographic/category exclusions, strict HTTPS/default-null covers, own-property rating absence, initialTags, generic materialization ownership/preservation, error classes, timeout/cancellation, metadata origin guard, cache hit/expiry/eviction/coalescing, serial starts, queue bound, one 429 retry/Retry-After/cooldown, recovery after failure, actual Web guard override/cache rejection, explicit provenance/routes and product-off boundaries.

No shared provider contract, storage/core implementation or visible product UI changed. Existing domain/persistence/browsing/search/review/provider/credential/appearance/rating regressions pass. No manual Web/native acceptance is claimed or needed to substitute for Section 8; product activation remains off.

## Initial failures and resolution

- The web reader could not render the official YAML. A direct official GET succeeded. PowerShell returned byte[] content; decoding those bytes exposed the actual YAML rather than treating it as JSON. This affected only temporary documentation handling.
- First focused unit run found a cooldown bug: the request loop retried a locally thrown cooldown as if it were another remote HTTP 429. Moving the local spacing/cooldown gate outside the HTTP retry catch made subsequent cooldown calls fail without another fetch. The original assertion was preserved and now passes.
- Review added non-overridable real-browser gating, metadata redirect defense, timeout checks even if a transport ignores AbortSignal, and invalid signed Retry-After rejection. These are covered deterministically; the final one-call real detail smoke also passed.
- Canonical-ID review added explicit trim equality and terminal-newline tests because JavaScript's regex end anchor can otherwise match before a final line break. No numeric coercion/normalization was added.
- No existing regression suite failed; no Sections 1–5/9.1 tests or product behavior were weakened or rewritten.

## Files and remaining limitations

Created source files (all under `src/providers/mangaupdates/`):
- `errors.ts`
- `identity.ts`
- `validation.ts`
- `mapping.ts`
- `requestPolicy.ts`
- `client.ts`
- `adapter.ts`
- `attribution.ts`

Created verification/docs:
- `docs/testing/expanded-media-domain/fixtures/mangaupdates-minimal.json` (original handwritten DTO-shaped test record, not a real catalog fixture)
- `docs/testing/expanded-media-domain/section-6-verification.cjs`
- `docs/testing/expanded-media-domain/section-6-live-verification.cjs`
- `docs/testing/expanded-media-domain/mangaupdates-evidence.md`
- `docs/testing/expanded-media-domain/section-6-validation.md`

Modified:
- `src/components/search/searchCategories.ts` — comment only; product resolution unchanged
- `openspec/changes/add-expanded-media-domain-and-second-provider-foundation/design.md` — concrete foundation policy/staging decisions
- `openspec/changes/add-expanded-media-domain-and-second-provider-foundation/specs/second-provider-discovery/spec.md` — scenario explicitly separating foundation from Section 8 activation/UI/native validation
- `openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md` — Section 6 scope reconciliation and only 6.1–6.4 completion changes

Remaining: Web CORS blocked; native/runtime/image/redirect validation pending; policy/retention/commercial/cover rights unresolved as above; source websites' user-facing record slug links are not guessed. Cache is session memory only, and independently constructed diagnostic clients have independent caches/queues; future product consumers should use the existing lazy shared client. No external rating model or additional metadata persistence.

SQLite remains **v5**, backup remains **v6**; SavedTitle, ProviderReference, identity/ratings/personal state, importer semantics and dependency manifests remain unchanged. The pre-existing package.json edit, including protected Android/iOS scripts, is preserved byte-for-byte. No dependency was added, no Section 8/9.2 or remote anime provider was implemented, and no Git mutation occurred.

