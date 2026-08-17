## Context

See `proposal.md` for motivation and the three delta specs for behavior. The current visual system has four independent sources: `src/theme/colors.ts`, a private five-token dark palette in `app/_layout.tsx`, hardcoded DOM colors in `global.css`, and literals in application/components. Most screens calculate themed values during render, but `LayoutOption`, `PosterPlaceholder`, `TagCollage`, `TitleGridCard` and `ViewOptionsPanel` capture colors in module-level `StyleSheet.create`. `PersonalRatingBadge` resolves colors during render but currently reads semantic pairs from the static palette.

React Navigation receives a constant `navDark`; Tabs and detail headers override colors separately; the only effective Expo Router StatusBar is hardcoded `light`. No `useColorScheme`, `Appearance`, `PlatformColor`, `DynamicColorIOS`, CSS variables or `prefers-color-scheme` bridge exists. `app.json` currently declares `userInterfaceStyle: "dark"` and contains a protected personal hunk.

`app_preferences(key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)` already exists at SQLite schema v3. `viewPreferencesRepo` is intentionally scoped to browsing and initializes SQLite asynchronously. The current backup is v3 `{ version, exportedAt, items, pins }`; export reads only titles and pins, and parsing/merge supports v1/v2/v3. `app.json` and `package.json` have protected unstaged changes. Apply must preserve them while installing the sole approved dependency, the Expo SDK 54-compatible `expo-system-ui`; no other dependency is authorized.

## Goals / Non-Goals

**Goals:**

- Establish one typed resolved theme contract shared by runtime UI, navigation, web synchronization and previews.
- Make theme changes reactive without replacing React Native `StyleSheet` or forcing palette knowledge into screens.
- Preserve byte-for-byte token values and equivalent composition for Dark + Original wherever the current value is the intentional baseline.
- Centralize hydration, optimistic updates, last-intent-wins persistence, recoverable errors and backup application.
- Keep appearance storage and failure independent from TMDB credential, remote data and browsing preferences.
- Split implementation into reviewable checkpoints with focused pure harnesses and platform validation.

**Non-Goals:**

- A generic design-system framework, runtime theme editor, downloaded palettes or public plugin API.
- A second persistence mechanism for faster web paint.
- Refactoring functional screen/domain behavior while replacing visual reads.
- Numerical WCAG certification tooling or a new test framework; contrast still requires explicit review of every supported combination.

## Decisions

### 1. Separate persisted intent, effective scheme and resolved definition

Use three distinct values:

```text
AppearancePreference { scheme, palette }
              + reactive systemScheme
                         |
                         v
effectiveScheme = scheme === system ? systemScheme : scheme
                         |
LightBase or DarkBase + palette overrides for effectiveScheme
                         |
                         v
complete immutable ThemeDefinition
```

`AppearanceScheme` is `system | light | dark`; `EffectiveScheme` is only `light | dark`; `AppearancePaletteId` is a closed catalog. Screens receive the complete `ThemeDefinition` and never branch on palette IDs. A palette definition contains partial light/dark overrides, not duplicate complete themes. The resolver starts from the selected base, applies only allowed palette overrides, then attaches scheme-specific semantic and structural tokens and returns a complete immutable value.

Alternatives rejected: complete independent themes duplicate unchanged values and make light/dark parity drift; scheme-specific palette preferences violate the approved model; a mutable `colors` singleton neither notifies React nor updates captured StyleSheets; runtime-generated Material You expands product and accessibility scope.

### 2. Use a minimal consumer-driven token contract

The first `ThemeDefinition` contains:

- Global: `background`, `surface`, `surfaceSecondary`, `inputBackground`, `textPrimary`, `textSecondary`, `textMuted`, `border`, `borderStrong`, `accent`, `onAccent`, `selectedSurface`, `selectedForeground`, `selectedBorder`.
- Semantic: `dangerSurface`, `dangerBorder`, `dangerText`, `onDangerSurface`, `disabledSurface`, `disabledText`, plus background/foreground pairs for personal rating low, medium and high.
- Structural image/modal: `imageOverlay`, `imageOverlayMedium`, `imageOverlayStrong`, `imageOverlayLabel`, `onImageOverlay`, `onImageOverlaySecondary`, `imageOverlayBorder`, `modalBackdrop`.
- Runtime metadata: effective scheme or an equivalent semantic flag sufficient to derive StatusBar and web `color-scheme`.

The global group is palette-overridable under controlled typing. Semantic and structural groups are selected by effective scheme and are not arbitrary palette overrides. `onAccent` is explicit because accents can be light. Selection is an independent, palette-overridable trio: `selectedSurface`, `selectedForeground`, `selectedBorder`. `selectedForeground` is mandatory because neither `textPrimary` nor `onAccent` is generally valid over a selected surface; consumers never infer or alias it automatically. Dark + Original resolves that trio to current `primary #ffffff`, current `bg #0b0b0b`, current `primary #ffffff`. Colored palettes override `selectedForeground` whenever their selected surface requires it. Disabled tokens are justified by repeated `#303030/#3b3b3b` literals. `dangerText` represents standalone danger/error feedback, while scheme-aware `onDangerSurface` is the contrasting foreground placed on `dangerSurface`; palettes cannot override either semantic role. `imageOverlay`, `imageOverlayMedium` and `imageOverlayStrong` represent the three consumer-proven TitleGridCard scrim intensities. `imageOverlayLabel` represents exclusively the consumer-proven label/count scrim placed over the four arbitrary posters in `TagGridCard`/`TagCollage`. `onImageOverlay` is the primary foreground over structural image scrims, while `onImageOverlaySecondary` is the secondary metadata foreground proven by the TagGridCard count; neither role may be sourced from palette-overridable global text tokens. All remain structural and palette-independent in both schemes; the scrims remain dark over arbitrary images, and these proven responsibilities do not authorize additional preventive levels. No typography, spacing or motion tokens are introduced.

DarkBase + Original uses the current values from `colors.ts`; the root navigation duplicate, CSS scrollbar values, disabled literals and overlay literals are recorded in a parity fixture before migration. Reclassification changes ownership, not Dark + Original output. The parity fixture also records semantic foregrounds by `consumer/file → current value → future responsibility/token`, rather than inferring their meaning from equal hex values elsewhere. At minimum it captures:

- `app/settings/tmdb.tsx` feedback/error text `#f4b8b8` → candidate `dangerText` responsibility, independently of PersonalRating low background using the same value.
- `app/title/[id].tsx` rating error text `#5a2a2a` → current danger-border-as-text presentation, to preserve explicitly or identify as a separately reviewed future accessibility correction before migration.
- `app/settings/tmdb.tsx` disabled surface `#303030` with current foreground `colors.text #f2f2f2`, and `app/(tabs)/ajustes.tsx`, `app/title/[id].tsx` and `app/tmdb/[type]/[id].tsx` disabled surface `#3b3b3b` with their actual current `colors.text #f2f2f2` foregrounds → disabled surface/text responsibility.
- Current danger surfaces using `colors.danger #4a1f1f` with `colors.text #f2f2f2` resolve separately to `dangerSurface` and `onDangerSurface`, rather than reusing standalone `dangerText`.

For Dark + Original, the exact semantic danger values are `dangerSurface #4a1f1f`, `dangerBorder #5a2a2a`, standalone `dangerText #f4b8b8` and `onDangerSurface #f2f2f2`. Light defines a scheme-appropriate `onDangerSurface` with adequate contrast against its Light `dangerSurface`. The exact structural values are `imageOverlay rgba(11, 11, 11, 0.78)` for the TitleGridCard title scrim, `imageOverlayMedium rgba(11, 11, 11, 0.82)` for its type badge, `imageOverlayStrong rgba(11, 11, 11, 0.90)` for its pin and `imageOverlayLabel rgba(11, 11, 11, 0.94)` for the TagGridCard name/count directly over TagCollage. The primary structural foreground `onImageOverlay` is `#f2f2f2`; the TagGridCard name uses it, while its count uses the secondary structural foreground `onImageOverlaySecondary #bdbdbd`. Light and Dark share these structural values because they protect content over images, not general app surfaces. The former `tagLabelOverlay` inventory is therefore resolved to `structural.imageOverlayLabel`, and the TagGridCard count foreground is resolved to `structural.onImageOverlaySecondary`; no additional overlay or foreground level is introduced preventively.

If one semantic foreground token cannot preserve multiple current presentations, implementation keeps the token catalog consumer-driven and minimal, documents the unmatched consumer and defers any visual correction to an explicit accessibility decision. It does not silently treat a rating color as proof of danger parity or normalize consumers during migration.

Section 1 also applies a narrow, pure Light invariant based on WCAG relative luminance calculation `(0.2126 R + 0.7152 G + 0.0722 B)` after sRGB linearization. For every resolved Light palette, `background`, `surface`, `surfaceSecondary` and `inputBackground` each require relative luminance `>= 0.50`; `textPrimary` must have lower luminance than `background`, and their contrast ratio must be `>= 4.5:1`. These documented thresholds reject obviously dark definitions such as `#111111`/`#eeeeee` while remaining intentionally narrower than the complete Section 12 audit of every token/state pair.

Alternative rejected: retaining names such as `bg/card/card2/primary` preserves ambiguous inverse-text coupling (`colors.bg` as content over `primary`) and cannot safely support colored accents.

### 3. AppThemeProvider is the only reactive source

Add an `AppThemeProvider` at the root with `useAppTheme()`. Its stable context exposes:

- `confirmedPersisted`, latest intent and currently displayed `AppearancePreference` as distinct states;
- hydration status and recoverable storage status;
- reactive system and effective schemes;
- resolved ThemeDefinition;
- `setScheme`, `setPalette` and retry as intent operations.

The provider wraps the Navigation `ThemeProvider`; the Navigation theme is memoized from the same ThemeDefinition. Root Stack options, Tabs options, detail header overrides, icons and StatusBar read the hook/definition. `TmdbCredentialProvider` remains behaviorally independent; no theme decision waits for it.

Theme changes are rare, so context rerenders are acceptable. Memoizing ThemeDefinition, Navigation theme and provider value prevents unrelated rerenders. Previews call the same pure resolver for candidate `{ effectiveScheme, palette }` definitions and receive those definitions locally; they do not switch global context just to render.

Alternatives rejected: prop-drilling through every route; keeping React Navigation and app palettes separate; a global external mutable store for a low-frequency React-owned concern.

### 4. Keep structural StyleSheets and make only color fragments reactive

Module-level `StyleSheet.create` retains spacing, layout, typography, positioning and opacity. Theme-dependent `color`, `backgroundColor`, `borderColor`, `shadowColor` and icon props come from render-time fragments or small `useMemo` style factories keyed by ThemeDefinition.

Concrete failure being prevented:

```text
module loads under Dark + Original
→ StyleSheet.create captures dark card/text
→ provider publishes Light + Marea
→ component rerenders
→ captured style still contains dark values
→ render-time icon may use light value
→ one component mixes old and new themes
```

The five known capture modules are mandatory migration targets. `PersonalRatingBadge` retains geometry statically and obtains its semantic pair from the effective theme during render. TitleGridCard title/type/pin foreground moves to `onImageOverlay`; its scrims remain structural dark tokens so Light does not make arbitrary posters unreadable.

Alternative rejected: recreate every full StyleSheet on every render or replace StyleSheet with another styling library.

### 5. Persist one versioned Appearance JSON value in app_preferences

Create an Appearance-specific core parser and storage repository, separate from `viewPreferencesRepo`. Use the stable key `appearance`; its value serializes one logical object, for example `{ "version": 1, "scheme": "dark", "palette": "original" }`. Future payload v2 continues under the same key and is handled by explicit parser/migration logic rather than creating a second preference key. One row prevents observing scheme and palette from different writes and leaves room for payload evolution. `updated_at` remains the write timestamp.

The existing SQLite schema remains version 3: no table/column/index changes are required. Initialization still idempotently verifies `app_preferences`. A successful read with no row establishes the contractual Dark + Original default as trusted `confirmedPersisted`. An invalid row displays Dark + Original safely but is not treated as a trustworthy persisted intention until repaired by a successful write; export may omit it just like unavailable Appearance. A thrown storage read is represented separately from both states so the provider can expose retry while using the safe fallback. No TMDB data or browsing key passes through this repo.

Alternatives rejected: two keys allow torn logical state; reuse of `viewPreferencesRepo` conflates domains; SecureStore is inappropriate for a non-secret portable setting; a second synchronous web store creates two sources of truth.

### 6. Centralize optimistic last-intent-wins coordination

The provider owns one intent coordinator rather than screen-local write queues. It maintains separate state for `latestIntent`/`displayed` and `confirmedPersisted`. `confirmedPersisted` is the last Appearance known to have been written successfully (or the contractual default after a successful read proving the row is absent), not merely the last non-superseded UI intent. Each selection creates a monotonically increasing intent ID, updates `displayed` immediately, then enters a serialized promise chain. Before a write begins the coordinator may coalesce superseded queued intents; a coalesced value never changes `confirmedPersisted`. Every write that actually finishes successfully MUST update `confirmedPersisted` to the value it wrote, even when superseded. That success MUST NOT replace `displayed` while a newer intent exists. The chain catches each failure so it remains usable.

Required invariant:

```text
confirmedPersisted C
→ select A; displayed A; enqueue intent 1
→ select B; displayed B; enqueue intent 2
→ write A succeeds
→ confirmedPersisted becomes A because storage is now A
→ displayed remains B because intent 2 is newer
→ write B fails
→ displayed rolls back to confirmedPersisted A
→ UI, storage and restart all resolve to A
```

If A is coalesced before its write starts, storage remains C and `confirmedPersisted` remains C. On failure of the latest intent, `displayed` returns to the current `confirmedPersisted`, including any superseded write that succeeded in the meantime, and a recoverable message is exposed. A superseded failed intent cannot change `confirmedPersisted`, is logged and does not interrupt the latest intent. A latest success aligns `displayed`, storage and `confirmedPersisted`. Retry re-submits the latest desired or confirmed-persisted operation explicitly; it does not silently claim persistence.

Alternatives rejected: fire-and-forget writes permit stale completion order; rollback inside the Appearance screen alone loses changes triggered by backup and cannot protect a global setting; copying `PersonalRatingIntentQueue` without adaptation would couple unrelated domain semantics.

### 6.1 Compose every Appearance write through the global SQLite mutation contract

The Appearance intent coordinator decides which logical intent is eligible to write, but it does not replace the repository-wide storage serialization invariant. The public mutation follows exactly:

```text
setAppearancePreference(preference)
→ initDb()
→ runSerializedStorageMutation(() =>
     db.withTransactionAsync(() =>
       setAppearancePreferenceWithDb(db, preference, updatedAt)
     )
  )
```

There is exactly one entry into `runSerializedStorageMutation` and exactly one `db.withTransactionAsync` per public Appearance write. `setAppearancePreferenceWithDb` only validates/executes the row operation against the supplied db; it does not call `initDb`, re-enter the queue, start a transaction or call the public setter. A rejection is caught at the public/coordinator boundary so the existing global queue chain remains usable.

Normal hydration/read/retry does not enter the mutation queue merely for reading. The coordinator's own serialized logical chain can await the public setter, but no public setter may be invoked from inside an already active Appearance `*WithDb` transaction. Existing title/pin/backup mutation semantics remain unchanged.

Alternatives rejected: using only the intent promise chain fails to serialize with other SQLite mutations; placing queue/transaction logic in `*WithDb` creates recursion/nesting; queueing ordinary reads would add contention without protecting a mutation.

### 7. Hydrate behind a short canonical gate

The provider begins with a resolved Dark + Original bootstrap but marks hydration pending. Root renders the splash-compatible/bootstrap surface and withholds the principal router UI until the Appearance read resolves. It does not wait for TMDB credential or network. Success publishes the stored effective theme once before main UI; absence/invalid data publishes Dark + Original; storage error publishes Dark + Original, unlocks UI and exposes retry.

```text
stored Light + Marea
→ process starts with Dark + Original bootstrap
→ provider opens/initializes SQLite asynchronously
→ main UI remains gated
→ parser returns Light + Marea
→ provider publishes effective definition
→ main UI appears once with Light + Marea
```

On web, `global.css` retains a static Dark + Original bootstrap. The brief pre-hydration dark surface is accepted. No mirrored localStorage is added. Native splash coordination may retain the existing splash until theme hydration, but the gate must have a bounded error path and must not become a long loading screen.

Hydration and retry reads capture a read generation plus the current Appearance intent/mutation revision when they start. They may publish a row/default/error baseline only if that identity is still current when they finish. Any newer reserved intent, user selection or completed write invalidates the older read result. A stale read is ignored; it cannot replace `displayed` or `confirmedPersisted`.

```text
initial read fails; fallback is visible
→ retry captures read generation R and intent revision 0
→ retry reads old A asynchronously
→ user selects B; intent revision becomes 1
→ B write succeeds; confirmedPersisted becomes B
→ retry R returns A
→ R is stale against revision 1 and is discarded
→ displayed/storage/confirmedPersisted/restart remain B
```

If the newer B write fails, rollback uses the `confirmedPersisted` current at failure time. The stale retry snapshot still cannot replace it. Retry can be requested again under a new generation.

### 8. Follow System reactively on all platforms

Use React Native's reactive color-scheme source (`useColorScheme` or an equivalent subscription backed by Appearance/matchMedia) inside the provider. `systemScheme` changes recompute effective scheme only when persisted scheme is `system`; they never enqueue a preference write.

`app.json` currently forces `userInterfaceStyle: "dark"`. During the navigation/runtime section, change it narrowly to `automatic` and install `expo-system-ui` through the Expo SDK 54-compatible version so Android native receives the required System UI integration. Inspect the resolved Expo config/CNG output and register the `expo-system-ui` config plugin only when the actual project configuration requires it. Preserve the existing personal `android.package` hunk and the personal scripts in `package.json`, plus the resulting lockfile changes attributable to this one dependency. Web relies on the runtime subscription and synchronizes DOM after hydration; CSS `prefers-color-scheme` is not treated as a second resolved theme catalog.

`useColorScheme` remains the only runtime React source for the observed system scheme. `expo-system-ui` enables/configures the native Android behavior; the provider does not read or maintain a second SystemUI theme state, and a runtime system change does not enqueue an Appearance write. Expo config/introspection verifies generated configuration, while physical Android runtime validation verifies the actual light/dark transition and foreground/background coherence.

Alternative rejected: reading scheme once at startup misses OS/browser changes.

### 9. Synchronize React Navigation, StatusBar and web from ThemeDefinition

Remove the private root palette and derive Navigation's `dark` flag and colors (`background`, `card`, `text`, `border`, `primary`, notification if used) from the effective definition. Root Stack, nested Tabs and screen header overrides consume the same values. StatusBar style derives from effective scheme, not palette name.

On web, a small effect applies effective tokens as CSS custom properties/DOM style values and sets `color-scheme` on the document root. `global.css` consumes those variables with Dark + Original fallbacks for `html/body/#root`, scrollbars and focus treatment. Theme values originate in TypeScript; CSS does not duplicate palette tables. If browser theme-color is supported through an existing safe mechanism, it is updated from background; otherwise it remains a documented manual/browser check rather than adding a dependency.

Failure prevented:

```text
palette changes
→ one ThemeDefinition is published
→ Navigation theme, explicit headers, Tabs and DOM variables derive from it
→ no light screen + stale dark header
→ no new accent + old tab bar
```

### 10. Appearance screen uses real resolved previews

Add `app/settings/appearance.tsx` as a normal Stack screen and a Settings entry. Scheme controls display Spanish labels `Del sistema`, `Claro`, `Oscuro`; palette labels use the approved product names, with Obsidiana's display name isolated as catalog metadata so copy can change without an architecture change.

Each preview resolves the catalog palette against the current effective scheme and draws an abstract composition using background, surface, surfaceSecondary, text, accent and border/selection tokens. Mobile uses a horizontal accessible collection. Wide layouts use measured available width and wrapping/grid behavior rather than a frozen arbitrary breakpoint; resize/rotation is part of validation.

Selection is immediate and has label, `accessibilityState.selected`, check/icon and border/indicator. Pressed, disabled, focus and keyboard behavior remain explicit. There is no Apply button.

### 11. Preserve semantic states, overlays and external branding

Danger/error/destructive and rating pairs are resolved by scheme outside palette overrides. Personal rating ranges and composed accessibility labels remain unchanged. Disabled uses semantic surface/text plus existing `disabled`/accessibility state rather than color alone. Active tabs retain filled/outline icon differences in addition to accent. Links retain link roles and gain theme-coherent visual/focus affordance.

`TitleGridCard` poster scrims remain dark structural values; pin remains passive `diamond-outline` top-right. Rating/pin layout is regression-tested at long titles and narrow card widths. `settings/about.tsx` keeps `assets/tmdb-primary-full-blue.png` without `tintColor`/filter, the exact TMDB notice and exact JustWatch attribution. Theme changes only the surrounding surface/text; contrast failure is solved with a suitable themed/neutral container or a separately approved official asset, never recoloring.

### 12. Backup v4 treats Appearance as lower-priority portable intent

Add pure v4 types/parser/creator alongside v1-v3. Export snapshots items and pins plus Appearance only when the export layer has a reliable portable intention:

```json
{
  "version": 4,
  "exportedAt": "...",
  "items": [],
  "pins": [],
  "appearance": { "scheme": "system", "palette": "lavender" }
}
```

The export source has three explicit states:

```text
valid row or runtime confirmedPersisted known
→ include the actual confirmedPersisted { scheme, palette }

successful read with no row
→ absence is known, so Dark + Original is the contractual intention
→ include Dark + Original

invalid row, or storage/read error, and no trustworthy confirmedPersisted
→ continue exporting items/pins
→ omit appearance (optionally report the omission)
→ never serialize the visual fallback as if the user persisted it
```

Therefore `appearance` is optional in the v4 envelope for the explicit unavailable case. Parsing separates main-envelope validity, item/pin results and Appearance applicability. Known valid Appearance is retained as portable intent. Missing Appearance means preserve local. Unknown/invalid Appearance yields an issue value rather than rejecting an otherwise processable v4. v1-v3 also normalize Appearance to absent, meaning preserve local.

Import ordering:

```text
parse/preview backup
→ user confirms and reserves a monotonic deferred Appearance intent ID
→ merge items and pins under existing serialized storage contract
→ merge returns its real completed result (including reported partial item/pin issues)
→ if main restoration completed and reserved intent is still latest, activate it
→ activated intent persists through central coordinator/public Appearance mutation
→ provider updates `confirmedPersisted` and UI after the Appearance write succeeds
→ show combined result
```

Reserving the ID at user confirmation records the real time of the imported intent without displaying or writing it before the main merge succeeds. Cancel, rejected envelope or thrown merge discards the reservation. Any user selection after confirmation receives a greater ID and permanently supersedes the reserved import; late merge success then restores items/pins but discards the older Appearance intent.

```text
confirm import A → reserve intent 10; do not display/write A
→ main merge pending
→ user selects B → intent 11; display/write B
→ merge succeeds late
→ reserved intent 10 is older, so discard A
→ library/pins import succeeds
→ displayed/storage/confirmedPersisted/restart remain B
```

The main backup restoration completes and exits its existing queue/transaction before the Appearance public setter is invoked. Appearance therefore enters the global mutation queue as a new independent operation; it is never nested inside the backup queue entry or transaction.

“Successful restoration” here means the accepted main import operation returned a result instead of throwing/being rejected; existing per-item partial failures remain reportable and do not erase successful work. If the post-merge Appearance write fails, restored library/pins remain committed, local `confirmedPersisted` Appearance is preserved and the result reports the separate Appearance failure. Applying Appearance is not folded into the item/pin SQLite transaction because the runtime coordinator and UI confirmation must share one source of truth; this deliberate partial boundary matches the requirement that Appearance is lower priority than data.

Unknown palette sequence:

```text
valid library + unknown palette
→ parser marks Appearance incompatible, not envelope invalid
→ import restores eligible library/pins
→ no Appearance write occurs
→ local Appearance remains
→ result reports Appearance incompatibility
```

Read-error export/import sequence:

```text
Appearance read throws; no confirmedPersisted exists
→ app is usable with Dark + Original visual fallback
→ export still snapshots library/pins
→ v4 omits appearance rather than inventing fallback intent
→ importing that v4 restores eligible data
→ destination Appearance remains unchanged
```

Alternatives rejected: exporting ThemeDefinition/effective scheme makes backup device-dependent; failing or blocking data export because Appearance is unavailable gives cosmetic intent higher priority than user data; exporting the visual fallback lies about persistence; applying before merge can change UI for a cancelled or rejected restore.

### 13. Files and layers affected

Expected areas, subject to exact filenames established during Apply:

- `src/theme/`: definitions, bases, palette catalog/resolver, semantic/structural tokens, provider/hook and web synchronization helper.
- `src/core/` and `src/storage/`: AppearancePreference parsing/intent coordination/repository using `app_preferences`; no `SavedTitle` or schema-version change.
- `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/settings/appearance.tsx`, `app/(tabs)/ajustes.tsx`: provider, navigation, StatusBar, route and entry.
- Shared capture modules: `LayoutOption.tsx`, `PosterPlaceholder.tsx`, `TagCollage.tsx`, `TitleGridCard.tsx`, `ViewOptionsPanel.tsx`; semantic `PersonalRatingBadge.tsx`.
- Screens: Biblioteca, Buscar, Etiquetas, saved title detail, TMDB detail, Settings, credential settings and About.
- Web/config: `global.css`; `userInterfaceStyle: "automatic"`; the Expo SDK 54-compatible `expo-system-ui` dependency and, only if required by actual Expo/CNG configuration, its config-plugin entry. Preserve unrelated personal hunks in `app.json`/`package.json` and keep lockfile changes attributable only to this dependency.
- Backup: current core v1/v2/v3 contracts plus new v4 creator/parser, export snapshot, import orchestration/results and Settings copy.
- Focused Node `.cjs` harnesses following the repository's existing pattern.

`expo-system-ui` is the single justified dependency exception required for Android native System behavior on Expo SDK 54. No other dependency is justified or authorized.

## Risks / Trade-offs

- [Dark + Original drifts during semantic renaming] → Capture the current token/literal mapping first, add a parity harness where structurally possible and visually review navigation, overlays, disabled, ratings, pins and branding before adding expressive palettes.
- [A module-level StyleSheet retains dark values] → Migrate and structurally search all imports/color-bearing `StyleSheet.create`, including the five known modules; rerun literal/import inventories after every screen section.
- [A superseded success is ignored and a later failure rolls UI behind storage] → Every successful write updates `confirmedPersisted` even when superseded; only `displayed` obeys latest intent, and the explicit A-success/B-failure harness proves rollback to A.
- [Appearance intent serialization bypasses the product-wide SQLite queue] → Public setter enters the global queue and one transaction exactly once; `*WithDb` is queue/transaction-free and structural tests reject nesting.
- [A late backup merge creates a new latest Appearance after a newer user choice] → Reserve the import intent ID at confirmation, activate only after successful merge and discard it if any newer intent exists.
- [A stale hydration retry overwrites a newer successful write] → Reads carry generation plus intent revision and publish only while current; stale results are discarded and rollback always uses live `confirmedPersisted`.
- [Provider waits forever on SQLite] → Hydration always resolves to success/absence/invalid/error; error unlocks Dark + Original and exposes retry, without waiting for TMDB.
- [Web displays React theme over stale DOM/CSS] → One effect writes effective variables and `color-scheme`; CSS contains only bootstrap fallbacks, not palette definitions; verify reload and runtime system changes.
- [Twelve scheme/palette combinations multiply contrast work] → In Section 1, validate the complete 2×6 resolved catalog plus the documented relative-luminance Light gate and explicit `selectedSurface`/`selectedForeground` pair; before final release, validate semantic, focus, placeholder, selected and disabled pairs comprehensively in Section 12.
- [Palette overrides create incomplete themes] → Resolver always begins with a complete base and returns a complete typed definition; screens cannot access partial overrides.
- [Theme context causes broad rerenders] → Theme changes are user/system-driven and rare; memoize definitions/context and keep non-color StyleSheets static.
- [Installing `expo-system-ui` overwrites protected app/package work] → Inspect the pre-install diffs, install only the Expo SDK 54-compatible package, add its config plugin only if Expo/CNG introspection requires it, then verify the personal `android.package` and package scripts remain byte/logically intact. Stage only the feature-owned `userInterfaceStyle`, dependency/lockfile and required plugin hunks at the later checkpoint.
- [Android accepts the enum but does not follow System at runtime] → Validate resolved Expo config/introspection after installing `expo-system-ui`, then verify a physical Android build follows light/dark changes while the persisted scheme remains `system`; do not treat schema acceptance alone as runtime proof.
- [Backup Appearance write fails after data merge] → Treat it as an explicitly reported lower-priority partial failure; preserve restored data and `confirmedPersisted` local Appearance.
- [Appearance read error causes export of a false Dark + Original choice] → Model Appearance availability explicitly; export v4 without `appearance`, preserve import destination Appearance and never block items/pins export.
- [Older app cannot import newly exported v4] → This is the declared export-format break. Preserve v1-v3 import fixtures and document rollback/export compatibility before deployment.
- [Official TMDB logo loses contrast] → Validate on all themes and adjust only its surrounding surface or investigate an official asset through a separate approved decision.
- [Scope expands into visual redesign] → Dark parity and consumer-driven token mapping are acceptance gates; each section changes ownership/reactivity, not layout/domain behavior.

## Migration Plan

1. Record Dark + Original baseline and introduce pure definitions/resolver with no visible switch.
2. Add Appearance parser/repository/coordinator/provider and hydration gate using existing schema v3; verify the single global queue/transaction write contract, missing/invalid/error paths and stale-read protection before exposing controls.
3. Connect root Navigation, Tabs, StatusBar, web variables and any necessary narrow System config change; verify runtime switching with a temporary/internal harness before screen rollout.
4. Add Settings route and real previews, then migrate shared static captures and screens in bounded groups, keeping Dark + Original as the checkpoint baseline.
5. Add backup v4 after the central `confirmedPersisted`/availability/deferred-intent API exists; retain all v1-v3 fixtures and add late-merge supersession, absent-Appearance, read-error, unknown-palette and partial-failure reporting.
6. Complete the 2×6 contrast/platform matrix, focused harnesses, TypeScript, strict OpenSpec and external diff review before Archive.

Rollback within the same SQLite schema leaves the stable `appearance` row unused and preserves all existing data. Reverting UI/runtime sections restores Dark + Original constants without data migration. Reverting after v4 export requires retaining a v4-capable importer or warning that older code cannot import new files; never down-convert or delete user backups automatically. Every Apply section stops for diff/test review and checkpoint before continuing.

## Open Questions

- The provisional display name “Obsidiana” may change as catalog copy without changing the palette ID, persistence, specs or architecture.
- Exact palette hex values and the precise responsive width at which previews wrap remain implementation/design-review details, constrained by contrast tests and measured layout rather than a product-contract change.
- Browser `theme-color` support can be adopted if Expo/web metadata permits runtime updates without a second theme source; otherwise correct document background and `color-scheme` remain the required baseline.
