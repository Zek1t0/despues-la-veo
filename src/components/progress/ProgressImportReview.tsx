import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { progressPositionLabel } from "../../core/personalProgressPresentation";
import type { PersonalProgress } from "../../core/personalProgress";
import type { ProgressImportConflict, ProgressImportResult } from "../../storage/personalProgressBackupImport";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { space, type } from "../../theme/presentation";
import { OrganizationButton } from "../organization/OrganizationUI";

export type ProgressReviewReport = { importedAt: string; result: ProgressImportResult };
type Resolution = { status: "local" | "applied"; confirmed?: PersonalProgress };
export function ProgressImportReview({ report, apply, exportReport, close }: {
  report: ProgressReviewReport; apply(candidate: ProgressImportConflict): Promise<PersonalProgress>;
  exportReport(value: unknown): Promise<void>; close(): void;
}) {
  const { theme } = useAppTheme();
  const [page, setPage] = useState(0), [confirm, setConfirm] = useState<number | "close" | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, Resolution>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const lock = useRef(false), cancel = useRef<View>(null);
  const entries = report.result.conflicts, pending = entries.length - Object.keys(resolutions).length;
  const label = (progress: PersonalProgress) => progress.position ? progressPositionLabel(progress.position) : "Restablecido";
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo completar. Podés reintentar."); }
    finally { lock.current = false; setBusy(false); }
  }
  function ask(index: number | "close") { setConfirm(index); requestAnimationFrame(() => cancel.current?.focus()); }
  return <View style={{ gap: space.md, borderWidth: 1, borderColor: theme.global.border, padding: space.lg }}>
    <Text accessibilityRole="header" style={[type.heading, { color: theme.global.textPrimary }]}>Revisión de progreso importado</Text>
    <Text style={{ color: theme.global.textSecondary }}>Se conserva tu versión local por defecto. Los relojes no prueban consumo ni prioridad de una corrección. Este informe es temporal: al salir de Ajustes o cerrarlo se pierde. Exportalo antes si querés conservarlo.</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: theme.global.textPrimary }}>{pending} pendientes · {Object.values(resolutions).filter(v => v.status === "local").length} locales conservados · {Object.values(resolutions).filter(v => v.status === "applied").length} aplicados.</Text>
    <OrganizationButton label="Exportar informe completo JSON" disabled={busy} onPress={() => { void run(() => exportReport({ ...report, resolutions })); }} />
    {entries.slice(page * 10, page * 10 + 10).map((entry, offset) => {
      const index = page * 10 + offset, resolution = resolutions[index];
      return <View key={index} style={{ gap: space.sm, borderTopWidth: 1, borderColor: theme.global.border, paddingTop: space.md }}>
        <Text style={[type.title, { color: theme.global.textPrimary }]}>{entry.title}</Text>
        <Text style={{ color: theme.global.textSecondary }}>Local: {label(entry.local)} · reloj {entry.local.updatedAt}{"\n"}Backup importado: {label(entry.incoming)} · reloj {entry.incoming.updatedAt}</Text>
        {resolution ? <Text accessibilityLiveRegion="polite" style={{ color: theme.global.textPrimary }}>{resolution.status === "local" ? "Se conservó la versión local sin modificarla." : "Se aplicó la posición del backup como una nueva decisión local."}</Text> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <OrganizationButton label="Conservar local" disabled={busy || confirm !== null} onPress={() => setResolutions(old => ({ ...old, [index]: { status: "local" } }))} />
          <OrganizationButton label="Aplicar posición del backup" disabled={busy || confirm !== null} onPress={() => ask(index)} />
        </View>}
        {confirm === index && <View style={{ gap: space.sm }}>
          <Text accessibilityRole="alert" style={{ color: theme.global.textPrimary }}>¿Reemplazar la posición local por {label(entry.incoming)}? Se comprobará que el título y progreso siguen vigentes.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            <OrganizationButton label="Cancelar aplicación" buttonRef={cancel} disabled={busy} onPress={() => setConfirm(null)} />
            <OrganizationButton label="Confirmar aplicación" variant="primary" disabled={busy} onPress={() => { void run(async () => { const confirmed = await apply(entry); setResolutions(old => ({ ...old, [index]: { status: "applied", confirmed } })); setConfirm(null); }); }} />
          </View>
        </View>}
      </View>;
    })}
    {report.result.invalid.map((issue, index) => <Text key={`invalid-${index}`} style={{ color: theme.global.textSecondary }}>Inválido · {issue.reference}: {issue.reason}</Text>)}
    {report.result.failed.map((issue, index) => <Text key={`failed-${index}`} style={{ color: theme.global.textSecondary }}>Fallido · {issue.reference}: {issue.reason}</Text>)}
    {(report.result.warnings ?? []).map((issue, index) => <Text key={`warning-${index}`} style={{ color: theme.global.textSecondary }}>Aviso · {issue.reference}: {issue.reason}</Text>)}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {page > 0 && <OrganizationButton label="Conflictos anteriores" disabled={busy || confirm !== null} onPress={() => setPage(p => p - 1)} />}
      {(page + 1) * 10 < entries.length && <OrganizationButton label="Más conflictos" disabled={busy || confirm !== null} onPress={() => setPage(p => p + 1)} />}
      <OrganizationButton label="Cerrar informe de progreso" disabled={busy} onPress={() => ask("close")} />
    </View>
    {confirm === "close" && <View style={{ gap: space.sm }}><Text accessibilityRole="alert" style={{ color: theme.global.textPrimary }}>¿Descartar este informe temporal? Los candidatos pendientes no se aplicarán.</Text><OrganizationButton label="Conservar informe" buttonRef={cancel} onPress={() => setConfirm(null)} /><OrganizationButton label="Descartar informe" onPress={close} /></View>}
    {busy && <Text accessibilityLiveRegion="polite" style={{ color: theme.global.textSecondary }}>Procesando decisión…</Text>}
    {error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ color: theme.semantic.dangerText }}>{error} La posición no se reemplazó si la base quedó obsoleta. Conservá local o volvé a importar para revisar una base actual.</Text>}
  </View>;
}
