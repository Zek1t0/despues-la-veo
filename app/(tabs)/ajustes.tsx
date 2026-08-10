import React, { useRef, useState } from "react";
import { Alert, ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import { parseLibraryBackup } from "../../src/core/libraryBackup";
import type { BackupValidationError } from "../../src/core/libraryBackupV1";
import { createLibraryBackupV3 } from "../../src/core/libraryBackupV3";
import { getLibraryBackupExportData } from "../../src/storage/libraryBackupExport";
import { mergeLibraryBackup } from "../../src/storage/savedTitlesRepo";
import { colors } from "../../src/theme/colors";

const MAX_IMPORT_PROBLEM_DETAILS = 5;

type ImportProblemDetail = {
  reference: string;
  reason: string;
};

function invalidProblemDetail(error: BackupValidationError): ImportProblemDetail {
  const itemReference = error.index === undefined ? "Elemento" : `Elemento ${error.index + 1}`;
  const fieldReference = error.field ? `, campo ${error.field}` : "";
  return {
    reference: `${itemReference}${fieldReference}`,
    reason: error.message,
  };
}

function formatProblemDetails(label: string, details: ImportProblemDetail[]): string | null {
  if (details.length === 0) return null;

  const visible = details
    .slice(0, MAX_IMPORT_PROBLEM_DETAILS)
    .map((detail) => `- ${detail.reference}: ${detail.reason}`);
  const hiddenCount = details.length - visible.length;
  if (hiddenCount > 0) visible.push(`- Hay ${hiddenCount} elemento(s) más no mostrado(s).`);

  return `${label}:\n${visible.join("\n")}`;
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function readTextFromUri(uri: string): Promise<string> {
  return new File(uri).text();
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

      const { items, pins } = await getLibraryBackupExportData();
      const payload = createLibraryBackupV3(items, pins);

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
        setLastMsg(`Export listo: ${items.length} títulos y ${pins.length} pins.`);
        return;
      }

      const file = new File(Paths.cache, filename);
      file.write(json);

      const shareAvailable = await Sharing.isAvailableAsync();
      if (!shareAvailable) {
        Alert.alert("Export", "Sharing no está disponible en este dispositivo.");
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Exportar biblioteca",
        UTI: "public.json",
      });

      setLastMsg(`Export listo: ${items.length} títulos y ${pins.length} pins.`);
    } catch (e: any) {
      Alert.alert("Error exportando", e?.message ?? "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const doImportFromText = async (text: string) => {
    setLastMsg(null);
    const validated = parseLibraryBackup(text);
    if (!validated.ok) {
      Alert.alert("Import", validated.error.message);
      return;
    }

    const { payload } = validated;
    const totalCount = payload.items.length + payload.invalid.length;
    const invalidCount = payload.invalid.length;
    const msg = [
      `Versión: ${payload.version}`,
      `Total: ${totalCount}`,
      `Válidos: ${payload.items.length}`,
      `Inválidos: ${invalidCount}`,
      ...(payload.version !== 1
        ? [
            `Pins válidos: ${payload.pins.length}`,
            `Pins estructuralmente inválidos: ${payload.invalidPins.length}`,
          ]
        : ["Este backup v1 no contiene ni modifica pins por ausencia."]),
      "",
      "La importación hace merge: no borra títulos locales ausentes del backup.",
      "Sólo actualiza coincidencias del mismo tipo cuando el backup es más reciente; conserva los cambios locales iguales o más recientes.",
      "El resultado puede ser parcial: algunos elementos pueden procesarse y otros omitirse o fallar.",
      "",
      "¿Continuar?",
    ].join("\n");

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
      const result = await mergeLibraryBackup(payload, uuid);
      const structurallyInvalidPins = payload.version !== 1
        ? payload.invalidPins.map((error) => ({
            reference: `Pin ${error.index + 1}`,
            reason: error.message,
          }))
        : [];
      const finalResult = {
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        conflicts: result.conflicts,
        invalid: payload.invalid.map(invalidProblemDetail),
        failed: result.failed,
        pinsInserted: result.pins.inserted,
        pinsPreserved: result.pins.preserved,
        pinsInvalid: [...structurallyInvalidPins, ...result.pins.invalid],
        pinsFailed: result.pins.failed,
      };
      const persistedCount = finalResult.inserted + finalResult.updated + finalResult.pinsInserted;
      const nonAppliedCount =
        finalResult.skipped +
        finalResult.conflicts.length +
        finalResult.invalid.length +
        finalResult.failed.length +
        finalResult.pinsInvalid.length +
        finalResult.pinsFailed.length;
      let outcome: string;
      if (persistedCount > 0 && nonAppliedCount === 0) {
        outcome = "Importación completada.";
      } else if (persistedCount > 0 && nonAppliedCount > 0) {
        outcome =
          "Resultado parcial: se conservaron los cambios persistidos y se detallan los elementos no aplicados.";
      } else if (
        finalResult.skipped > 0 &&
        finalResult.conflicts.length === 0 &&
        finalResult.invalid.length === 0 &&
        finalResult.failed.length === 0
      ) {
        outcome =
          "No se realizaron cambios: todos los elementos fueron omitidos porque los datos locales eran iguales o más recientes.";
      } else if (nonAppliedCount > 0) {
        outcome = "No se aplicaron cambios. Revisá los resultados detallados.";
      } else {
        outcome = "El backup no contenía elementos para importar.";
      }
      const detailSections = [
        formatProblemDetails("Inválidos", finalResult.invalid),
        formatProblemDetails("Conflictos", finalResult.conflicts),
        formatProblemDetails("Fallidos", finalResult.failed),
        formatProblemDetails("Pins omitidos", finalResult.pinsInvalid),
        formatProblemDetails("Pins fallidos", finalResult.pinsFailed),
      ].filter((section): section is string => section !== null);
      const countLines = [
        `Insertados: ${finalResult.inserted}`,
        `Actualizados: ${finalResult.updated}`,
        `Omitidos: ${finalResult.skipped}`,
        `Conflictos: ${finalResult.conflicts.length}`,
        `Inválidos: ${finalResult.invalid.length}`,
        `Fallidos: ${finalResult.failed.length}`,
        ...(payload.version !== 1
          ? [
              `Pins insertados: ${finalResult.pinsInserted}`,
              `Pins existentes conservados: ${finalResult.pinsPreserved}`,
              `Pins omitidos: ${finalResult.pinsInvalid.length}`,
              `Pins fallidos: ${finalResult.pinsFailed.length}`,
            ]
          : []),
      ];
      const finalMsg = [
        outcome,
        "",
        ...countLines,
        ...(detailSections.length > 0 ? ["", ...detailSections] : []),
      ].join("\n");
      setLastMsg(finalMsg);
      if (Platform.OS !== "web") {
        const mobileSummary = [
          outcome,
          "",
          ...countLines,
          "",
          "Los detalles están visibles en Ajustes.",
        ].join("\n");
        Alert.alert("Resultado de importación", mobileSummary);
      }
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
        Export genera un .json versionado. Import hace MERGE: no borra títulos locales ausentes del
        backup y evita duplicados por provider + externalId.
      </Text>
    </View>
  );
}
