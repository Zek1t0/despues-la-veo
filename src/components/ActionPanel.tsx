import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, findNodeHandle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/AppThemeProvider";
import { radius, space } from "../theme/presentation";
import { OrganizationButton, OrganizationError, OrganizationStatus, OrganizationText } from "./organization/OrganizationUI";

type ActionPanelProps = React.PropsWithChildren<{
  title: string;
  visible: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<View | null>;
  busy?: boolean;
  canClose?: () => boolean;
}>;

function focusControl(control: View | null) {
  if (!control) return;
  control.focus();
  if (Platform.OS !== "web") {
    const tag = findNodeHandle(control);
    if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag);
  }
}

function closePanel(onClose: () => void, restoreFocus: () => void) {
  onClose();
  if (Platform.OS === "android") restoreFocus();
}

export function ActionPanel({ title, visible, onClose, triggerRef, children, busy = false, canClose }: ActionPanelProps) {
  const { theme } = useAppTheme();
  const closeRef = useRef<View>(null);
  const openedFrom = useRef<View | null>(null);
  function restoreFocus() {
    const target = openedFrom.current;
    requestAnimationFrame(() => focusControl(target));
  }
  function close() {
    if (busy || canClose?.() === false) return;
    closePanel(onClose, restoreFocus);
  }

  return <Modal transparent visible={visible} onRequestClose={close} onDismiss={restoreFocus} animationType="none"
    onShow={() => {
      openedFrom.current = triggerRef.current;
      focusControl(closeRef.current);
    }}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Pressable accessible={false} focusable={false} importantForAccessibility="no"
        onPress={close} style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.structural.modalBackdrop }]} />
      <SafeAreaView pointerEvents="box-none" style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: space.sm }}>
        <View role="dialog" accessibilityLabel={title} accessibilityViewIsModal accessibilityState={{ busy }}
          onAccessibilityEscape={close}
          style={{ width: "100%", maxWidth: 480, maxHeight: "90%", alignSelf: "center",
            backgroundColor: theme.global.surface, borderTopLeftRadius: radius.panel, borderTopRightRadius: radius.panel }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md }}>
            <OrganizationText heading prominent>{title}</OrganizationText>
            {children}
            <OrganizationButton buttonRef={closeRef} label="Cerrar" accessibilityLabel={`Cerrar ${title}`} variant="quiet" disabled={busy} onPress={close} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

export function ConfirmAction({ message, confirmLabel, onConfirm, ...panel }: Omit<ActionPanelProps, "children" | "busy" | "canClose"> & {
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!panel.visible) setFailed(false);
  }, [panel.visible]);

  async function confirm() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
      return;
    } finally {
      locked.current = false;
      setBusy(false);
    }
    closePanel(panel.onClose, () => requestAnimationFrame(() => focusControl(panel.triggerRef.current)));
  }

  return <ActionPanel {...panel} busy={busy} canClose={() => !locked.current}>
    <OrganizationText>{message}</OrganizationText>
    {busy && <OrganizationStatus kind="loading" title="Procesando la confirmación…" />}
    {failed && <OrganizationError error="No se pudo completar la acción. Podés reintentar." />}
    <OrganizationButton label={failed ? "Reintentar" : confirmLabel} variant="danger" disabled={busy} onPress={() => void confirm()} />
  </ActionPanel>;
}
