## 1. Theme domain, resolver and Dark + Original parity

- [x] 1.1 Inventory current shared/root/CSS/literal colors into a review fixture before migration, including navigation, rating pairs, poster overlays, danger/error foreground consumers and each disabled surface together with its actual foreground; record `consumer/file → current value → future responsibility/token`, verify the fixture matches the current repo and contains the five known static-capture modules, and do not infer danger parity from an equal PersonalRating color.
- [x] 1.2 Define typed `AppearanceScheme`, `EffectiveScheme`, palette IDs, versioned `AppearancePreference`, complete immutable `ThemeDefinition` and the minimal global/semantic/structural token groups from Design, including the palette-overridable selection trio `selectedSurface`/`selectedForeground`/`selectedBorder`; verify TypeScript rejects incomplete definitions, no consumer needs palette branching, and neither `textPrimary` nor `onAccent` is an implicit selection foreground.
- [x] 1.3 Implement complete LightBase/DarkBase plus controlled light/dark partial overrides for Original, Manzana verde, Marea, Crepúsculo de medianoche, Lavanda and Obsidiana; verify every 2×6 combination resolves to a complete theme, every palette resolves an explicit contrasting `selectedForeground`, Dark + Original preserves `#ffffff`/`#0b0b0b`/`#ffffff` selection parity, and every Light combination remains light.
- [x] 1.4 Implement pure effective-scheme and base+palette resolution, preserving palette across scheme changes and keeping System as persisted intent; add a focused Node `.cjs` harness for explicit schemes, runtime System changes, palette validation, complete composition and the documented relative-luminance Light gate (`background`, `surface`, `surfaceSecondary`, `inputBackground` each `>= 0.50`; `textPrimary` darker than `background`; basic contrast `>= 4.5:1`), including a negative `#111111`/`#eeeeee` case.
- [x] 1.5 Encode Dark + Original parity for all current intentional tokens/literals that can be checked structurally, including selected surface/foreground/border, ratings, overlays, `#f4b8b8` TMDB feedback, `#5a2a2a` Title Detail error text and the real foregrounds paired with disabled `#303030/#3b3b3b`; verify exact consumer-specific values and document any necessary future accessibility correction instead of silently normalizing it or inflating the token catalog.
- [x] 1.6 Run the Section 1 harnesses and `npx tsc --noEmit`, confirm all 12 complete themes pass the selection-pair and Light-luminance gates, inspect the diff for an inflated token catalog or duplicated complete themes, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 2.

## 2. Appearance persistence, concurrency, provider and hydration

- [x] 2.1 Implement strict parse/serialize/default behavior for one versioned Appearance JSON payload stored under the stable key `appearance`, with default Dark + Original; add harness cases for absence, valid values, malformed JSON, invalid scheme, unknown palette, wrong payload version, future payload migration boundary and extra data policy.
- [x] 2.2 Add an Appearance-specific `app_preferences` repository without reusing `viewPreferencesRepo`, changing `SavedTitle` or raising SQLite schema v3; implement a queue/transaction-free `setAppearancePreferenceWithDb(db, ...)` helper and verify round-trip, `updated_at`, read-error distinction and idempotent use of the existing table.
- [x] 2.3 Implement the public Appearance mutation with exactly `initDb()` → one `runSerializedStorageMutation` entry → one `db.withTransactionAsync` → `setAppearancePreferenceWithDb`; add structural/runtime checks proving the helper does not call `initDb`, queue, transaction or public setter, a rejection does not break the global queue, and other title/pin/backup mutation semantics remain unchanged.
- [x] 2.4 Implement the central serialized/coalescing intent coordinator with monotonic IDs and separate `latestIntent`/`displayed`/`confirmedPersisted`; verify it chooses logical writes but delegates every real write to the public queue-compliant setter, every successful write updates `confirmedPersisted` even if superseded, and latest failure rolls back exactly to current `confirmedPersisted`.
- [x] 2.5 Add a pure coordinator harness for confirmed C → write A success → latest write B failure, proving displayed rollback, storage, `confirmedPersisted` and restart all resolve to A; retain explicit cases for coalesced-before-write, superseded failure, latest success, late success, multiple rapid intents, queue after rejection and retry.
- [x] 2.6 Add `AppThemeProvider` and `useAppTheme()` exposing hydration/storage availability, effective scheme/theme, `confirmedPersisted` and scheme/palette intents with memoized values; verify no palette-specific conditional is required in screens/components.
- [x] 2.7 Subscribe reactively to runtime system scheme on Android/iOS/web semantics and recompute only when preference is System; verify explicit Light/Dark ignore system changes and System changes do not enqueue writes.
- [x] 2.8 Add the short Dark + Original hydration gate and generation/intent-revision guard for hydration/retry reads; verify stored Light+Marea, no row, invalid row, thrown initialization, unmount/late completion, and that normal reads do not enter the mutation queue.
- [x] 2.9 Add the explicit stale-retry harness: initial read error → retry begins and observes old A → user selects B → B write succeeds → retry A arrives late; prove `displayed`, `confirmedPersisted`, storage and restart remain B. Also cover pending retry → newer write fails → rollback uses live `confirmedPersisted`, never the retry snapshot.
- [x] 2.10 Run all Section 2 harnesses and `npx tsc --noEmit`, confirm a single queue entry/transaction, queue recovery after rejection, untouched browsing/TMDB contracts and unchanged other mutation semantics, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 3.

## 3. Root Navigation, Tabs, StatusBar and web bootstrap

- [ ] 3.1 Integrate `AppThemeProvider` at root and derive React Navigation's complete theme from the effective ThemeDefinition, removing the private root dark palette; verify Settings headers and Stack content share the current effective background/text/border/accent.
- [ ] 3.2 Migrate Tabs header, bar, active/inactive labels/icons and borders to the same reactive source while retaining filled/outline active signals; verify runtime palette and scheme changes leave no stale tab surface.
- [ ] 3.3 Derive StatusBar content style from effective scheme and migrate explicit title/TMDB detail header overrides; verify Light produces dark StatusBar content and no light screen/dark stale header combination.
- [ ] 3.4 Inspect the current protected `app.json` diff and Expo System requirements, then make only the necessary `userInterfaceStyle` hunk if required while preserving the personal hunk exactly; verify `package.json` remains unchanged and System follows runtime changes on native.
- [ ] 3.5 Convert `global.css` to Dark + Original bootstrap fallbacks plus runtime-fed CSS variables for root background/text, scrollbars, focus and `color-scheme`; verify palette tables are not duplicated in CSS.
- [ ] 3.6 Add a small web synchronization effect for document/root variables and browser scheme, with cleanup/SSR-safe guards; verify reload, System runtime change, React/DOM agreement and visible keyboard focus.
- [ ] 3.7 Run focused resolver/provider checks, `npx tsc --noEmit` and manual web reload/theme switching; review `app.json`/`package.json` protection, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 4.

## 4. Settings integration, Appearance route and real previews

- [ ] 4.1 Add `/settings/appearance` as a normal Stack route and a clear entry from the existing Settings screen without changing other navigation; verify back navigation, header theme and TMDB/About entries remain unchanged.
- [ ] 4.2 Build accessible Scheme controls labelled `Del sistema`, `Claro`, `Oscuro` with immediate optimistic selection, selected state, non-color indicator and recoverable persistence feedback; verify there is no Apply button.
- [ ] 4.3 Build palette catalog metadata with stable IDs and approved Spanish display names, keeping “Obsidiana” replaceable as copy only; verify catalog order/IDs match parser and backup contracts.
- [ ] 4.4 Implement abstract palette previews from the same real resolver/ThemeDefinition used by the app, showing background, primary/secondary surfaces, text, accent and border/selection; add a structural check that no preview-only palette color table exists.
- [ ] 4.5 Implement mobile horizontal browsing and measured responsive wide-layout wrapping/grid behavior without freezing an unsupported breakpoint; verify narrow viewport, wide web, resize and rotation.
- [ ] 4.6 Add keyboard/focus, labels, checks/icons, selected border/indicator and `accessibilityState.selected` for scheme/palette controls; verify screen-reader order and keyboard operation on web.
- [ ] 4.7 Exercise rapid selections and the real confirmed C → A success → B failure sequence through the screen, run `npx tsc --noEmit`, manually validate narrow/wide web, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 5.

## 5. Shared components, static captures and semantic overlays

- [ ] 5.1 Migrate `LayoutOption.tsx` colors out of module-load `StyleSheet.create` while retaining layout/typography statically; verify selected/unselected/pressed states react in runtime themes.
- [ ] 5.2 Migrate `PosterPlaceholder.tsx` and `TagCollage.tsx` surfaces, borders and icons to runtime theme fragments; verify placeholder visibility in Light/Dark and collage layout parity.
- [ ] 5.3 Migrate `TitleGridCard.tsx` global card tokens while formalizing dark structural image overlays, `onImageOverlay` and overlay border; verify Dark + Original parity and arbitrary light-theme posters remain readable.
- [ ] 5.4 Preserve the passive top-right diamond-outline contextual pin and rating/pin coexistence across narrow cards/long titles; verify no new Pressable, handler, domain change or overlap is introduced.
- [ ] 5.5 Migrate `ViewOptionsPanel.tsx` panel/selection colors while keeping modal backdrop structural and static geometry unchanged; verify panel, options and backdrop react without stale captures.
- [ ] 5.6 Migrate `PersonalRatingBadge` to scheme-resolved semantic pairs while preserving `10..74`, `75..84`, `85..100`, numeric/accessibility labels and passive behavior; verify palettes cannot remap rating semantics.
- [ ] 5.7 Search all `StyleSheet.create`, color literals and theme imports for remaining module-load captures, run shared-component harnesses and `npx tsc --noEmit`, visually compare Dark + Original, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 6.

## 6. Biblioteca

- [ ] 6.1 Migrate Biblioteca list/grid, search-within-library, filters, options, loading/empty/error/destructive states and contextual pin controls to semantic runtime tokens; verify SavedTitle, sorting, viewMode and pin behavior are unchanged in both layouts.
- [ ] 6.2 Run Biblioteca-focused harnesses, `npx tsc --noEmit` and manual checks for detail/grid, filters, search, empty/error/loading, pin/rating coexistence and Dark + Original parity.
- [ ] 6.3 Search the Biblioteca diff for old theme imports, literals, static captures or domain/sorting/viewMode changes, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 7.

## 7. Buscar

- [ ] 7.1 Migrate Buscar inputs, placeholder, actions, result detail/grid, loading/empty/error/TMDB credential states to semantic runtime tokens; verify debounce, remote request identity, natural ordering and credential behavior are unchanged.
- [ ] 7.2 Run Search-focused harnesses, `npx tsc --noEmit` and manual checks for detail/grid, query transitions, credential absent/error/configured paths, placeholders, focus and Dark + Original parity.
- [ ] 7.3 Inspect the Buscar diff for stale colors or behavioral changes, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 8.

## 8. Etiquetas

- [ ] 8.1 Migrate Etiquetas list/grid, collage labels, search, selected-tag detail, options and contextual pin controls to semantic runtime tokens; verify sorting, tag navigation, viewMode and pin contexts remain unchanged.
- [ ] 8.2 Run Tags-focused harnesses, `npx tsc --noEmit` and manual checks for list/grid, collage overlays, selected-tag results, search, empty/error/loading, pin/rating coexistence and Dark + Original parity.
- [ ] 8.3 Inspect the Etiquetas diff for stale captures, literals or domain changes, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 9.

## 9. Saved Title Detail and TMDB Remote Detail

- [ ] 9.1 Migrate saved title detail surfaces, selections, inputs/placeholders, notes, rating controls, pin, errors and destructive actions; verify autosave, domain values, tag behavior and header coherence remain unchanged.
- [ ] 9.2 Migrate TMDB remote detail surfaces, posters/placeholders, providers, actions, loading/errors and disabled state; verify save/open/detail/credential/remote behavior is unchanged.
- [ ] 9.3 Run detail-focused harnesses, `npx tsc --noEmit` and manual checks for headers/content, form states, rating ranges, pin, destructive actions, remote providers/errors, Dark + Original and runtime Light/palette changes.
- [ ] 9.4 Inspect the two-detail-screen diff for stale colors or functional changes, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 10.

## 10. Settings main, TMDB Settings and About/Credits

- [ ] 10.1 Migrate Settings main and its progress/disabled/error/action surfaces while preserving backup navigation and behavior.
- [ ] 10.2 Migrate TMDB credential settings inputs, placeholders, show/hide, disabled, feedback, danger and link/focus states; verify credential lifecycle/storage/request behavior is unchanged.
- [ ] 10.3 Migrate About/Credits surfaces and links while preserving the exact TMDB notice, exact JustWatch attribution and untinted/unfiltered `tmdb-primary-full-blue.png`; validate logo contrast through its surrounding surface only.
- [ ] 10.4 Run Settings/TMDB/About-focused checks and `npx tsc --noEmit`; manually verify keyboard/focus, links, credential errors, branding and Dark + Original plus representative Light palettes.
- [ ] 10.5 Search all migrated app/src consumers for old `colors` imports and significant themeable literals, inspect the Section 10 diff for behavioral/branding changes, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 11.

## 11. Backup v4, portable Appearance and compatibility

- [ ] 11.1 Define pure backup v4 types and creator extending v3 with optional `appearance`, including only trustworthy `confirmedPersisted { scheme, palette }`; verify output excludes effective/system scheme, resolved tokens and browsing preferences.
- [ ] 11.2 Implement v4 parsing that preserves current item/pin validation and returns Appearance as valid, absent or incompatible; verify missing Appearance and unknown palette never make a processable envelope fatal.
- [ ] 11.3 Extend the common parser to accept v4 while retaining exact v1/v2/v3 behavior and treating their missing Appearance as preserve-local; run all historical fixtures plus explicit local-Appearance-preservation cases.
- [ ] 11.4 Extend export snapshot/orchestration with explicit availability states: known `confirmedPersisted` includes its real value; successful no-row includes contractual Dark + Original; invalid row or read/storage error without trustworthy confirmation omits Appearance while continuing items/pins export. Verify pending/failed optimistic UI and visual fallback are never exported as confirmed.
- [ ] 11.5 Add the explicit read-error round-trip harness: Appearance read throws → v4 data export succeeds without `appearance` → import restores eligible items/pins → destination Appearance remains unchanged; verify omission may be reported without blocking export.
- [ ] 11.6 Reserve a monotonic deferred Appearance intent ID when a valid v4 import is confirmed, without displaying or writing it; discard the reservation on cancel/rejection/thrown merge and activate it after successful main merge only if no newer intent exists.
- [ ] 11.7 Add the required late-merge harness: confirm import A → main merge pending → user selects/writes B → merge succeeds late; prove items/pins import succeeds while imported A is discarded and final `displayed`, storage, `confirmedPersisted` and restart remain B.
- [ ] 11.8 Persist an activated imported Appearance only after the main backup mutation has fully exited its existing queue entry/transaction, through a fresh call to the public Appearance setter; add structural instrumentation/checks proving no nested queue or transaction and exactly one Appearance queue entry/transaction.
- [ ] 11.9 Report Appearance application success, supersession, absence, incompatibility or persistence failure separately from item/pin results; verify valid library + unknown palette, newer user intent and v4 without Appearance all preserve the correct local Appearance.
- [ ] 11.10 Add focused Node `.cjs` coverage for v4 present/absent round-trip, v1/v2/v3 compatibility, unknown palette, invalid scheme, partial item/pin outcomes, cancel/rejected/thrown merge, Appearance write failure, repeated import and export from actual `confirmedPersisted` after superseded-success/latest-failure.
- [ ] 11.11 Update Settings export/import confirmation/result copy for v1-v4 without changing merge semantics, run all backup/storage harnesses and `npx tsc --noEmit`, inspect the data-safety and queue-boundary diff, then STOP for selective staging, real diff, external review and a dedicated checkpoint commit/push before Section 12.

## 12. Accessibility, Android/iOS/web matrix and final regression

- [ ] 12.1 Validate the complete Light/Dark × six-palette catalog for text/surfaces, accents/onAccent, `selectedSurface`/`selectedForeground`/`selectedBorder`, borders, inputs/placeholders, disabled, danger, rating pairs, links, pins, overlays and focus; record and resolve every failing combination without changing semantic meanings, treating the Section 1 Light gate as an early invariant rather than a substitute for this complete audit.
- [ ] 12.2 Manually validate Android physical device across all schemes/palettes, runtime System changes, restart/hydration, rapid selections including A-success/B-failure, resize/rotation where applicable, StatusBar, pin/rating coexistence and operation without TMDB credential.
- [ ] 12.3 Manually validate iOS physical device across the same matrix, including splash/gate, runtime System changes, safe areas, StatusBar, keyboard inputs and persistence.
- [ ] 12.4 Manually validate web reload/first paint, all schemes/palettes, runtime `prefers-color-scheme`, DOM/browser surfaces, scrollbars, keyboard/focus, narrow/wide resize and responsive previews.
- [ ] 12.5 Manually validate Biblioteca detail/grid, Search, Tags, both detail screens, Settings, credential settings and About; confirm exact branding copy/asset and unchanged functional navigation/domain behavior.
- [ ] 12.6 Manually validate export/import v4 with Appearance present and absent, v1/v2/v3 fixtures, unknown-palette result, cancelled/rejected restore, import pending followed by newer user selection, restart after imported Appearance and local-first behavior with no network/credential.
- [ ] 12.7 Simulate hydration/read error, stale retry followed by newer successful/failed writes, superseded success followed by latest persistence failure, global queue rejection/recovery and Appearance backup-write failure; verify truthful fallback/rollback/export behavior and intact library/pins/preferences.
- [ ] 12.8 Run every focused `.cjs` harness, `npx tsc --noEmit` and `npx.cmd openspec validate add-global-appearance-themes --strict`; record exact results and resolve failures within scope.
- [ ] 12.9 Perform a final structural search for palette-specific branches in screens, duplicate preview/CSS palettes, old theme imports, static color captures, unintended dependency/config changes and modified browsing/TMDB/domain behavior.
- [ ] 12.10 Conduct the final external feature diff review against the pre-feature baseline, with special attention to protected `app.json`/`package.json` hunks, Dark + Original parity, backup compatibility/data safety, accessibility and scope exclusions; STOP for approval and a dedicated final checkpoint commit/push before Archive.
