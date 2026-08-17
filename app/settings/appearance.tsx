import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { useAppTheme } from "../../src/theme/AppThemeProvider";
import { APPEARANCE_PALETTE_CATALOG } from "../../src/theme/palettes";
import { resolveTheme } from "../../src/theme/resolver";
import type {
  AppearancePaletteDefinition,
  AppearanceScheme,
  EffectiveScheme,
  ThemeDefinition,
} from "../../src/theme/types";

const SCHEME_OPTIONS: ReadonlyArray<Readonly<{
  id: AppearanceScheme;
  label: string;
}>> = [
  { id: "system", label: "Del sistema" },
  { id: "light", label: "Claro" },
  { id: "dark", label: "Oscuro" },
];

const PREVIEW_MIN_WIDTH = 220;
const PREVIEW_GAP = 12;

function invokeAppearanceAction(action: Promise<unknown>): void {
  void action.catch(() => {
    // El coordinator publica el error y reconcilia el estado correspondiente.
  });
}

function PalettePreview({ definition }: Readonly<{ definition: ThemeDefinition }>) {
  const { global } = definition;
  return (
    <View
      accessible={false}
      style={[styles.preview, { backgroundColor: global.background, borderColor: global.border }]}
    >
      <View style={[styles.previewSurface, { backgroundColor: global.surface }]}>
        <View style={[styles.previewTitle, { backgroundColor: global.textPrimary }]} />
        <View style={[styles.previewSubtitle, { backgroundColor: global.textMuted }]} />
        <View style={styles.previewRow}>
          <View style={[styles.previewSecondary, { backgroundColor: global.surfaceSecondary }]} />
          <View style={[styles.previewAccent, { backgroundColor: global.accent }]} />
        </View>
        <View
          style={[
            styles.previewSelection,
            { backgroundColor: global.selectedSurface, borderColor: global.selectedBorder },
          ]}
        >
          <Text style={{ color: global.selectedForeground, fontSize: 11, fontWeight: "900" }}>
            Aa
          </Text>
        </View>
      </View>
    </View>
  );
}

function PaletteOption({
  palette,
  effectiveScheme,
  selected,
  width,
  onSelect,
}: Readonly<{
  palette: AppearancePaletteDefinition;
  effectiveScheme: EffectiveScheme;
  selected: boolean;
  width: number;
  onSelect: () => void;
}>) {
  const candidateTheme = useMemo(
    () => resolveTheme(effectiveScheme, palette.id),
    [effectiveScheme, palette.id]
  );
  const currentTheme = candidateTheme.global;

  return (
    <Pressable
      accessibilityLabel={`Paleta ${palette.displayName}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.paletteOption,
        {
          width,
          backgroundColor: selected ? currentTheme.selectedSurface : currentTheme.surface,
          borderColor: selected ? currentTheme.selectedBorder : currentTheme.border,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <PalettePreview definition={candidateTheme} />
      <View style={styles.optionLabelRow}>
        <Text
          numberOfLines={2}
          style={[
            styles.optionLabel,
            { color: selected ? currentTheme.selectedForeground : currentTheme.textPrimary },
          ]}
        >
          {palette.displayName}
        </Text>
        {selected && (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ color: currentTheme.selectedForeground, fontSize: 18, fontWeight: "900" }}
          >
            ✓
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function AppearanceSettingsScreen() {
  const {
    theme,
    preference,
    effectiveScheme,
    hydrationStatus,
    storageError,
    setScheme,
    setPalette,
    retryHydration,
    retryPersistence,
  } = useAppTheme();
  const [availableWidth, setAvailableWidth] = useState(0);

  const onPaletteLayout = useCallback((event: LayoutChangeEvent) => {
    setAvailableWidth(event.nativeEvent.layout.width);
  }, []);

  const columns = availableWidth > 0
    ? Math.max(1, Math.floor((availableWidth + PREVIEW_GAP) / (PREVIEW_MIN_WIDTH + PREVIEW_GAP)))
    : 1;
  const useWrappedLayout = columns > 1;
  const wrappedWidth = useWrappedLayout
    ? (availableWidth - PREVIEW_GAP * (columns - 1)) / columns
    : PREVIEW_MIN_WIDTH;

  const paletteOptions = APPEARANCE_PALETTE_CATALOG.map((palette) => (
    <PaletteOption
      key={palette.id}
      palette={palette}
      effectiveScheme={effectiveScheme}
      selected={preference.palette === palette.id}
      width={wrappedWidth}
      onSelect={() => invokeAppearanceAction(setPalette(palette.id))}
    />
  ));

  const writeProblem = storageError?.operation === "write";
  const readProblem =
    !writeProblem &&
    (
      storageError?.operation === "read" ||
      hydrationStatus === "error" ||
      hydrationStatus === "invalid"
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.global.background }}
      contentContainerStyle={[
        styles.screen,
        { backgroundColor: theme.global.background },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.intro}>
        <Text style={[styles.title, { color: theme.global.textPrimary }]}>Apariencia</Text>
        <Text style={[styles.description, { color: theme.global.textSecondary }]}>
          Elegí cómo se ve la aplicación. Los cambios se aplican y guardan automáticamente.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.global.textPrimary }]}>Esquema</Text>
        <View accessibilityRole="radiogroup" style={styles.schemeOptions}>
          {SCHEME_OPTIONS.map((option) => {
            const selected = preference.scheme === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityLabel={`Esquema ${option.label}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => invokeAppearanceAction(setScheme(option.id))}
                style={({ pressed }) => [
                  styles.schemeOption,
                  {
                    backgroundColor: selected
                      ? theme.global.selectedSurface
                      : theme.global.surface,
                    borderColor: selected
                      ? theme.global.selectedBorder
                      : theme.global.border,
                    opacity: pressed ? 0.76 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected
                      ? theme.global.selectedForeground
                      : theme.global.textPrimary,
                    fontWeight: "800",
                  }}
                >
                  {option.label}
                </Text>
                {selected && (
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    style={{ color: theme.global.selectedForeground, fontWeight: "900" }}
                  >
                    ✓
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section} onLayout={onPaletteLayout}>
        <Text style={[styles.sectionTitle, { color: theme.global.textPrimary }]}>Paleta</Text>
        <Text style={{ color: theme.global.textMuted }}>
          Las vistas previas siguen el esquema {effectiveScheme === "light" ? "claro" : "oscuro"} actual.
        </Text>
        {useWrappedLayout ? (
          <View accessibilityRole="radiogroup" style={styles.paletteWrap}>{paletteOptions}</View>
        ) : (
          <ScrollView
            accessibilityRole="radiogroup"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.paletteHorizontal}
          >
            {paletteOptions}
          </ScrollView>
        )}
      </View>

      {readProblem && (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            styles.errorPanel,
            { backgroundColor: theme.semantic.dangerSurface, borderColor: theme.semantic.dangerBorder },
          ]}
        >
          <Text style={{ color: theme.semantic.dangerText, fontWeight: "800" }}>
            {hydrationStatus === "invalid"
              ? "La configuración guardada no es válida..."
              : "No se pudo leer..."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar lectura de apariencia"
            onPress={() => invokeAppearanceAction(retryHydration())}
            style={[styles.retryButton, { borderColor: theme.semantic.dangerBorder }]}
          >
            <Text style={{ color: theme.semantic.dangerText, fontWeight: "900" }}>
              Reintentar lectura
            </Text>
          </Pressable>
        </View>
      )}

      {writeProblem && (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            styles.errorPanel,
            { backgroundColor: theme.semantic.dangerSurface, borderColor: theme.semantic.dangerBorder },
          ]}
        >
          <Text style={{ color: theme.semantic.dangerText, fontWeight: "800" }}>
            No se pudo guardar el cambio. Se restauró la apariencia anterior.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar guardado de apariencia"
            onPress={() => invokeAppearanceAction(retryPersistence())}
            style={[styles.retryButton, { borderColor: theme.semantic.dangerBorder }]}
          >
            <Text style={{ color: theme.semantic.dangerText, fontWeight: "900" }}>
              Reintentar guardado
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: "center", gap: 24, maxWidth: 980, padding: 18, paddingBottom: 48, width: "100%" },
  intro: { gap: 6 },
  title: { fontSize: 26, fontWeight: "900" },
  description: { lineHeight: 21 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 19, fontWeight: "900" },
  schemeOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  schemeOption: { alignItems: "center", borderRadius: 14, borderWidth: 2, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 48, minWidth: 112, paddingHorizontal: 16, paddingVertical: 11 },
  paletteHorizontal: { gap: PREVIEW_GAP, paddingBottom: 6, paddingRight: 18 },
  paletteWrap: { flexDirection: "row", flexWrap: "wrap", gap: PREVIEW_GAP },
  paletteOption: { borderRadius: 16, borderWidth: 2, gap: 10, minHeight: 190, padding: 10 },
  preview: { borderRadius: 12, borderWidth: 1, padding: 8 },
  previewSurface: { borderRadius: 9, gap: 7, minHeight: 108, padding: 9 },
  previewTitle: { borderRadius: 999, height: 7, width: "60%" },
  previewSubtitle: { borderRadius: 999, height: 5, width: "42%" },
  previewRow: { flexDirection: "row", gap: 7 },
  previewSecondary: { borderRadius: 7, flex: 1, height: 30 },
  previewAccent: { borderRadius: 999, height: 30, width: 30 },
  previewSelection: { alignItems: "center", alignSelf: "flex-start", borderRadius: 7, borderWidth: 2, justifyContent: "center", minHeight: 25, minWidth: 48 },
  optionLabelRow: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between", minHeight: 42 },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: "900" },
  errorPanel: { borderRadius: 14, borderWidth: 1, gap: 10, padding: 14 },
  retryButton: { alignItems: "center", alignSelf: "flex-start", borderRadius: 10, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
});
