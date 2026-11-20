import React, { useEffect, useState, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { controlTarget, pressedFeedback, radius, space, type } from "../../theme/presentation";
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
  collapsible?: boolean;
  initialExpandedSection?: string;
  onReset?: () => void;
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
        pressed && pressedFeedback,
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
  collapsible = false,
  initialExpandedSection,
  onReset,
}: ViewOptionsPanelProps) {
  const { theme } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const compactWeb = Platform.OS === "web" && width >= 640 * Math.max(1, fontScale);
  const populatedSections = sections.filter((section) => section.options.length > 0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (collapsible) setExpanded(visible ? initialExpandedSection ?? null : null);
  }, [visible, collapsible, initialExpandedSection]);

  useEffect(() => {
    let current = true;
    let receivedUpdate = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      receivedUpdate = true;
      setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (current && !receivedUpdate) setReduceMotion(enabled);
    }).catch(() => {
      // Keep the conservative initial setting if the platform cannot report it.
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);

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
      animationType={reduceMotion ? "none" : "fade"}
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
                pressed && pressedFeedback,
              ]}
            >
              <Text style={[styles.closeText, { color: theme.global.textPrimary }]}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[styles.content, collapsible && { gap: space.sm }]} keyboardShouldPersistTaps="handled">
            {populatedSections.map((section) => {
              const isExpanded = expanded === section.id;
              const selected = section.options.find(option => option.id === section.selectedId)?.title ?? "No disponible";
              return (
                <View key={section.id} style={styles.section}>
                  {collapsible ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${section.title}: ${selected}`}
                      accessibilityState={{ expanded: isExpanded }}
                      focusable
                      onPress={() => setExpanded(isExpanded ? null : section.id)}
                      style={({ pressed }) => [
                        styles.disclosure,
                        { backgroundColor: theme.global.surfaceSecondary, borderColor: theme.global.borderStrong },
                        pressed && pressedFeedback,
                      ]}
                    >
                      <Text style={[type.control, { color: theme.global.textPrimary, flex: 1, minWidth: 0 }]}>{section.title}</Text>
                      <Text style={[type.caption, { color: theme.global.textSecondary, flex: 1, minWidth: 0, textAlign: "right" }]}>{selected}</Text>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.global.textSecondary} />
                    </Pressable>
                  ) : (
                  <Text
                    accessibilityRole="header"
                    style={[styles.sectionTitle, { color: theme.global.textSecondary }]}
                  >
                    {section.title}
                  </Text>
                  )}
                  {(!collapsible || isExpanded) && <View style={[styles.options, fontScale >= 1.4 && styles.stackedOptions]}>
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
                  </View>}
                </View>
              );
            })}
            {onReset && <CompactOption id="reset" title="Restablecer filtros" selected={false} onPress={onReset} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  disclosure: {
    minHeight: controlTarget,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  backdrop: {
    flex: 1,
  },
  backdropWeb: {
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
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
    borderRadius: radius.panel,
    maxWidth: 480,
  },
  panelMobile: {
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    maxHeight: "88%",
  },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
    padding: space.lg,
  },
  panelTitle: {
    flex: 1,
    ...type.heading,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: controlTarget,
    paddingHorizontal: space.md,
  },
  closeText: {
    ...type.control,
  },
  content: {
    gap: space.xl,
    padding: space.lg,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    ...type.control,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  stackedOptions: {
    flexDirection: "column",
  },
  compactOption: {
    alignItems: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: controlTarget,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    width: "100%",
  },
  compactIndicator: {
    alignItems: "center",
    justifyContent: "center",
  },
  compactTitle: {
    flex: 1,
    ...type.control,
  },
});
