import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { controlTarget, radius, space, type } from "../../theme/presentation";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function OrganizationPage({ title, children, headerRight }: React.PropsWithChildren<{ title: string; headerRight?: () => React.ReactNode }>) {
  const { theme } = useAppTheme(); const insets = useSafeAreaInsets();
  return <><Stack.Screen options={{ title, headerRight }} /><ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: theme.global.background }} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl + insets.bottom, gap: space.lg, width: "100%", maxWidth: 1000, alignSelf: "center" }}>{children}</ScrollView></>;
}
export function OrganizationText({ children, heading = false, prominent = false, muted = false, numberOfLines }: React.PropsWithChildren<{ heading?: boolean; prominent?: boolean; muted?: boolean; numberOfLines?: number }>) {
  const { theme } = useAppTheme();
  return <Text accessibilityRole={heading ? "header" : undefined} numberOfLines={numberOfLines} style={[prominent ? type.heading : heading ? type.title : type.control, { color: muted ? theme.global.textSecondary : theme.global.textPrimary, flexShrink: 1 }]}>{children}</Text>;
}
export function OrganizationCard({ children, style }: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { theme } = useAppTheme();
  return <View style={[{ padding: space.lg, gap: space.md, borderWidth: 1, borderRadius: radius.card, borderColor: theme.global.border, backgroundColor: theme.global.surface }, style]}>{children}</View>;
}
export function OrganizationButton({ label, accessibilityLabel, onPress, disabled = false, selected, variant = "secondary", icon, iconOnly = false, expanded, buttonRef }: {
  label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; selected?: boolean;
  buttonRef?: React.Ref<View>;
  variant?: "primary" | "secondary" | "quiet" | "danger"; icon?: IconName; iconOnly?: boolean; expanded?: boolean;
}) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const color = variant === "primary" ? theme.global.onAccent : variant === "danger" ? theme.semantic.dangerText : selected ? theme.global.selectedForeground : theme.global.textPrimary;
  return <Pressable ref={buttonRef} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }), ...(expanded === undefined ? {} : { expanded }) }} focusable disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ alignSelf: "flex-start", maxWidth: "100%", minWidth: controlTarget, minHeight: controlTarget, paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm, flexDirection: "row", alignItems: "center", justifyContent: "center",
      borderRadius: selected === undefined ? radius.control : radius.round, borderWidth: focused ? 2 : 1,
      borderColor: focused ? (variant === "primary" ? theme.global.onAccent : theme.global.accent) : variant === "danger" ? theme.semantic.dangerBorder : selected ? theme.global.selectedBorder : theme.global.borderStrong,
      backgroundColor: variant === "primary" ? theme.global.accent : variant === "danger" ? theme.semantic.dangerSurface : selected ? theme.global.selectedSurface : variant === "quiet" ? theme.global.surface : theme.global.surfaceSecondary,
      opacity: disabled ? 0.6 : pressed ? 0.8 : 1 })}>
    {icon && <Ionicons name={icon} size={18} color={color} accessible={false} />}
    {!iconOnly && <Text style={[type.control, { color, flexShrink: 1 }]}>{label}</Text>}
  </Pressable>;
}
export function OrganizationInput({ label, ...props }: TextInputProps & { label: string }) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: space.xs }}><OrganizationText>{label}</OrganizationText><TextInput {...props} accessibilityLabel={label} onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} placeholderTextColor={theme.global.textMuted}
    style={{ color: theme.global.textPrimary, backgroundColor: theme.global.inputBackground, borderColor: focused ? theme.global.accent : theme.global.borderStrong, borderWidth: 1, borderRadius: radius.control, padding: space.md, minHeight: controlTarget, textAlignVertical: "top" }} /></View>;
}
export function OrganizationError({ error, retry }: { error: string | null; retry?: () => void }) {
  const { theme } = useAppTheme();
  return error ? <View style={{ gap: space.sm }}><Text accessibilityLiveRegion="assertive" style={{ color: theme.semantic.dangerText }}>{error}</Text>{retry && <OrganizationButton label="Reintentar" onPress={retry} />}</View> : null;
}
