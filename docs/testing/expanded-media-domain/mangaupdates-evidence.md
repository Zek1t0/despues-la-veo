# MangaUpdates — Section 6 evidence and eligibility boundary

Decision recorded for 2026-10-13: **CONDITIONAL GO for the provider foundation under the approved personal/open-source/non-commercial engineering policy**. This is not legal certainty, provider approval of DespuésLaVeo, or permission to activate every platform.

## Evidence used for eligibility (existing repository record)

The active change's design, decision 8.1, records the official material inspected during the 2026-10-11 exploration. Per the Section 6 request, that approved evidence is the policy basis here; the AUP has not been represented as freshly reviewed today.

- Official API: [api.mangaupdates.com](https://api.mangaupdates.com/).
- Official API contract: [OpenAPI](https://api.mangaupdates.com/openapi.yaml).
- Official policy reference: [Acceptable Use Policy](https://api.mangaupdates.com/#section/Acceptable-Use-Policy).
- The repository records public search/detail responses with HTTP 200 without credentials in direct/allowed-origin contexts.
- The repository records required MangaUpdates credit, caching and reasonably spaced requests, plus prohibitions on fraudulent/illegal/spam/database-harming use. It records no verified numeric quota or TTL.
- External browser Origin and preflight returned 403 in that exploration. Web transport remains disabled; the allowed provider origin observed then is not permission to spoof Origin.
- The OpenAPI's global bearer declaration does not establish that these particular public operations require app credentials. No MangaUpdates auth/settings system is introduced.

Published policies sufficiently compatible with the documented intended use OR explicit provider authorization may support eligibility. No email reply is required in every case; silence is never authorization. Neither other trackers nor wrapper licenses substitute for that evaluation. No contact/message to the provider was sent.

## Intended development use and unresolved questions

Only user-initiated title search/detail, small selected-work snapshots and existing local v6 backups are intended. No scraping outside the API, bulk mirroring, polling, background refresh, permanent cover download or external-rating import. Current code is a foundation with no productive category/detail-screen connection.

Unresolved: indefinite snapshot retention; export/backup retention and redistribution; materially broader/commercial distribution; exact request quota; official cache TTL; cover display/hotlink/cache/redistribution rights and mobile cover behavior. These remain explicit review items before broader/commercial release. Incompatible material restrictions must stop the affected use; uncertainty is not converted into complete clearance.

API access does not establish artwork ownership. Cover references default to null. An explicit future `reference-https` policy only performs technical checks (absolute HTTPS, `cdn.mangaupdates.com`, no embedded credentials); it does not assert rights. Section 8 may retain null and existing placeholders. No cover request or binary storage/backup is added.

## Contract reconciliation and additional technical checks

Section 6.2 in the existing task file is evidence/contract reconciliation; implementation is grouped under 6.3/6.4. The user grouped transport under 6.2 and policy under 6.4. Both descriptions are satisfied by the same Section 6 foundation, without enabling Section 8.

The official OpenAPI was retrieved successfully during this run. It declares:

- `POST /v1/series/search`, JSON `search`, `stype: "title"`, **`type: ["Manga" | "Manhwa" | "Manhua"]`**, `page: 1`, `perpage` integer.
- Search envelope: `total_hits`, `page`, `per_page`, `results[].record`, `results[].hit_title`. Hit title is not canonical identity/title. Ranking is retained, with no merged ranking, deduplication or automatic extra pages/detail calls.
- `GET /v1/series/{id}`; consumed fields: `series_id`, `title`, `type`, string `year`, string description, `image.url.original/thumb`, `genres[].genre`.
- Both record models declare integer IDs. Already-safe JSON numbers are converted once to strings; unsafe numbers are rejected. Canonical public IDs are positive decimal strings without whitespace, signs, exponent or leading zeroes. No Number conversion of string IDs or 32-bit assumption.

Four requests through the real new client succeeded and validated their payloads without credentials or Origin headers: Manga/Berserk search, Manhwa/Solo Leveling search, Manhua/The Ravages of Time search, and detail `30535847369` (One Punch-Man). Five records were admitted from each first page; no further pages were requested. Large target search IDs `51239621230` and `15180124327` were present. One Punch-Man detail validated as Manga/2012 and mapped to comic/manga/null with rating omitted and cover null. Those records are verification targets, not committed catalog fixtures. Successful responses were 2xx; the live script did not retain exact status numbers for these four calls.

A separate one-time `GET /v1/genres` (HTTP 200) confirmed official vocabulary spellings, including Sci-fi and Sports. It is evidence only: the runtime client implements search/detail, not a genre-discovery capability. Genre descriptions/statistics are not committed or imported.

After adding non-overridable browser gating and redirect defenses, one final detail-only call through the final client returned HTTP 200 and validated the same One Punch-Man mapping. Total live work in this run: five search/detail metadata requests (the three searches and two calls to the one detail), plus one OpenAPI and one small genre-vocabulary read. No CORS probe, rate-limit/load test, cover download or catalog scan was run.

The minimal committed DTO fixture is handwritten, with an original synthetic title/description and TEST cover paths which are never downloaded. No complete real provider record is copied into fixtures.

## Foundation versus platform/product delivery

Web is rejected by the client before HTTP/cache lookup; no spoof, proxy, fallback transport or header trick is provided. Production search resolution still exposes only TMDB movie/tv on its eligible platforms. Standalone direct-development HTTP is not Expo Web or native acceptance.

Android/iOS production availability is also false. Their real app search/detail/cover/save/local/offline/backup/error validation and activation remain Section 8. No native support claim is based on Node HTTP tests. Attribution/provenance values are prepared for remote detail, recognizable local sources and About; rendering them belongs to Section 8. They are not local media identity or a general attribution registry.

SQLite v5, backup v6, local IDs/references, personalRating, voteAverage ownership, refresh monotonicity and existing importer behavior stay unchanged.
