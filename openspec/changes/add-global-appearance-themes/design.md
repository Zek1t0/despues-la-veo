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

The final closed display catalog for this feature is ordered `Original`, `Manzana verde`, `Marea`, `Crepúsculo de medianoche`, `Lavanda`, `Obsidiana`, `Pinky Clouds`. Their stable internal IDs remain `original`, `green-apple`, `tide`, `midnight-twilight`, `lavender`, `obsidian`, `pinky-clouds`, so the final resolved matrix is Light/Dark × seven palettes = 14 `ThemeDefinition` values. This is the last product expansion of the palette catalog for this feature; further palette design requires a separate product decision rather than extending this change again.

Alternatives rejected: complete independent themes duplicate unchanged values and make light/dark parity drift; scheme-specific palette preferences violate the approved model; a mutable `colors` singleton neither notifies React nor updates captured StyleSheets; runtime-generated Material You expands product and accessibility scope.

### 2. Use a minimal consumer-driven token contract

The first `ThemeDefinition` contains:

- Global: `background`, `surface`, `surfaceSecondary`, `inputBackground`, `textPrimary`, `textSecondary`, `textMuted`, `border`, `borderStrong`, `accent`, `onAccent`, `selectedSurface`, `selectedForeground`, `selectedBorder`.
- Semantic: `dangerSurface`, `dangerBorder`, `dangerText`, `onDangerSurface`, `disabledSurface`, `disabledText`, `personalRatingErrorText`, plus background/foreground pairs for personal rating low, medium and high.
- Structural image/modal: `imageOverlay`, `imageOverlayMedium`, `imageOverlayStrong`, `imageOverlayLabel`, `onImageOverlay`, `onImageOverlaySecondary`, `imageOverlayBorder`, `modalBackdrop`.
- Runtime metadata: effective scheme or an equivalent semantic flag sufficient to derive StatusBar and web `color-scheme`.

The global group is palette-overridable under controlled typing. Semantic and structural groups are selected by effective scheme and are not arbitrary palette overrides. `onAccent` is explicit because accents can be light. Selection is an independent, palette-overridable trio: `selectedSurface`, `selectedForeground`, `selectedBorder`. `selectedForeground` is mandatory because neither `textPrimary` nor `onAccent` is generally valid over a selected surface; consumers never infer or alias it automatically. Dark + Original resolves that trio to current `primary #ffffff`, current `bg #0b0b0b`, current `primary #ffffff`. Colored palettes override `selectedForeground` whenever their selected surface requires it. Disabled tokens are justified by repeated `#303030/#3b3b3b` literals. `dangerText` represents general standalone danger/error feedback, while scheme-aware `onDangerSurface` is the contrasting foreground placed on `dangerSurface`; palettes cannot override either semantic role. The consumer-proven `personalRatingErrorText` represents only standalone persistence error/feedback for PersonalRating: it is scheme-aware, palette-independent, does not replace `dangerText`, and is distinct from the low/medium/high rating range pairs. `imageOverlay`, `imageOverlayMedium` and `imageOverlayStrong` represent the three consumer-proven TitleGridCard scrim intensities. `imageOverlayLabel` represents exclusively the consumer-proven label/count scrim placed over the four arbitrary posters in `TagGridCard`/`TagCollage`. `onImageOverlay` is the primary foreground over structural image scrims, while `onImageOverlaySecondary` is the secondary metadata foreground proven by the TagGridCard count; neither role may be sourced from palette-overridable global text tokens. All remain structural and palette-independent in both schemes; the scrims remain dark over arbitrary images, and these proven responsibilities do not authorize additional preventive levels. No typography, spacing or motion tokens are introduced.

Section 12 confirms that `borderStrong` is the existing global, palette-overridable responsibility for visually necessary control/input boundaries. Because `inputBackground` and the surrounding surface are too close to identify those controls without their boundary, every resolved `borderStrong` used for that responsibility must reach WCAG non-text contrast `>= 3.0:1` against the relevant surface, with a preferred implementation margin around `>= 3.2:1`. This correction strengthens only `borderStrong`; it does not change `border`, `inputBackground`, add an input-specific token or authorize consumer-side colors. `border` remains available for subtle/decorative separation where a functional `3:1` boundary is not required. Before applying the values, implementation inventories every `theme.global.borderStrong` consumer and confirms it genuinely needs a strong boundary; any consumer deliberately depending on subtle presentation is a STOP requiring contract review rather than an automatic new token.

The following table remains the historical Section 12 audit of the six-palette catalog as it existed when that audit was completed. It preserves the evidence for the accessibility corrections made at that checkpoint; it is not the final palette table after the later user-authored visual adjustments:

| Scheme | Palette | Previous | Final | Comparison surface | Previous ratio | Final ratio |
| --- | --- | --- | --- | --- | ---: | ---: |
| Light | Original | `#bdbdbd` | `#8f8f8f` | `#ffffff` | `1.8788:1` | `3.2340:1` |
| Light | Manzana verde | `#bdbdbd` | `#8f8f8f` | `#ffffff` | `1.8788:1` | `3.2340:1` |
| Light | Marea | `#94bcbc` | `#769595` | `#fbffff` | `2.0484:1` | `3.2061:1` |
| Light | Crepúsculo de medianoche | `#aaa0cd` | `#9289af` | `#fdfcff` | `2.3836:1` | `3.2004:1` |
| Light | Lavanda | `#bda9cf` | `#9a89a8` | `#ffffff` | `2.1561:1` | `3.2220:1` |
| Light | Obsidiana | `#a8a8a8` | `#8f8f8f` | `#ffffff` | `2.3779:1` | `3.2340:1` |
| Dark | Original | `#2c2c2c` | `#646464` | `#101010` | `1.3625:1` | `3.2155:1` |
| Dark | Manzana verde | `#2c2c2c` | `#646464` | `#101010` | `1.3625:1` | `3.2155:1` |
| Dark | Marea | `#2d5056` | `#4f6c72` | `#0c181b` | `2.0595:1` | `3.2015:1` |
| Dark | Crepúsculo de medianoche | `#3b3f68` | `#606485` | `#101226` | `1.8449:1` | `3.2193:1` |
| Dark | Lavanda | `#4a3857` | `#6f6179` | `#17121b` | `1.7514:1` | `3.2156:1` |
| Dark | Obsidiana | `#353535` | `#616161` | `#090909` | `1.6233:1` | `3.2151:1` |

After that historical audit, the user intentionally refined the global surfaces of Manzana verde, Marea and Crepúsculo de medianoche. Those values are now product contract and MUST NOT be normalized back to the historical table. The only rejected parts of the manual state are the three Dark `borderStrong` values below, which fall below `3:1`; implementation restores their already-approved accessible hues while retaining every manual surface/input adjustment. The final partial overrides are:

| Palette/scheme | Final overrides |
| --- | --- |
| Manzana verde Light | `background #f4f5f4`; `surface #f6f9f6`; `surfaceSecondary #f2f8f2`; `inputBackground #f6f9f6`; `textMuted #707070` inherited; `border #c7d8c7`; `borderStrong #5a7b5a`; `accent #397a22`; `onAccent #ffffff`; `selectedSurface #e1f2d9`; inherited `selectedForeground #171717`; `selectedBorder #397a22` |
| Manzana verde Dark | `background #070a05`; `surface #0b0f09`; `surfaceSecondary #0f160f`; `inputBackground #0a0f08`; inherited `textMuted #9a9a9a`; `border #1d271d`; final `borderStrong #646464`; `accent #9be56f`; `onAccent #102108`; `selectedSurface #21351a`; `selectedForeground #f2f2f2`; `selectedBorder #78bd52` |
| Marea Light | `background #f1f8f8`; `surface #fbffff`; `surfaceSecondary #e2f0f0`; `inputBackground #fbffff`; inherited `textMuted #707070`; `border #c4dddd`; `borderStrong #769595`; `accent #087b83`; `onAccent #ffffff`; `selectedSurface #d2ecee`; inherited `selectedForeground #171717`; `selectedBorder #087b83` |
| Marea Dark | `background #081113`; `surface #0b1518`; `surfaceSecondary #112125`; `inputBackground #0a1618`; inherited `textMuted #9a9a9a`; `border #21383d`; final `borderStrong #4f6c72`; `accent #62d3d5`; `onAccent #062426`; `selectedSurface #15383c`; `selectedForeground #f2f2f2`; `selectedBorder #4bbabd` |
| Crepúsculo de medianoche Light | `background #f5f4fd`; `surface #fcfbff`; `surfaceSecondary #f8f5ff`; `inputBackground #fcfbff`; `textMuted #6e6e6e`; `border #d2cce7`; `borderStrong #9289af`; `accent #5546a6`; `onAccent #ffffff`; `selectedSurface #e2ddf4`; inherited `selectedForeground #171717`; `selectedBorder #5546a6` |
| Crepúsculo de medianoche Dark | `background #090a18`; `surface #0e0f20`; `surfaceSecondary #161933`; `inputBackground #0d0f21`; inherited `textMuted #9a9a9a`; `border #282b4b`; final `borderStrong #606485`; `accent #aaa0ff`; `onAccent #171331`; `selectedSurface #292552`; `selectedForeground #f2f2f2`; `selectedBorder #8e83ed` |

The manual-to-final accessibility corrections are narrowly scoped: Manzana verde Dark `borderStrong #202920 → #646464`, Marea Dark `#304144 → #4f6c72`, and Crepúsculo de medianoche Dark `#454864 → #606485`. Their final functional contrasts are respectively `3.2662:1`/`3.2715:1`, `3.2788:1`/`3.2611:1`, and `3.3027:1`/`3.3041:1` against the actual `surface`/`inputBackground`. Manzana verde Light deliberately retains `borderStrong #5a7b5a`, measuring `4.4841:1` against its actual `surface/inputBackground #f6f9f6`. Marea Light remains `#769595` on `#fbffff` (`3.2061:1`), while Crepúsculo Light remains `#9289af` on its adjusted `#fcfbff` (`3.1750:1`). No surface is changed to obtain these ratios.

The Section 12 consumer mapping also confirms one real normal-text failure for the global, palette-overridable `textMuted`: Light + Crepúsculo de medianoche historically used inherited `#707070` on the then-current `background #f4f3fa`, producing only `4.4917:1` against the required `4.5:1`. The correction remains palette-local: the Light override is neutral gray `#6e6e6e`. With the final user-adjusted surfaces it produces `4.6718:1` on `background #f5f4fd` and `4.9488:1` on both real `surface #fcfbff` and `inputBackground #fcfbff`. This preserves the auxiliary neutral role, changes no Dark value, adds no token and requires no consumer branch. Original, Manzana verde, Marea, Lavanda, Obsidiana and Pinky Clouds retain their current resolved `textMuted` values. The mapping found no real `textMuted` consumer on `surfaceSecondary`; nearby secondary surfaces belong to sibling chips, buttons or poster placeholders and do not justify a synthetic token/surface change. Likewise, the sole `personalRatingErrorText` consumer remains on Card `surface`, not colored `surfaceSecondary`.

| Light Crepúsculo de medianoche `textMuted` consumer responsibility | Actual background | Previous `#707070` | Final `#6e6e6e` |
| --- | --- | ---: | ---: |
| Auxiliary screen/help text | final `background #f5f4fd` | historical failing pair `#707070/#f4f3fa = 4.4917:1` | `4.6718:1` |
| Auxiliary Card/tab/navigation text | `surface #fcfbff` | historical `#707070/#fdfcff = 4.8448:1` | `4.9488:1` |
| Input placeholders | `inputBackground #fcfbff` | historical `#707070/#fdfcff = 4.8448:1` | `4.9488:1` |

#### Pinky Clouds exact palette contract

Pinky Clouds is a normal base-plus-overrides palette, not a parallel theme system. Its pink identity reaches `background`, `surface`, `surfaceSecondary` and `inputBackground`, as well as accent, selection and borders, so cards remain visibly pink-tinted even when accent is not visible. It adds no token and authorizes no `if palette === "pinky-clouds"` consumer branch. The five user-selected anchors are Deep `#B24A7D`, Medium `#DB5A7B`, Vivid `#FD7690`, Soft `#FDA6D2` and Cloud `#FFCEE7`.

Light uses the following complete override set; unlisted global text tokens inherit `LightBase`, while `textMuted` is overridden only because its real normal-text and placeholder responsibilities need reliable contrast across the pink surfaces.

| Light token override | Exact value | Reason |
| --- | --- | --- |
| `background` | `#FFF3F9` | Extremely light pink cloud for the main canvas. |
| `surface` | `#FFE4F1` | Perceptibly pink card mass, distinct from background. |
| `surfaceSecondary` | `#FFCEE7` | Direct Cloud anchor for elevated/secondary pink surfaces. |
| `inputBackground` | `#FFF7FB` | Related near-white pink input fill. |
| `textMuted` | `#6B4F5D` | Muted berry-neutral foreground that passes on its real backgrounds. |
| `border` | `#FDA6D2` | Direct Soft anchor for subtle pink separation. |
| `borderStrong` | `#B24A7D` | Direct Deep anchor and functional boundary above 3:1. |
| `accent` | `#AA4275` | Slightly deeper anchor-derived magenta required for normal link text on `surface`; distinct from `borderStrong`. |
| `onAccent` | `#FFFFFF` | Accessible foreground on the Light accent. |
| `selectedSurface` | `#FDA6D2` | Direct Soft anchor for a clearly visible selection. |
| `selectedForeground` | `#5A1838` | Derived deep berry foreground with accessible selection contrast. |
| `selectedBorder` | `#DB5A7B` | Direct Medium anchor and functional selected boundary. |

Dark remains genuinely dark through derived plum, pink-charcoal and berry-black surfaces rather than reusing the light swatches as backgrounds.

| Dark token override | Exact value | Reason |
| --- | --- | --- |
| `background` | `#160B12` | Derived berry-black main canvas. |
| `surface` | `#211019` | Derived dark plum card surface, visibly distinct from background. |
| `surfaceSecondary` | `#321624` | Derived elevated berry/plum surface. |
| `inputBackground` | `#28111D` | Derived pink-charcoal input fill aligned with cards. |
| `border` | `#55263D` | Derived subtle plum separator. |
| `borderStrong` | `#8D5A70` | Derived lighter plum functional boundary above 3:1. |
| `accent` | `#FD7690` | Direct Vivid anchor for immediate Pinky Clouds identity. |
| `onAccent` | `#211019` | Dark derived foreground with accessible contrast on Vivid. |
| `selectedSurface` | `#5C2440` | Derived deep berry selection surface. |
| `selectedForeground` | `#F2F2F2` | Inherited Dark foreground value made explicit for the selected pair. |
| `selectedBorder` | `#DB5A7B` | Direct Medium anchor for selected boundary. |

The five anchors remain directly represented: Deep in Light `borderStrong`, Medium in both `selectedBorder` values, Vivid in Dark `accent`, Soft in Light `border` and `selectedSurface`, and Cloud in Light `surfaceSecondary`. `#AA4275` is the explicitly approved deeper Light accent derivation; the remaining non-base values are light tints or dark plum/berry derivations required for hierarchy and contrast.

The consumer-driven contrast audit below uses WCAG relative luminance. Normal text requires `>= 4.5:1`; functional non-text boundaries require `>= 3.0:1`. `accent/surfaceSecondary` is deliberately not asserted as a text pair: structural inventory finds no normal-text accent consumer on that surface, so its synthetic `4.0675:1` measurement is not a product failure. Real accent consumers occur on `background`, `surface`, `inputBackground`, or as `onAccent/accent`; the preview accent swatch on `surfaceSecondary` is non-textual.

| Pinky Clouds Light responsibility | Ratio | Threshold/result |
| --- | ---: | --- |
| `textPrimary/background` | `16.5962:1` | `>=4.5` PASS |
| `textPrimary/surface` | `15.0419:1` | `>=4.5` PASS |
| `textPrimary/surfaceSecondary` | `13.0057:1` | `>=4.5` PASS |
| `textSecondary/background` | `7.5827:1` | `>=4.5` PASS |
| `textSecondary/surface` | `6.8726:1` | `>=4.5` PASS |
| `textSecondary/surfaceSecondary` | `5.9422:1` | `>=4.5` PASS |
| `textMuted/background` | `6.6998:1` | `>=4.5` PASS |
| `textMuted/surface` | `6.0723:1` | `>=4.5` PASS |
| `textPrimary/inputBackground` | `17.0309:1` | `>=4.5` PASS |
| `textMuted/inputBackground` placeholder | `6.8752:1` | `>=4.5` PASS |
| `onAccent/accent` | `5.6069:1` | `>=4.5` PASS |
| `selectedForeground/selectedSurface` | `7.1259:1` | `>=4.5` PASS |
| `accent/background` real accent content | `5.1905:1` | `>=4.5` PASS |
| `accent/surface` real link/navigation content | `4.7044:1` | `>=4.5` PASS |
| `accent/inputBackground` real accent content | `5.3264:1` | `>=4.5` PASS |
| `accent/surface` focus indicator | `4.7044:1` | `>=3.0` PASS |
| `selectedBorder/surface` | `3.0587:1` | `>=3.0` PASS |
| `borderStrong/surface` | `4.2267:1` | `>=3.0` PASS |
| `borderStrong/inputBackground` | `4.7856:1` | `>=3.0` PASS |
| `dangerText/background` | `9.2596:1` | `>=4.5` PASS |
| `dangerText/surface` | `8.3924:1` | `>=4.5` PASS |
| `onDangerSurface/dangerSurface` | `8.4830:1` | `>=4.5` PASS |
| `personalRatingErrorText/surface` | `8.3924:1` | `>=4.5` PASS |
| `disabledText/disabledSurface` | `3.6260:1` | documented disabled signal `>=3.0` PASS |
| personal rating low pair | `8.9855:1` | `>=4.5` PASS |
| personal rating medium pair | `9.5444:1` | `>=4.5` PASS |
| personal rating high pair | `8.3122:1` | `>=4.5` PASS |

| Pinky Clouds Dark responsibility | Ratio | Threshold/result |
| --- | ---: | --- |
| `textPrimary/background` | `17.1983:1` | `>=4.5` PASS |
| `textPrimary/surface` | `16.2718:1` | `>=4.5` PASS |
| `textPrimary/surfaceSecondary` | `14.7026:1` | `>=4.5` PASS |
| `textSecondary/background` | `10.2480:1` | `>=4.5` PASS |
| `textSecondary/surface` | `9.6959:1` | `>=4.5` PASS |
| `textSecondary/surfaceSecondary` | `8.7609:1` | `>=4.5` PASS |
| `textMuted/background` | `6.8422:1` | `>=4.5` PASS |
| `textMuted/surface` | `6.4736:1` | `>=4.5` PASS |
| `textPrimary/inputBackground` | `15.7880:1` | `>=4.5` PASS |
| `textMuted/inputBackground` placeholder | `6.2811:1` | `>=4.5` PASS |
| `onAccent/accent` | `7.0875:1` | `>=4.5` PASS |
| `selectedForeground/selectedSurface` | `10.5299:1` | `>=4.5` PASS |
| `accent/background` real accent content | `7.4911:1` | `>=4.5` PASS |
| `accent/surface` real link/navigation content | `7.0875:1` | `>=4.5` PASS |
| `accent/surfaceSecondary` | `6.4040:1` | `>=4.5` PASS |
| `accent/inputBackground` | `6.8768:1` | `>=4.5` PASS |
| `accent/surface` focus indicator | `7.0875:1` | `>=3.0` PASS |
| `selectedBorder/surface` | `4.9969:1` | `>=3.0` PASS |
| `borderStrong/surface` | `3.3214:1` | `>=3.0` PASS |
| `borderStrong/inputBackground` | `3.2227:1` | `>=3.0` PASS |
| `dangerText/background` | `11.3640:1` | `>=4.5` PASS |
| `dangerText/surface` | `10.7519:1` | `>=4.5` PASS |
| `onDangerSurface/dangerSurface` | `12.4480:1` | `>=4.5` PASS |
| `personalRatingErrorText/surface` | `4.7821:1` | `>=4.5` PASS |
| `disabledText/disabledSurface` | `10.0061:1` | documented disabled signal `>=3.0` PASS |
| personal rating low pair | `8.9855:1` | `>=4.5` PASS |
| personal rating medium pair | `9.5444:1` | `>=4.5` PASS |
| personal rating high pair | `8.3122:1` | `>=4.5` PASS |

Semantic rating/danger/disabled values and all structural image-overlay values remain scheme-selected and palette-independent. Their existing audited contracts are reused unchanged; Pinky Clouds does not override `danger*`, `disabled*`, `personalRating*`, `imageOverlay*`, `onImageOverlay*` or `imageOverlayBorder`.

DarkBase + Original uses the current values from `colors.ts`; the root navigation duplicate, CSS scrollbar values, disabled literals and overlay literals are recorded in a parity fixture before migration. Reclassification changes ownership, not Dark + Original output. The parity fixture also records semantic foregrounds by `consumer/file → current value → future responsibility/token`, rather than inferring their meaning from equal hex values elsewhere. At minimum it captures:

- `app/settings/tmdb.tsx` feedback/error text `#f4b8b8` → candidate `dangerText` responsibility, independently of PersonalRating low background using the same value.
- `app/title/[id].tsx` PersonalRating persistence `ratingError` historical foreground `#5a2a2a` → final accessible Dark `semantic.personalRatingErrorText #9b7b7b`; the historical `colors.dangerBorder` source is retained as evidence of the baseline but is a chromatic association, not the consumer's semantic responsibility.
- `app/settings/tmdb.tsx` disabled surface `#303030` with current foreground `colors.text #f2f2f2`, and `app/(tabs)/ajustes.tsx`, `app/title/[id].tsx` and `app/tmdb/[type]/[id].tsx` disabled surface `#3b3b3b` with their actual current `colors.text #f2f2f2` foregrounds → disabled surface/text responsibility.
- Current danger surfaces using `colors.danger #4a1f1f` with `colors.text #f2f2f2` resolve separately to `dangerSurface` and `onDangerSurface`, rather than reusing standalone `dangerText`.

For Dark + Original, the exact semantic danger values remain `dangerSurface #4a1f1f`, `dangerBorder #5a2a2a`, standalone `dangerText #f4b8b8` and `onDangerSurface #f2f2f2`. PersonalRating persistence feedback is the single deliberate accessibility exception to exact Dark + Original parity: Sections 9 + 10 first preserve and migrate the historical `ratingError #5a2a2a` to its correct owner, `theme.semantic.personalRatingErrorText`, never to `theme.semantic.dangerBorder`; Section 12 then changes only the Dark resolved value to `#9b7b7b` because the historical value measures approximately `1.63:1` on its actual `surface #101010` and fails the `4.5:1` normal-text requirement. The final Dark value measures approximately `5.00:1` on `surface #101010`, `5.17:1` on `background #0b0b0b` and `4.84:1` on `surfaceSecondary #141414`. Light remains `#7d2020`, with approximately `10.00:1` on `surface #ffffff` and `9.26:1` on `background #f6f6f6`. `personalRatingErrorText` remains semantic, scheme-aware and palette-independent: every Dark palette resolves `#9b7b7b`, every Light palette resolves `#7d2020`, and `dangerText` remains a separate general-feedback role. This is an intentional, documented accessibility correction rather than accidental parity drift. Light also defines a scheme-appropriate `onDangerSurface` with adequate contrast against its Light `dangerSurface`. The exact structural values are `imageOverlay rgba(11, 11, 11, 0.78)` for the TitleGridCard title scrim, `imageOverlayMedium rgba(11, 11, 11, 0.82)` for its type badge, `imageOverlayStrong rgba(11, 11, 11, 0.90)` for its pin and `imageOverlayLabel rgba(11, 11, 11, 0.94)` for the TagGridCard name/count directly over TagCollage. The primary structural foreground `onImageOverlay` is `#f2f2f2`; the TagGridCard name uses it, while its count uses the secondary structural foreground `onImageOverlaySecondary #bdbdbd`. Light and Dark share these structural values because they protect content over images, not general app surfaces. The former `tagLabelOverlay` inventory is therefore resolved to `structural.imageOverlayLabel`, and the TagGridCard count foreground is resolved to `structural.onImageOverlaySecondary`; no additional overlay or foreground level is introduced preventively.

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

The same coordinator also owns the minimal deferred-intent boundary required by backup import: `reserveDeferred(preference)`, `activateDeferred(handle)` and `discardDeferred(handle)`, with names adaptable to the implementation style. A normal selection and a deferred reservation consume IDs from the same monotonic sequence; there is no backup-specific counter, timestamp ordering, promise-completion ordering or caller-side precedence comparison. `reserveDeferred` validates or receives an already valid preference, consumes the next order, records it as the latest logical intent and returns a typed opaque handle bound to that reservation and coordinator lifecycle. The caller cannot fabricate or compare raw IDs. Reservation does not change `displayed` or `confirmedPersisted`, does not enqueue a write and does not enter storage, the global mutation queue or a transaction.

`activateDeferred(handle)` is called only after the main backup mutation has fully exited. It first asks the coordinator whether the original reserved order is still the latest applicable logical intent. If it is, activation retains that exact order—never allocates a new one—then adopts the reserved preference as the displayed optimistic intent and reuses the normal coordinator persistence state machine and public Appearance writer. If a newer selection or deferred reservation exists, or the handle was discarded or is otherwise no longer valid, activation performs no write and reports a non-applied outcome such as `superseded` or `discarded`; the coordinator, not Settings or backup code, decides this. `discardDeferred(handle)` permanently invalidates the reservation without changing `displayed`, `confirmedPersisted` or storage. Orders are historical causal watermarks and are never rewound or reused after discard.

Repeated imports follow the same rule: reserving A at N and D at N+1 supersedes A; activating A cannot write, while D may activate only if no later logical intent appeared. A pending reservation is neither displayed nor confirmed persisted and therefore cannot become an export source. Once activated, success, failure, rollback, coalescing, storage-epoch invalidation and hydration/retry guards reuse the existing state machine rather than duplicating it.

Advancing the causal watermark with an unactivated deferred reservation does not replace the normal displayed/write lifecycle already in progress. The coordinator may distinguish internally between the latest causal order used to decide deferred activation and the normal displayed write whose persistence outcome still owns the current optimistic UI, but both identities come from the same monotonic sequence and remain inside the same coordinator. A reservation alone MUST NOT coalesce, cancel or reclassify as superseded a previously displayed normal write. Normal-selection coalescing retains its existing semantics only when another applicable normal displayed/write intent replaces it.

Consequently, if `select(B)` at N is queued or in flight and `reserveDeferred(A)` advances causal order to N+1, B still completes its normal lifecycle. B success updates `confirmedPersisted` and storage to B and leaves `displayed` at B while A remains unactivated. B failure rolls `displayed` back immediately to the live `confirmedPersisted`, even though A is causally newer, because A is not yet a displayed write or rollback target. Discarding A afterward preserves whichever real B outcome occurred: B/B/B after success, or C/C/C after failure from confirmed C. It never revives an unpersisted optimistic value. If A remains causally latest and later activates, it may then adopt displayed and write using its original N+1 order; a later `select(D)` at N+2 still supersedes A.

Export remains based only on trustworthy `confirmedPersisted` or the known no-row default. A pending reservation neither blocks a normal write from updating `confirmedPersisted` nor becomes an export source: after B succeeds and A is reserved but unactivated, export includes B, not C or A.

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

Add `app/settings/appearance.tsx` as a normal Stack screen and a Settings entry. Scheme controls display Spanish labels `Del sistema`, `Claro`, `Oscuro`; final palette catalog labels are `Original`, `Manzana verde`, `Marea`, `Crepúsculo de medianoche`, `Lavanda`, `Obsidiana`, `Pinky Clouds`, with display copy isolated as catalog metadata so copy never changes persistence or architecture.

Each preview resolves the catalog palette against the current effective scheme and draws an abstract composition using background, surface, surfaceSecondary, text, accent and border/selection tokens. Mobile uses a horizontal accessible collection. Wide layouts use measured available width and wrapping/grid behavior rather than a frozen arbitrary breakpoint; resize/rotation is part of validation.

Selection is immediate and has label, `accessibilityState.selected`, check/icon and border/indicator. Pressed, disabled, focus and keyboard behavior remain explicit. There is no Apply button.

### 11. Preserve semantic states, overlays and external branding

Danger/error/destructive and rating pairs are resolved by scheme outside palette overrides. Personal rating ranges and composed accessibility labels remain unchanged. Disabled uses semantic surface/text plus existing `disabled`/accessibility state rather than color alone. Active tabs retain filled/outline icon differences in addition to accent. Links retain link roles and gain theme-coherent visual/focus affordance.

`TitleGridCard` poster scrims remain dark structural values; pin remains passive `diamond-outline` top-right. Rating/pin layout is regression-tested at long titles and narrow card widths. `settings/about.tsx` keeps `assets/tmdb-primary-full-blue.png` without `tintColor`/filter, the exact TMDB notice and exact JustWatch attribution. Theme changes only the surrounding surface/text; contrast failure is solved with a suitable themed/neutral container or a separately approved official asset, never recoloring.

### 12. Backup v4 treats Appearance as lower-priority portable intent

Add pure v4 types/parser/creator alongside v1-v3. Export snapshots items and pins plus Appearance only when the export layer has a reliable portable intention:

Pinky Clouds expands only the valid palette-ID domain. Appearance persistence remains `{ version: 1, scheme, palette }`, the stable key and hydration behavior do not change, and the default remains Dark + Original. Backup remains `version: 4`: `appearance.palette: "pinky-clouds"` MUST export, parse, import and restore normally through the existing deferred-intent/coordinator path. Unknown-palette fixtures MUST use another deliberately invalid ID after this feature. v1/v2/v3 continue preserving local Appearance, and no hydration, last-intent-wins, reserve/activate/discard, rollback, queue or transaction semantic changes.

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
→ user confirms and calls the coordinator deferred-reservation boundary, receiving an opaque handle whose order comes from the same monotonic sequence as normal selections
→ merge items and pins under existing serialized storage contract
→ merge returns its real completed result (including reported partial item/pin issues)
→ if main restoration throws, is rejected or aborts after reservation, discard that handle
→ if main restoration completed, after fully exiting its mutation boundary activate that handle
→ the coordinator applies it only if its original reserved order is still latest; activation never allocates a new order
→ activated intent persists through central coordinator/public Appearance mutation
→ provider updates `confirmedPersisted` and UI after the Appearance write succeeds
→ show combined result
```

Reserving at user confirmation records the real causal order of the imported intent without displaying or writing it before the main merge succeeds. Cancellation before confirmation creates no reservation; rejection, abort or thrown merge after reservation discards its handle. Any user selection or later imported reservation receives a greater ID from the same coordinator sequence and permanently supersedes the older import; late merge success then restores items/pins but activation reports `superseded` and does not write the older Appearance.

```text
confirm import A → reserve intent 10; do not display/write A
→ main merge pending
→ user selects B → intent 11; display/write B
→ merge succeeds late
→ reserved intent 10 is older, so discard A
→ library/pins import succeeds
→ displayed/storage/confirmedPersisted/restart remain B
```

The main backup restoration completes and exits its existing queue/transaction before `activateDeferred(handle)` may reach the Appearance public setter. Appearance therefore enters the global mutation queue as a new independent operation; reserve/discard never enter it, and activation is never nested inside the backup queue entry or transaction. The real write still follows `initDb()` → `runSerializedStorageMutation` → `db.withTransactionAsync` → `setAppearancePreferenceWithDb`; backup code never calls `*WithDb` directly.

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

Pinky Clouds adds no CSS-specific palette definition. Browser chrome continues deriving from the resolved `ThemeDefinition`; `global.css` remains only the Dark + Original bootstrap fallback plus runtime-fed variables, never seven duplicated palette tables.

## Risks / Trade-offs

- [Dark + Original drifts during semantic renaming] → Capture the current token/literal mapping first, add a parity harness where structurally possible and visually review navigation, overlays, disabled, ratings, pins and branding before adding expressive palettes.
- [A module-level StyleSheet retains dark values] → Migrate and structurally search all imports/color-bearing `StyleSheet.create`, including the five known modules; rerun literal/import inventories after every screen section.
- [A superseded success is ignored and a later failure rolls UI behind storage] → Every successful write updates `confirmedPersisted` even when superseded; only `displayed` obeys latest intent, and the explicit A-success/B-failure harness proves rollback to A.
- [Appearance intent serialization bypasses the product-wide SQLite queue] → Public setter enters the global queue and one transaction exactly once; `*WithDb` is queue/transaction-free and structural tests reject nesting.
- [A late backup merge creates a new latest Appearance after a newer user choice] → Reserve the import intent ID at confirmation, activate only after successful merge and discard it if any newer intent exists.
- [Deferred import introduces a second precedence system] → Put typed reserve/activate/discard operations on the existing Appearance coordinator, consume the same monotonic sequence as `select()`, retain the reserved order during activation and forbid caller-side ID construction/comparison.
- [An unactivated reservation suppresses a previously displayed normal write] → Separate the causal activation watermark from the active displayed/write lifecycle inside the same coordinator and sequence; reservation alone cannot coalesce B or suppress B's success/failure reconciliation, and discard preserves B's real outcome.
- [A stale hydration retry overwrites a newer successful write] → Reads carry generation plus intent revision and publish only while current; stale results are discarded and rollback always uses live `confirmedPersisted`.
- [Provider waits forever on SQLite] → Hydration always resolves to success/absence/invalid/error; error unlocks Dark + Original and exposes retry, without waiting for TMDB.
- [Web displays React theme over stale DOM/CSS] → One effect writes effective variables and `color-scheme`; CSS contains only bootstrap fallbacks, not palette definitions; verify reload and runtime system changes.
- [Fourteen scheme/palette combinations multiply contrast work] → Preserve the completed historical 2×6 audit, then extend the complete resolved catalog to 2×7 with Pinky Clouds plus the documented relative-luminance Light gate and explicit `selectedSurface`/`selectedForeground` pair; before final release, validate semantic, focus, placeholder, selected and disabled pairs comprehensively in Section 12.
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
6. Preserve the completed 2×6 evidence, implement Pinky Clouds once, then complete the final 2×7 contrast/platform matrix, focused harnesses, TypeScript, strict OpenSpec and one external review of the accumulated Section 12 technical diff before Archive.

Rollback within the same SQLite schema leaves the stable `appearance` row unused and preserves all existing data. Reverting UI/runtime sections restores Dark + Original constants without data migration. Reverting after v4 export requires retaining a v4-capable importer or warning that older code cannot import new files; never down-convert or delete user backups automatically. Every Apply section stops for diff/test review and checkpoint before continuing.

## Open Questions

- The existing display name `Obsidiana` remains unchanged; its stable internal ID remains `obsidian`.
- The precise responsive width at which previews wrap remains an implementation/design-review detail constrained by measured layout. Pinky Clouds hex values are final in this design and MUST NOT be deferred to implementation.
- Browser `theme-color` support can be adopted if Expo/web metadata permits runtime updates without a second theme source; otherwise correct document background and `color-scheme` remain the required baseline.
