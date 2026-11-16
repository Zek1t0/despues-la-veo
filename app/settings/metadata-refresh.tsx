import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { useAppTheme } from "../../src/theme/AppThemeProvider";
import { DEFAULT_MEDIA_PREFERENCES, parseMediaPreferences } from "../../src/core/mediaPreferences";
import { getMediaPreferences, setMediaAutoRefresh, subscribeMediaPreferences } from "../../src/storage/mediaPreferencesRepo";

export default function MetadataRefreshScreen() {
  const { theme } = useAppTheme();
  const [enabled, setEnabled] = useState(DEFAULT_MEDIA_PREFERENCES.autoRefresh.enabled);
  const [interval, setInterval] = useState(String(DEFAULT_MEDIA_PREFERENCES.autoRefresh.intervalDays));
  const [loaded, setLoaded] = useState(false), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null), [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true, revision = -1;
    const apply = (next: Awaited<ReturnType<typeof getMediaPreferences>>) => {
      if (!active || next.updatedAt < revision) return;
      revision = next.updatedAt;
      if (!dirty) { setEnabled(next.value.autoRefresh.enabled); setInterval(String(next.value.autoRefresh.intervalDays)); }
      setLoaded(true);
    };
    const stop = subscribeMediaPreferences(apply);
    void getMediaPreferences().then(apply).catch(() => { if (active) setError("No se pudo leer la configuración. Volvé a abrir Ajustes para reintentar."); });
    return () => { active = false; stop(); };
  }, [dirty]);
  const change = () => { setDirty(true); setSaved(false); setError(null); };
  async function save() {
    const value = interval.trim().replace(",", ".");
    const intervalDays = value ? Number(value) : NaN;
    try { parseMediaPreferences({ updatedAt: 0, value: { ...DEFAULT_MEDIA_PREFERENCES, autoRefresh: { enabled, intervalDays } } }); }
    catch { setError("Ingresá un intervalo positivo de hasta 3650 días."); return; }
    setSaving(true); setError(null);
    try { await setMediaAutoRefresh({ enabled, intervalDays }); setDirty(false); setSaved(true); }
    catch { setError("No se pudo guardar. Podés reintentar."); }
    finally { setSaving(false); }
  }
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    disabled={saving || disabled || !loaded} accessibilityState={{ disabled: saving || disabled || !loaded }} onPress={action}
    style={{ minHeight: 44, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.global.border }}>
    <Text style={{ color: theme.global.textPrimary }}>{label}</Text></Pressable>;
  return <ScrollView style={{ backgroundColor: theme.global.background }} contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 800, width: "100%", alignSelf: "center" }}>
    <Stack.Screen options={{ title: "Actualización de metadata" }} />
    <Text accessibilityRole="header" style={{ color: theme.global.textPrimary, fontSize: 22, fontWeight: "800" }}>Actualización de metadata</Text>
    <Text style={{ color: theme.global.textSecondary }}>Al abrir una ficha guardada elegible, se consulta en segundo plano si su metadata está vencida. La ficha local sigue disponible.</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Switch accessibilityLabel="Actualizar automáticamente al abrir" value={enabled} disabled={saving || !loaded} onValueChange={value => { setEnabled(value); change(); }} />
      <Text style={{ color: theme.global.textPrimary }}>Actualizar automáticamente al abrir</Text>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{[1, 7, 30].map(days => <View key={days}>{button(`${days} ${days === 1 ? "día" : "días"}`, () => { setInterval(String(days)); change(); })}</View>)}</View>
    <TextInput accessibilityLabel="Intervalo de actualización en días" keyboardType="decimal-pad" value={interval} editable={!saving && loaded}
      onChangeText={value => { setInterval(value); change(); }} style={{ color: theme.global.textPrimary, borderWidth: 1, borderColor: theme.global.border, borderRadius: 10, padding: 12 }} />
    <Text style={{ color: theme.global.textSecondary }}>El intervalo inicial de 7 días y la espera de 15 minutos tras un fallo automático son políticas de DespuésLaVeo. No son cuotas de proveedores. Una espera HTTP mayor siempre se respeta. No se revisa toda la biblioteca al iniciar.</Text>
    {button(saving ? "Guardando…" : "Guardar configuración", () => { void save(); }, !dirty)}
    {saved && <Text accessibilityLiveRegion="polite" style={{ color: theme.global.textSecondary }}>Configuración guardada.</Text>}
    {error && <Text accessibilityRole="alert" style={{ color: theme.semantic.dangerText }}>{error}</Text>}
  </ScrollView>;
}
