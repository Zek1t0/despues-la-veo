import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { controlTarget, radius, space } from "../../theme/presentation";
import { OrganizationButton, OrganizationOption } from "./OrganizationUI";

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
  return <>
    <OrganizationButton buttonRef={triggerRef} label="Más opciones de colección" icon="ellipsis-horizontal"
      iconOnly menuTrigger disabled={disabled} expanded={visible} onPress={open} />
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
            <OrganizationOption buttonRef={removeRef} menuItem destructive icon="trash-outline" label="Eliminar colección"
              onFocus={() => { activeIndex.current = 0; }} onPress={() => { close(false); onDelete(); }} />
            <OrganizationOption buttonRef={cancelRef} menuItem label="Cancelar"
              onFocus={() => { activeIndex.current = 1; }} onPress={() => close()} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
