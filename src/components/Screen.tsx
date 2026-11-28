import React from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/AppThemeProvider";
import { space } from "../theme/presentation";

type ScreenProps = ScrollViewProps & {
  topOwner?: "navigator" | "screen";
  bottomOwner?: "tabs" | "screen";
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export function Screen({
  topOwner = "navigator", bottomOwner = "screen", header, footer,
  children, contentContainerStyle, ...props
}: ScreenProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const top = topOwner === "screen" ? insets.top : 0;
  const bottom = bottomOwner === "screen" ? insets.bottom : 0;

  return <View style={{ flex: 1, backgroundColor: theme.global.background, paddingLeft: insets.left, paddingRight: insets.right, paddingTop: top }}>
    {header}
    <ScrollView {...props} keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? "handled"}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[{
        width: "100%", maxWidth: 1000, alignSelf: "center", gap: space.lg,
        padding: space.lg, paddingBottom: space.xl + (footer ? 0 : bottom),
      }, contentContainerStyle]}>
      {children}
    </ScrollView>
    {footer && <View style={{ paddingBottom: bottom }}>{footer}</View>}
  </View>;
}
