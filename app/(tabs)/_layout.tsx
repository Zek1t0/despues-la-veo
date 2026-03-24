import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../../src/theme/colors";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

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
            case "ajustes":
              return "Ajustes";
            default:
              return route.name;
          }
        })();

        return {
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,

          tabBarLabel: label,
          tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },

          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.subtle,

          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? icon.on : icon.off}
              size={size ?? 22}
              color={color}
            />
          ),

          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            borderTopWidth: 1,

            // ✅ evita conflicto con barra del sistema
            height: 58 + insets.bottom,
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
      <Tabs.Screen name="ajustes" options={{ title: "Ajustes" }} />
    </Tabs>
  );
}