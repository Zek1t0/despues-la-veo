import React from "react";
import { Tabs } from "expo-router";

const colors = {
  bg: "#0b0b0b",
  text: "#f2f2f2",
  border: "#242424",
  muted: "#9a9a9a",
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,

        // Tabs
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
      }}
    />
  );
}