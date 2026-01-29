import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="library" options={{ title: "Biblioteca" }} />
      <Tabs.Screen name="explore" options={{ title: "Explorar" }} />
      <Tabs.Screen name="tags" options={{ title: "Tags" }} />
      <Tabs.Screen name="settings" options={{ title: "Ajustes" }} />
    </Tabs>
  );
}
