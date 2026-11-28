import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { androidControlTarget, controlTarget, radius, space, type } from "../../theme/presentation";
import { Screen } from "../Screen";
import { contrastRatio } from "../../theme/resolver";
import type { GlobalThemeTokens } from "../../theme/types";

const target = Platform.OS === "android" ? androidControlTarget : controlTarget;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function controlBoundary(colors: GlobalThemeTokens) {
  const surfaces = [colors.background, colors.surface, colors.surfaceSecondary, colors.inputBackground];
  return surfaces.every(surface => contrastRatio(colors.borderStrong, surface) >= 3)
    ? colors.borderStrong : colors.textSecondary;
}

const secondaryLabel = { ...type.control, fontWeight: "500" } as const;

export function OrganizationOption({ label, icon, selected, onPress, onFocus, buttonRef, destructive = false, menuItem = false }: {
  label: string; icon?: IconName; selected?: boolean; onPress: () => void; onFocus?: () => void;
  buttonRef?: React.Ref<View>; destructive?: boolean; menuItem?: boolean;
}) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const { global, semantic } = theme;
  const color = selected ? global.selectedForeground : destructive ? semantic.dangerText : global.textPrimary;
  return <Pressable ref={buttonRef} accessibilityRole={menuItem ? "menuitem" : "button"} accessibilityLabel={label}
    accessibilityState={{ selected }} aria-pressed={selected} focusable
    onPress={onPress} onFocus={() => { setFocused(true); onFocus?.(); }} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({
      alignSelf: "stretch", minHeight: target, paddingVertical: space.sm, paddingHorizontal: space.md,
      flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.control, borderWidth: 2,
      borderColor: focused || pressed ? (selected ? global.selectedForeground : global.accent) : "transparent",
      backgroundColor: selected ? global.selectedSurface : global.surface,
    })}>
    {icon && <Ionicons name={icon} size={18} color={color} accessible={false} />}
    <Text style={[secondaryLabel, { color, flex: 1, textAlign: "left" }]}>{label}</Text>
    {selected && <Ionicons name="checkmark" size={18} color={color} accessible={false} />}
  </Pressable>;
}
export function OrganizationPage({ title, children, headerRight }: React.PropsWithChildren<{ title: string; headerRight?: () => React.ReactNode }>) {
  return <><Stack.Screen options={{ title, headerRight }} /><Screen>{children}</Screen></>;
}
export function OrganizationText({ children, heading = false, prominent = false, muted = false, numberOfLines }: React.PropsWithChildren<{ heading?: boolean; prominent?: boolean; muted?: boolean; numberOfLines?: number }>) {
  const { theme } = useAppTheme();
  return <Text accessibilityRole={heading ? "header" : undefined} numberOfLines={numberOfLines} style={[prominent ? type.heading : heading ? type.title : type.body, { color: muted ? theme.global.textSecondary : theme.global.textPrimary, flexShrink: 1 }]}>{children}</Text>;
}
export function OrganizationCard({ children, style, elevated = false }: React.PropsWithChildren<{ style?: StyleProp<ViewStyle>; elevated?: boolean }>) {
  const { theme } = useAppTheme();
  return <View style={[{ padding: space.lg, gap: space.md, borderRadius: radius.card, backgroundColor: elevated ? theme.global.surfaceSecondary : theme.global.surface }, style]}>{children}</View>;
}
export function OrganizationButton({ label, accessibilityLabel, onPress, disabled = false, selected, variant = "secondary", icon, iconOnly = false, expanded, buttonRef, menuTrigger }: {
  label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; selected?: boolean;
  buttonRef?: React.Ref<View>;
  variant?: "primary" | "secondary" | "quiet" | "danger" | "link"; icon?: IconName; iconOnly?: boolean; expanded?: boolean;
  menuTrigger?: boolean;
}) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const color = disabled ? theme.semantic.disabledText : variant === "primary" ? theme.global.onAccent : variant === "danger" ? theme.semantic.onDangerSurface : selected ? theme.global.selectedForeground : variant === "link" ? theme.global.textSecondary : theme.global.textPrimary;
  const boundary = controlBoundary(theme.global);
  return <Pressable ref={buttonRef} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    aria-pressed={selected} aria-haspopup={menuTrigger ? "menu" : undefined}
    accessibilityState={{ disabled, selected, expanded }} focusable disabled={disabled}
    onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ alignSelf: "flex-start", maxWidth: "100%", minWidth: target, minHeight: target, paddingHorizontal: variant === "link" ? space.xs : space.md, paddingVertical: space.sm, gap: space.sm, flexDirection: "row", alignItems: "center", justifyContent: "center",
      borderRadius: selected === undefined ? radius.control : radius.round, borderWidth: 2,
      borderColor: disabled ? "transparent" : focused || pressed
        ? (variant === "primary" || variant === "danger" || selected ? color : theme.global.accent)
        : variant === "danger" ? theme.semantic.onDangerSurface : variant === "secondary" && !selected ? boundary : "transparent",
      backgroundColor: disabled ? theme.semantic.disabledSurface : variant === "primary" ? theme.global.accent : variant === "danger" ? theme.semantic.dangerSurface : selected ? theme.global.selectedSurface : variant === "quiet" || variant === "link" ? "transparent" : theme.global.surface,
    })}>
    {icon && <Ionicons name={icon} size={18} color={color} accessible={false} />}
    {selected && !iconOnly && <Ionicons name="checkmark" size={16} color={color} accessible={false} />}
    {!iconOnly && <Text style={[variant === "primary" ? type.control : secondaryLabel, { color, flexShrink: 1 }]}>{label}</Text>}
  </Pressable>;
}
export function OrganizationInput({ label, error, style, ...props }: TextInputProps & { label: string; error?: string }) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: space.xs }}><OrganizationText>{label}</OrganizationText><TextInput {...props}
    accessibilityLabel={label} accessibilityHint={error ?? props.accessibilityHint}
    onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }}
    placeholderTextColor={theme.global.textSecondary}
    style={[{ color: theme.global.textPrimary, backgroundColor: theme.global.inputBackground,
      borderColor: focused ? theme.global.accent : error ? theme.semantic.dangerText : controlBoundary(theme.global),
      borderWidth: 2, borderRadius: radius.control, padding: space.md, minHeight: target, textAlignVertical: "top" }, style]} />
    {error && <OrganizationError error={error} />}
  </View>;
}
export function OrganizationError({ error, retry }: { error: string | null; retry?: () => void }) {
  const { theme } = useAppTheme();
  return error ? <View style={{ gap: space.sm }}><Text accessibilityLiveRegion="assertive" style={{ color: theme.semantic.dangerText }}>{error}</Text>{retry && <OrganizationButton label="Reintentar" onPress={retry} />}</View> : null;
}

export function OrganizationStatus({ kind, title, detail, action }: {
  kind: "loading" | "empty" | "restricted";
  title: string;
  detail?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { theme } = useAppTheme();
  return <View accessibilityState={{ busy: kind === "loading" }} accessibilityLiveRegion="polite" style={{ gap: space.sm }}>
    {kind === "loading" && <ActivityIndicator color={theme.global.accent} style={{ alignSelf: "flex-start" }} />}
    <OrganizationText heading>{title}</OrganizationText>
    {detail && <OrganizationText muted>{detail}</OrganizationText>}
    {action && <OrganizationButton label={action.label} onPress={action.onPress} />}
  </View>;
}
