import React from "react";
import { Text, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../../src/theme/AppThemeProvider";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width, fontScale=1 } = useWindowDimensions();
  const labelLines=Math.ceil(15*7*fontScale/Math.max(32,width/5-12));
  const { theme } = useAppTheme();

  return (
    <Tabs
      screenOptions={({ route }) => {
        const icon = (() => {
          switch (route.name) {
            case "buscar":
              return { on: "search", off: "search-outline" } as const;
            case "libreria":
              return { on: "library", off: "library-outline" } as const;
            case "etiquetas":
              return { on: "pricetag", off: "pricetag-outline" } as const;
            case "actualizaciones":
              return { on: "refresh-circle", off: "refresh-circle-outline" } as const;
            case "ajustes":
              return { on: "settings", off: "settings-outline" } as const;
            default:
              return { on: "ellipse", off: "ellipse-outline" } as const;
          }
        })();

        const label = (() => {
          switch (route.name) {
            case "buscar":
              return "Buscar";
            case "libreria":
              return "Librería";
            case "etiquetas":
              return "Etiquetas";
            case "actualizaciones":
              return "Actualizaciones";
            case "ajustes":
              return "Ajustes";
            default:
              return route.name;
          }
        })();

        return {
          headerStyle: { backgroundColor: theme.global.background },
          headerTintColor: theme.global.textPrimary,

          tabBarAccessibilityLabel: label,
          tabBarLabel: ({color}) => <Text style={{color,fontSize:12,fontWeight:"700",textAlign:"center",width:"100%"}}>{label}</Text>,
          tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },

          tabBarActiveTintColor: theme.global.accent,
          tabBarInactiveTintColor: theme.global.textMuted,

          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? icon.on : icon.off}
              size={size ?? 22}
              color={color}
            />
          ),

          tabBarStyle: {
            backgroundColor: theme.global.background,
            borderTopColor: theme.global.border,
            borderTopWidth: 1,

            // ✅ evita conflicto con barra del sistema
            height: Math.max(58,38+labelLines*14*fontScale) + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 6,

            // ✅ web: que no se corte fácil
            overflow: "hidden",
          },

          tabBarItemStyle: {
            paddingHorizontal: 6,
          },
        };
      }}
    >
      {/* Opcional: orden fijo */}
      <Tabs.Screen name="libreria" options={{ title: "Librería" }} />
      <Tabs.Screen name="buscar" options={{ title: "Buscar" }} />
      <Tabs.Screen name="etiquetas" options={{ title: "Etiquetas" }} />
      <Tabs.Screen name="actualizaciones" options={{ title: "Actualizaciones" }} />
      <Tabs.Screen name="ajustes" options={{ title: "Ajustes" }} />
    </Tabs>
  );
}
