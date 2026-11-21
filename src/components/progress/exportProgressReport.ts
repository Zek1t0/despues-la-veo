import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** Same local download/share transports as the library backup. No network or durable report store. */
export async function exportProgressReport(value: unknown): Promise<void> {
  const json = JSON.stringify(value, null, 2), filename = `despues-la-veo-conflictos-progreso-${Date.now()}.json`;
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    try { const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); }
    finally { URL.revokeObjectURL(url); }
    return;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error("No está disponible compartir el informe en este dispositivo.");
  const file = new File(Paths.cache, filename);
  try { file.write(json); await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Exportar informe de progreso", UTI: "public.json" }); }
  finally { if (file.exists) file.delete(); }
}
