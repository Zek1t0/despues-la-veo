import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { controlTarget, radius, space, type } from "../../theme/presentation";

/** Same Modal/backdrop pattern as ViewOptionsPanel; no writes or navigation. */
export function CollectionOptionsMenu({ triggerRef, disabled, onDelete }: {
  triggerRef: React.RefObject<View | null>; disabled: boolean; onDelete: () => void;
}) {
  const { theme } = useAppTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number }>();
  const [menuHeight, setMenuHeight] = useState(2 * controlTarget + 2 * space.sm);
  const [focused, setFocused] = useState<number | null>(null);
  const removeRef = useRef<View>(null), cancelRef = useRef<View>(null);
  const activeIndex = useRef(0), measurement = useRef(0);
  const focusItem = useCallback((index: number) => {
    activeIndex.current = index;
    (index === 0 ? removeRef : cancelRef).current?.focus();
  }, []);
  const close = useCallback((restoreFocus = true) => {
    measurement.current++;
    setVisible(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, [triggerRef]);
  useEffect(() => () => { measurement.current++; }, []);
  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      else if (["Tab", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? 1 :
          (activeIndex.current + (event.key === "ArrowUp" || event.key === "Tab" && event.shiftKey ? -1 : 1) + 2) % 2;
        focusItem(next);
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [visible, close, focusItem]);

  const menuWidth = Math.max(0, Math.min(280 * Math.min(Math.max(1, fontScale), 1.4), width - 2 * space.lg));
  const maxHeight = Math.max(controlTarget, height - insets.top - insets.bottom - 2 * space.lg);
  const left = Math.max(space.lg, Math.min((anchor ? anchor.x + anchor.width : width - space.lg) - menuWidth, width - space.lg - menuWidth));
  const visibleHeight = Math.min(menuHeight, maxHeight);
  const below = anchor ? anchor.y + anchor.height + space.xs : insets.top + space.lg;
  const desiredTop = anchor && below + visibleHeight > height - insets.bottom - space.lg
    ? anchor.y - space.xs - visibleHeight : below;
  const top = Math.max(insets.top + space.lg, Math.min(desiredTop, height - insets.bottom - space.lg - visibleHeight));
  function open() {
    if (disabled) return;
    const sequence = ++measurement.current;
    if (!triggerRef.current?.measureInWindow) { setVisible(true); return; }
    triggerRef.current.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      if (sequence !== measurement.current) return;
      setAnchor({ x, y, width: measuredWidth, height: measuredHeight });
      setVisible(true);
    });
  }
  const rowStyle = (index: number) => ({ minHeight: controlTarget, flexDirection: "row" as const,
    alignItems: "center" as const, gap: space.sm, padding: space.md, borderRadius: radius.control,
    borderWidth: 1, borderColor: focused === index ? theme.global.accent : theme.global.surface,
    backgroundColor: focused === index ? theme.global.surfaceSecondary : theme.global.surface });
  return <>
    <Pressable ref={triggerRef} accessibilityRole="button" accessibilityLabel="Más opciones de colección"
      accessibilityState={{ disabled, expanded: visible }} aria-haspopup="menu" focusable disabled={disabled}
      onFocus={() => setFocused(2)} onBlur={() => setFocused(null)} onPress={open}
      style={({ pressed }) => ({ minWidth: controlTarget, minHeight: controlTarget, flexShrink: 0,
        alignItems: "center", justifyContent: "center", borderRadius: radius.control, borderWidth: 1,
        borderColor: focused === 2 ? theme.global.accent : theme.global.borderStrong,
        backgroundColor: theme.global.surfaceSecondary, opacity: disabled ? 0.6 : pressed ? 0.8 : 1 })}>
      <Ionicons name="ellipsis-horizontal" size={20} color={theme.global.textPrimary} accessible={false} />
    </Pressable>
    <Modal transparent visible={visible} animationType="none" onRequestClose={() => close()}
      onShow={() => focusItem(0)}>
      <View style={StyleSheet.absoluteFillObject}>
        <Pressable accessible={false} focusable={false} importantForAccessibility="no" onPress={() => close()}
          style={StyleSheet.absoluteFillObject} />
        <View accessibilityRole="menu" accessibilityLabel="Opciones de colección" accessibilityViewIsModal
          onAccessibilityEscape={() => close()} onLayout={event => setMenuHeight(event.nativeEvent.layout.height)}
          style={{ position: "absolute", left, top, width: menuWidth, maxHeight, padding: space.sm,
            borderRadius: radius.card, borderWidth: 1, borderColor: theme.global.borderStrong,
            backgroundColor: theme.global.surface }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Pressable ref={removeRef} accessibilityRole="menuitem" accessibilityLabel="Eliminar colección" focusable
              onFocus={() => { activeIndex.current = 0; setFocused(0); }} onBlur={() => setFocused(null)}
              onPress={() => { close(false); onDelete(); }} style={rowStyle(0)}>
              <Ionicons name="trash-outline" size={18} color={theme.semantic.dangerText} accessible={false} />
              <Text style={[type.control, { color: theme.semantic.dangerText, flexShrink: 1 }]}>Eliminar colección</Text>
            </Pressable>
            <Pressable ref={cancelRef} accessibilityRole="menuitem" accessibilityLabel="Cancelar menú de colección" focusable
              onFocus={() => { activeIndex.current = 1; setFocused(1); }} onBlur={() => setFocused(null)}
              onPress={() => close()} style={rowStyle(1)}>
              <Text style={[type.control, { color: theme.global.textPrimary, flexShrink: 1 }]}>Cancelar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
