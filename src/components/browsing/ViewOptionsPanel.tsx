import React, { useEffect, type ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { useAppTheme } from "../../theme/AppThemeProvider";
import { LayoutOption } from "./LayoutOption";

type BaseViewOptionDescriptor = {
  id: string;
  title: string;
  accessibilityLabel?: string;
};

export type LayoutViewOptionDescriptor = BaseViewOptionDescriptor & {
  indicator: ReactNode;
};

export type CompactViewOptionDescriptor = BaseViewOptionDescriptor & {
  indicator?: ReactNode;
};

type BaseViewOptionsSection = {
  id: string;
  title: string;
  selectedId: string;
  onSelect: (optionId: string) => void;
};

export type ViewOptionsSection =
  | (BaseViewOptionsSection & {
      presentation: "layout";
      options: readonly LayoutViewOptionDescriptor[];
    })
  | (BaseViewOptionsSection & {
      presentation: "compact";
      options: readonly CompactViewOptionDescriptor[];
    });

export type ViewOptionsPanelProps = {
  visible: boolean;
  onClose: () => void;
  sections: readonly ViewOptionsSection[];
  title?: string;
};

type CompactOptionProps = CompactViewOptionDescriptor & {
  selected: boolean;
  onPress: (id: string) => void;
};

function CompactOption({
  id,
  title,
  indicator,
  accessibilityLabel,
  selected,
  onPress,
}: CompactOptionProps) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      focusable
      onPress={() => onPress(id)}
      style={({ pressed }) => [
        styles.compactOption,
        {
          backgroundColor: selected
            ? theme.global.selectedSurface
            : theme.global.surfaceSecondary,
          borderColor: selected
            ? theme.global.selectedBorder
            : theme.global.borderStrong,
        },
        pressed && styles.pressed,
      ]}
    >
      {indicator ? (
        <View accessible={false} pointerEvents="none" style={styles.compactIndicator}>
          {indicator}
        </View>
      ) : null}
      <Text
        style={[
          styles.compactTitle,
          {
            color: selected
              ? theme.global.selectedForeground
              : theme.global.textPrimary,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function ViewOptionsPanel({
  visible,
  onClose,
  sections,
  title = "Opciones",
}: ViewOptionsPanelProps) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const compactWeb = Platform.OS === "web" && width >= 640;
  const populatedSections = sections.filter((section) => section.options.length > 0);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, visible]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View
        style={[
          styles.backdrop,
          { backgroundColor: theme.structural.modalBackdrop },
          compactWeb ? styles.backdropWeb : styles.backdropMobile,
        ]}
      >
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              backgroundColor: theme.global.surface,
              borderColor: theme.global.borderStrong,
            },
            compactWeb ? styles.panelWeb : styles.panelMobile,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.global.border }]}>
            <Text
              accessibilityRole="header"
              style={[styles.panelTitle, { color: theme.global.textPrimary }]}
            >
              {title}
            </Text>
            <Pressable
              accessibilityLabel="Cerrar opciones"
              accessibilityRole="button"
              focusable
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { borderColor: theme.global.borderStrong },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.closeText, { color: theme.global.textPrimary }]}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {populatedSections.map((section) => (
              <View key={section.id} style={styles.section}>
                <Text
                  accessibilityRole="header"
                  style={[styles.sectionTitle, { color: theme.global.textSecondary }]}
                >
                  {section.title}
                </Text>
                <View style={styles.options}>
                  {section.presentation === "layout"
                    ? section.options.map((option) => (
                        <LayoutOption
                          accessibilityLabel={option.accessibilityLabel}
                          id={option.id}
                          indicator={option.indicator}
                          key={option.id}
                          onPress={section.onSelect}
                          selected={option.id === section.selectedId}
                          title={option.title}
                        />
                      ))
                    : section.options.map((option) => (
                        <CompactOption
                          accessibilityLabel={option.accessibilityLabel}
                          id={option.id}
                          indicator={option.indicator}
                          key={option.id}
                          onPress={section.onSelect}
                          selected={option.id === section.selectedId}
                          title={option.title}
                        />
                      ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  backdropWeb: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  backdropMobile: {
    justifyContent: "flex-end",
  },
  panel: {
    borderWidth: 1,
    maxHeight: "86%",
    overflow: "hidden",
    width: "100%",
  },
  panelWeb: {
    borderRadius: 18,
    maxWidth: 480,
  },
  panelMobile: {
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
  },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 16,
  },
  panelTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  closeButton: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  closeText: {
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.78,
  },
  content: {
    gap: 20,
    padding: 16,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  compactOption: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: "100%",
  },
  compactIndicator: {
    alignItems: "center",
    justifyContent: "center",
  },
  compactTitle: {
    flex: 1,
    fontWeight: "800",
  },
});
