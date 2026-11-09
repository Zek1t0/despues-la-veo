# Section 2 — inactive composition

Only 2.1/2.2 completed; progress 4/14. Section 1 code/tests unchanged.

Production search explicitly passes omit to the existing adapter; both remote-detail materialization calls explicitly pass omit. Existing mapper ownership and generic save pipeline are preserved. Presentation and save share the same normalized input. No client/request-policy/category/platform-gate changes or policy flags were added.

Remote detail conditionally constructs a decorative Image from snapshot.posterUrl, otherwise the existing placeholder, retaining 96×144 dimensions and radius 12. Production remains null. The synthetic test replaces the materializer only in its Node process and checks identical presentation/save object identity, original preference and thumbnail fallback. It also exercises existing Android metadata, Web/iOS gates, attribution, navigation and save assertions. Image is a stub; no real artwork/network or Android cover acceptance.

All exact commands below exited 0, with no test failures or TypeScript diagnostics:

```
node docs/testing/mangaupdates-cover-images/section-2-verification.cjs
node docs/testing/mangaupdates-cover-images/section-1-verification.cjs
node docs/testing/expanded-media-domain/section-6-verification.cjs
node docs/testing/expanded-media-domain/section-8-ui-verification.cjs
node docs/testing/expanded-media-domain/section-4-verification.cjs
node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs
npx tsc --noEmit
```

An initial tool orchestration attempt had a JavaScript syntax error before executing any shell command; corrected and executed the commands above successfully.

Files changed this section: src/components/search/mangaUpdatesSearch.ts; app/mangaupdates/series/[id].tsx; this report; section-2-verification.cjs; active tasks.md (2.1/2.2 only). No personal files edited. Baseline git status already showed package.json, Section 1 mapping/tests/tasks and untracked testing directory changes; these were preserved. Read-only git status/diff used; no Git mutations.

No browser smoke or native rendering performed. Production visible output remains placeholder. Error fallback/reset and recycled-view recovery are deferred to Section 3. Initial-host validation does not constrain native redirect destinations. No artwork rights or offline cache guarantees established.

Remaining tasks: 3.1/3.2, 4.1/4.2, 5.1/5.2, 6.1/6.2, 7.1/7.2. Stopped pending external real-diff review and manual Git checkpoint; no Section 3 implementation, archive or sync.
