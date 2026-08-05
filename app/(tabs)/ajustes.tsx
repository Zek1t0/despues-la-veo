import React, { useRef, useState } from "react";
import { Alert, ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import type { SavedTitle } from "../../src/core/savedTitle";
import {
  materializeSavedTitleForInsert,
  parseLibraryBackupV1,
} from "../../src/core/libraryBackupV1";
import { bulkUpsertSavedTitles, getAllSavedTitles } from "../../src/storage/savedTitlesRepo";
import { colors } from "../../src/theme/colors";

type ExportPayloadV1 = {
  version: 1;
  exportedAt: string;
  items: SavedTitle[];
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function readTextFromUri(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri);
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        padding: 14,
        borderRadius: 14,
        backgroundColor: disabled ? "#3b3b3b" : colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const webFileInputRef = useRef<HTMLInputElement>(null);

  const onExport = async () => {
    try {
      setBusy(true);
      setLastMsg(null);

      const items = await getAllSavedTitles();
      const payload: ExportPayloadV1 = {
        version: 1,
        exportedAt: new Date().toISOString(),
        items,
      };

      const json = JSON.stringify(payload, null, 2);
      const filename = `despues-la-veo-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setLastMsg(`Export listo: ${items.length} títulos.`);
        return;
      }

      const baseDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory;
      if (!baseDir) throw new Error("No hay directorio disponible para escribir el backup.");

      const uri = baseDir + filename;
      await FileSystem.writeAsStringAsync(uri, json);

      const shareAvailable = await Sharing.isAvailableAsync();
      if (!shareAvailable) {
        Alert.alert("Export", "Sharing no está disponible en este dispositivo.");
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Exportar biblioteca",
        UTI: "public.json",
      });

      setLastMsg(`Export listo: ${items.length} títulos.`);
    } catch (e: any) {
      Alert.alert("Error exportando", e?.message ?? "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const doImportFromText = async (text: string) => {
    const validated = parseLibraryBackupV1(text);
    if (!validated.ok) {
      Alert.alert("Import", validated.error.message);
      return;
    }

    const { payload } = validated;
    const invalidCount = payload.invalid.length;
    const msg = `Válidos: ${payload.items.length}\nInválidos: ${invalidCount}\n\nSe va a MERGEAR (no borra nada).\n¿Continuar?`;

    const proceed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === "web") {
        resolve(window.confirm(msg));
      } else {
        Alert.alert("Confirmar importación", msg, [
          { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
          { text: "Importar", style: "destructive", onPress: () => resolve(true) },
        ]);
      }
    });

    if (!proceed) return;

    setBusy(true);
    setLastMsg(null);

    try {
      const items = payload.items.map((item) => materializeSavedTitleForInsert(item, uuid));
      const { ok, fail } = await bulkUpsertSavedTitles(items);
      const finalMsg = `Import terminado: OK ${ok} / Fallaron ${fail}`;
      setLastMsg(finalMsg);
      if (Platform.OS !== "web") Alert.alert("Import", finalMsg);
    } catch (e: any) {
      Alert.alert("Error importando", e?.message ?? "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    try {
      setLastMsg(null);

      if (Platform.OS === "web") {
        webFileInputRef.current?.click();
        return;
      }

      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;

      const file = res.assets?.[0];
      if (!file?.uri) {
        Alert.alert("Import", "No se pudo leer el archivo.");
        return;
      }

      setBusy(true);
      const text = await readTextFromUri(file.uri);
      setBusy(false);

      await doImportFromText(text);
    } catch (e: any) {
      setBusy(false);
      Alert.alert("Error importando", e?.message ?? "Error desconocido");
    }
  };

  const onWebFilePicked = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;

    const text = await f.text();
    await doImportFromText(text);
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>Ajustes</Text>

      <PrimaryButton label="Exportar biblioteca" onPress={onExport} disabled={busy} />
      <PrimaryButton label="Importar biblioteca" onPress={onImport} disabled={busy} />

      {busy && (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ color: colors.muted }}>Procesando…</Text>
        </View>
      )}

      {!!lastMsg && <Text style={{ color: colors.muted }}>{lastMsg}</Text>}

      {Platform.OS === "web" && (
        <input
          ref={webFileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={onWebFilePicked}
        />
      )}

      <Text style={{ color: colors.subtle, marginTop: 6 }}>
        Export genera un .json versionado. Import hace MERGE (no borra nada) y evita duplicados por
        provider + externalId.
      </Text>
    </View>
  );
}
