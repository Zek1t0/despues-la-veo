import React, { useRef, useState } from "react";
import { Alert, ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import type { SavedTitle, TitleStatus, TitleType } from "../../src/core/savedTitle";
import { bulkUpsertSavedTitles, getAllSavedTitles } from "../../src/storage/savedTitlesRepo";

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

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

// === Validadores exactos según tu savedTitle.ts ===
const PROVIDERS = ["manual", "tmdb"] as const;
type Provider = (typeof PROVIDERS)[number];

function isProvider(x: any): x is Provider {
  return typeof x === "string" && (PROVIDERS as readonly string[]).includes(x);
}

function isTitleType(x: any): x is TitleType {
  return x === "movie" || x === "tv";
}

function isTitleStatus(x: any): x is TitleStatus {
  return x === "planned" || x === "watching" || x === "done" || x === "dropped";
}

function normalizeSavedTitle(raw: any): SavedTitle | null {
  if (!isObject(raw)) return null;

  const provider = (raw as any).provider;
  const externalId = (raw as any).externalId;
  const type = (raw as any).type;

  const title =
    typeof (raw as any).title === "string"
      ? (raw as any).title
      : typeof (raw as any).name === "string"
        ? (raw as any).name
        : null;

  if (!isProvider(provider)) return null;
  if (typeof externalId !== "string") return null;
  if (!isTitleType(type)) return null;
  if (!title) return null;

  const status: TitleStatus = isTitleStatus((raw as any).status) ? (raw as any).status : "planned";

  return {
    id: typeof (raw as any).id === "string" ? (raw as any).id : uuid(),
    provider,
    externalId,
    type,
    title,
    year: typeof (raw as any).year === "number" ? (raw as any).year : null,
    posterUrl: typeof (raw as any).posterUrl === "string" ? (raw as any).posterUrl : null,
    status,
    tags: Array.isArray((raw as any).tags)
      ? (raw as any).tags.filter((t: any) => typeof t === "string")
      : [],
    notes: typeof (raw as any).notes === "string" ? (raw as any).notes : null,
    createdAt: typeof (raw as any).createdAt === "number" ? (raw as any).createdAt : Date.now(),
    updatedAt: typeof (raw as any).updatedAt === "number" ? (raw as any).updatedAt : Date.now(),
  };
}

function parseAndValidateExport(
  jsonText: string
): { payload: ExportPayloadV1; invalidCount: number } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { error: "El archivo no es JSON válido." };
  }

  if (!isObject(parsed)) return { error: "El JSON debe ser un objeto." };

  const version = (parsed as any).version;
  if (version !== 1) return { error: "Versión de backup no soportada (se esperaba version=1)." };

  const items = (parsed as any).items;
  if (!Array.isArray(items)) return { error: "El JSON debe tener 'items' como array." };

  const normalized: SavedTitle[] = [];
  let invalid = 0;

  for (const it of items) {
    const n = normalizeSavedTitle(it);
    if (n) normalized.push(n);
    else invalid++;
  }

  return {
    payload: {
      version: 1,
      exportedAt:
        typeof (parsed as any).exportedAt === "string"
          ? (parsed as any).exportedAt
          : new Date().toISOString(),
      items: normalized,
    },
    invalidCount: invalid,
  };
}

async function readTextFromUri(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri);
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

      // WEB: descarga por Blob
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

      // MOBILE: write + share
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
    const validated = parseAndValidateExport(text);
    if ("error" in validated) {
      Alert.alert("Import", validated.error);
      return;
    }

    const { payload, invalidCount } = validated;

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
      const { ok, fail } = await bulkUpsertSavedTitles(payload.items);
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
    ev.target.value = ""; // permite elegir el mismo archivo otra vez
    if (!f) return;

    const text = await f.text();
    await doImportFromText(text);
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Ajustes</Text>

      <Pressable
        onPress={onExport}
        disabled={busy}
        style={{
          padding: 14,
          borderRadius: 12,
          backgroundColor: busy ? "#999" : "#111",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>
          Exportar biblioteca
        </Text>
      </Pressable>

      <Pressable
        onPress={onImport}
        disabled={busy}
        style={{
          padding: 14,
          borderRadius: 12,
          backgroundColor: busy ? "#999" : "#111",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>
          Importar biblioteca
        </Text>
      </Pressable>

      {busy && (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <ActivityIndicator />
          <Text>Procesando…</Text>
        </View>
      )}

      {!!lastMsg && <Text style={{ opacity: 0.8 }}>{lastMsg}</Text>}

      {Platform.OS === "web" && (
        <input
          ref={webFileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={onWebFilePicked}
        />
      )}

      <Text style={{ opacity: 0.6, marginTop: 10 }}>
        Export genera un .json versionado. Import hace MERGE (no borra nada) y evita duplicados por
        provider + externalId.
      </Text>
    </View>
  );
}
