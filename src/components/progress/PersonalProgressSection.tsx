import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Platform, Text, View, useWindowDimensions } from "react-native";
import type { MediaClassification } from "../../core/mediaClassification";
import { nextProgressEpisode, progressEligibility, progressPositionCompatible, progressVersionsEqual, type PersonalProgress, type ProgressPosition } from "../../core/personalProgress";
import { PROGRESS_MODE_LABELS, progressDraft, positionFromProgressDraft, progressPositionLabel, progressPositionScale, type AccreditedPositionScale } from "../../core/personalProgressPresentation";
import type { ProgressIntent } from "../../storage/personalProgressRepo";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { radius, space, type } from "../../theme/presentation";
import { OrganizationButton, OrganizationInput } from "../organization/OrganizationUI";
import { PersonalProgressPosition } from "./PersonalProgressPosition";
import type { ProgressDraft } from "../../core/personalProgressPresentation";

// Session-only drafts survive leaving and reopening a title; they are never persisted or exported.
const drafts = new Map<string, { draft: ProgressDraft; base: { progress: PersonalProgress | null; classification: MediaClassification } | null }>();

export type PersonalProgressSectionProps = { itemId: string; classification: MediaClassification; progress: PersonalProgress | null;
  loading?: boolean; readError?: unknown; onRetry(): void; save(intent: ProgressIntent): Promise<PersonalProgress>;
  onConfirmed(progress: PersonalProgress): void; scale?: AccreditedPositionScale };

export function PersonalProgressSection({ itemId, classification, progress, loading = false, readError, onRetry, save, onConfirmed, scale }: PersonalProgressSectionProps) {
  const { theme } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const [help, setHelp] = useState(false);
  const [options, setOptions] = useState(false);
  const cached = useRef(drafts.get(itemId));
  const [editor, setEditor] = useState(!!cached.current), [draft, setDraft] = useState(() => cached.current?.draft ?? progressDraft(null));
  const [base, setBase] = useState<{ progress: PersonalProgress | null; classification: MediaClassification } | null>(cached.current?.base ?? null);
  const [confirmation, setConfirmation] = useState<"reset" | "discard" | null>(null);
  const [requestedMode, setRequestedMode] = useState<ProgressPosition["mode"] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [stale, setStale] = useState(false);
  const [notice, setNotice] = useState("");
  const lock = useRef(false), mounted = useRef(true), trigger = useRef<View>(null), cancel = useRef<View>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (editor) drafts.set(itemId, { draft, base }); }, [itemId, editor, draft, base]);
  useEffect(() => {
    if (!editor && !confirmation) return;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelAction(); } };
      const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
      // TextInput stops bubbling keydown in react-native-web; capture Escape before it.
      document.addEventListener("keydown", key, true); window.addEventListener("beforeunload", unload);
      return () => { document.removeEventListener("keydown", key, true); window.removeEventListener("beforeunload", unload); };
    }
    if (Platform.OS === "android") { const subscription = BackHandler.addEventListener("hardwareBackPress", () => { cancelAction(); return true; }); return () => subscription.remove(); }
  }, [editor, confirmation, requestedMode]);
  useEffect(() => { if (!editor && !confirmation) setStale(false); }, [progress, classification, editor, confirmation]);
  useEffect(() => {
    if (confirmation || requestedMode) { const frame = requestAnimationFrame(() => cancel.current?.focus()); return () => cancelAnimationFrame(frame); }
  }, [confirmation, requestedMode]);
  const eligibility = progressEligibility(classification);
  const incompatible = !!progress?.position && !progressPositionCompatible(classification, progress.position);
  const obsolete = !!base && (!progressVersionsEqual(base.progress, progress) ||
    base.classification.medium !== classification.medium || base.classification.contentFamily !== classification.contentFamily || base.classification.primaryFormat !== classification.primaryFormat);
  const blocked = busy || loading || !!readError;
  const next = incompatible ? null : nextProgressEpisode(progress?.position ?? null);
  const visibleScale = incompatible ? null : progressPositionScale(progress, scale);
  const modes: ProgressPosition["mode"][] = classification.medium === "comic" ? ["chapter", "special"] : ["episode", "season-episode", "special"];
  function focusTrigger() { requestAnimationFrame(() => trigger.current?.focus()); }
  function close() { drafts.delete(itemId); setEditor(false); setOptions(false); setBase(null); setConfirmation(null); setRequestedMode(null); setError(null); setStale(false); focusTrigger(); }
  function begin() { setBase({ progress, classification }); setDraft(progressDraft(incompatible ? null : progress?.position ?? null)); setEditor(true); setOptions(false); setError(null); setStale(false); setNotice(""); }
  function cancelAction() {
    if (lock.current) return;
    if (confirmation || requestedMode) { setConfirmation(null); setRequestedMode(null); return; }
    if (editor) setConfirmation("discard");
    else setOptions(false);
  }
  async function persist(position: ProgressPosition | null, expected = base?.progress ?? progress, expectedClassification = base?.classification ?? classification) {
    if (lock.current || blocked || obsolete || stale) return;
    lock.current = true; setBusy(true); setError(null); setNotice("");
    try {
      const confirmed = await save({ itemId, expected, expectedClassification, position });
      if (!mounted.current) return;
      onConfirmed(confirmed); close(); setNotice(confirmed.position ? `Guardado: ${progressPositionLabel(confirmed.position)}.` : "Progreso restablecido.");
    } catch (reason) {
      if (!mounted.current) return;
      if (reason instanceof Error && reason.name === "ProgressConflict") setStale(true);
      setError(reason instanceof Error ? reason.message : "No se pudo guardar. Conservamos tu borrador; podés reintentar.");
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function submit() {
    try { const position = positionFromProgressDraft(draft); void persist(position); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Revisá la posición."); setHelp(true); }
  }
  if (eligibility === "none" && !progress && !readError) return null;
  const text = { color: theme.global.textPrimary }, muted = { color: theme.global.textSecondary };
  const escape = Platform.OS === "web" ? { onKeyDown: (event: { key: string; preventDefault(): void; stopPropagation(): void }) => {
    if (event.key === "Escape" && (editor || confirmation || requestedMode)) { event.preventDefault(); event.stopPropagation(); cancelAction(); }
  } } : {};
  return <View {...escape} onAccessibilityEscape={cancelAction} style={{ padding: space.lg, gap: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: theme.global.border, backgroundColor: theme.global.surface, overflow: "hidden" }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
      <Text accessibilityRole="header" style={[type.title, text]}>Mi progreso</Text>
      {!editor && !confirmation && progress?.position && <OrganizationButton label="Más opciones de progreso" icon="ellipsis-horizontal" iconOnly variant="link" expanded={options} disabled={blocked} onPress={() => setOptions(value => !value)} />}
    </View>
    {options && !editor && !confirmation && <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space.sm, borderBottomWidth: 1, borderColor: theme.global.border, paddingBottom: space.sm }}>
      <Text style={[type.caption, muted]}>Opciones de la posición</Text>
      <OrganizationButton label="Restablecer" variant="link" disabled={blocked} onPress={() => { setOptions(false); setBase({ progress, classification }); setConfirmation("reset"); }} />
    </View>}
    {loading && <Text accessibilityLiveRegion="polite" style={[type.control, muted]}>Cargando progreso…</Text>}
    <View style={{ backgroundColor: theme.global.surfaceSecondary, marginHorizontal: -space.lg, paddingHorizontal: space.lg, paddingVertical: space.xl, borderLeftWidth: space.xs, borderColor: theme.global.accent, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.xl, rowGap: space.lg }}>
      {progress?.position ? <PersonalProgressPosition position={progress.position} /> : <Text style={[type.heading, text, { flexShrink: 1 }]}>{readError ? "Progreso no disponible" : progress ? "Progreso restablecido" : "Sin progreso registrado"}</Text>}
      {!editor && !confirmation && <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, maxWidth: "100%" }}>
        {next && <OrganizationButton label="Sumar episodio" accessibilityLabel={`Sumar un episodio. Registrar ${progressPositionLabel(next)}`} icon="add" variant="primary" disabled={blocked || stale} onPress={() => { void persist(next, progress, classification); }} />}
        {eligibility !== "none" && <OrganizationButton label={progress?.position ? "Editar" : eligibility === "explicit" ? "Activar seguimiento manual" : "Registrar progreso"} accessibilityLabel={progress?.position ? "Editar progreso" : undefined} icon={progress?.position ? "create-outline" : "add"} iconOnly={!!progress?.position && !!next} variant={progress?.position ? "secondary" : "primary"} buttonRef={trigger} disabled={blocked} onPress={begin} />}
      </View>}
    </View>
    {incompatible && <Text accessibilityRole="alert" style={[type.control, { color: theme.semantic.dangerText }]}>La clasificación actual no coincide con esta posición. La conservamos sin convertirla.</Text>}
    {readError ? <View style={{ gap: space.sm }}><Text accessibilityRole="alert" style={[type.control, { color: theme.semantic.dangerText }]}>No pudimos leer el progreso. No se puede editar hasta actualizarlo.</Text><OrganizationButton label="Reintentar progreso" onPress={onRetry} disabled={busy} /></View> : null}
    {visibleScale && <View style={{ gap: space.xs }}><Text style={[type.caption, muted]}>{visibleScale.label} · {visibleScale.source}</Text>
      <View accessible={false} accessibilityElementsHidden aria-hidden style={{ height: space.xs, borderRadius: radius.round, backgroundColor: theme.global.surfaceSecondary, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${visibleScale.ratio * 100}%`, backgroundColor: theme.global.accent }} />
      </View></View>}
    {editor && <View style={{ gap: space.md, paddingTop: space.xs }}>
      <Text style={[type.caption, muted]}>Numeración · Borrador sin guardar</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>{modes.map(mode => <OrganizationButton key={mode} label={{ episode: "Continuo", "season-episode": "Temporada", chapter: "Capítulos", special: "Especial" }[mode]} accessibilityLabel={PROGRESS_MODE_LABELS[mode]} selected={draft.mode === mode} buttonRef={draft.mode === mode ? trigger : undefined} disabled={blocked || !!requestedMode} onPress={() => {
        if (draft.mode === mode) return;
        if (draft.mode) setRequestedMode(mode); else setDraft({ ...progressDraft(null), mode });
      }} />)}</View>
      {requestedMode && <View style={{ gap: space.xs, paddingVertical: space.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.global.border }}><Text accessibilityRole="alert" style={[type.control, text]}>Cambiar a {PROGRESS_MODE_LABELS[requestedMode]} requiere una posición nueva.</Text>
        <Text style={[type.caption, muted]}>Se vacían estos campos, sin convertir números. El progreso guardado se conserva hasta guardar.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <OrganizationButton label="Conservar numeración" buttonRef={cancel} disabled={busy} onPress={() => { setRequestedMode(null); focusTrigger(); }} />
        <OrganizationButton label="Cambiar numeración" disabled={busy} onPress={() => { setDraft({ ...progressDraft(null), mode: requestedMode }); setRequestedMode(null); }} />
        </View>
      </View>}
      {(draft.mode === "episode" || draft.mode === "season-episode") && <>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
          {draft.mode === "season-episode" && <View style={{ flexGrow: 1, flexBasis: 120 * Math.max(1, fontScale), minWidth: 0 }}><OrganizationInput label="Temporada" value={draft.season} keyboardType="number-pad" inputMode="numeric" editable={!blocked} onChangeText={season => setDraft(d => ({ ...d, season }))} /></View>}
          <View style={{ flexGrow: 1, flexBasis: 120 * Math.max(1, fontScale), minWidth: 0 }}><OrganizationInput label="Último episodio" value={draft.episode} keyboardType="number-pad" inputMode="numeric" editable={!blocked} onChangeText={episode => setDraft(d => ({ ...d, episode }))} /></View>
        </View>
        <Text style={[type.caption, muted]}>Episodio: 0–999999{draft.mode === "season-episode" ? " · Temporada: 0–9999" : ""}.</Text>
      </>}
      {draft.mode === "chapter" && <><OrganizationInput label="Último capítulo" value={draft.chapter} keyboardType="decimal-pad" inputMode="decimal" editable={!blocked} placeholder="Ej. 128,5" onChangeText={chapter => setDraft(d => ({ ...d, chapter }))} /><Text style={[type.caption, muted]}>Hasta 999999.999999. Admitimos coma o punto y hasta seis decimales.</Text></>}
      {draft.mode === "special" && <><OrganizationInput label="Posición especial" value={draft.label} editable={!blocked} placeholder="Ej. Prólogo" onChangeText={label => setDraft(d => ({ ...d, label }))} /><Text style={[type.caption, muted]}>De 1 a 120 caracteres, sin saltos de línea.</Text></>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}><OrganizationButton label="Guardar progreso" variant="primary" disabled={blocked || !draft.mode || !!requestedMode || obsolete || stale || !!confirmation} onPress={submit} /><OrganizationButton label="Cancelar" disabled={busy} onPress={cancelAction} /></View>
      <OrganizationButton label="Límites y ayuda" variant="link" expanded={help} onPress={() => setHelp(value => !value)} />
      {help && <Text style={[type.caption, muted]}>La posición no indica cuántos episodios o capítulos consumiste. Temporada 0 puede representar especiales. Los capítulos admiten hasta seis decimales, con coma o punto; máximo 999999.999999. El borrador se conserva durante esta sesión.</Text>}
    </View>}
    {confirmation && <View style={{ gap: space.sm }}><Text accessibilityRole="alert" style={[type.control, text]}>{confirmation === "reset" ? "¿Restablecer la posición? El estado personal no cambia." : "¿Descartar este borrador de progreso?"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}><OrganizationButton label={confirmation === "reset" ? "Cancelar restablecimiento" : "Seguir editando"} buttonRef={cancel} disabled={busy} onPress={() => { setConfirmation(null); focusTrigger(); }} />
        <OrganizationButton label={confirmation === "reset" ? "Confirmar restablecimiento" : "Descartar borrador"} variant="danger" disabled={busy || confirmation === "reset" && (blocked || obsolete || stale)} onPress={() => confirmation === "reset" ? void persist(null) : close()} /></View>
    </View>}
    {(obsolete || stale) && <View style={{ gap: space.sm }}><Text accessibilityRole="alert" style={[type.control, { color: theme.semantic.dangerText }]}>El progreso o formato cambió. Tu borrador sigue aquí. Actualizá y revisalo antes de guardar.</Text><OrganizationButton label="Actualizar progreso" disabled={busy} onPress={onRetry} />
      {editor && <OrganizationButton label="Revisé la posición actual; conservar mi borrador" disabled={blocked} onPress={() => { setBase({ progress, classification }); setStale(false); setError(null); }} />}</View>}
    {busy && <Text accessibilityLiveRegion="polite" style={[type.caption, muted]}>Guardando progreso…</Text>}
    {error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[type.control, { color: theme.semantic.dangerText }]}>{error}</Text>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={[type.caption, muted]}>{notice}</Text>}
  </View>;
}
