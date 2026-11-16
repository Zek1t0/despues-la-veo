import type { SavedTitleWithProviderReferences } from "./savedTitle";
import { savedMediaPresentation } from "./mediaPresentation";
import { activeMetadataDocument } from "./mediaMetadataState";
import type { EnrichedMediaMetadata } from "./enrichedMediaMetadata";
import type { ProviderLocalSnapshot } from "../providers/providerContracts";
import { mediaClassificationLabel } from "./presentationLabels";
import { metadataDate } from "./metadataValidation";

export type EditorialRow = Readonly<{ label: string; value: string; source: string }>;
export const mediaSourceName = (provider?: string | null): string =>
  provider === "kitsu" ? "Kitsu" : provider === "tmdb" ? "TMDB" : provider === "mangaupdates" ? "MangaUpdates" : provider ?? "Datos locales/históricos";
export function editorialRows(metadata?: EnrichedMediaMetadata, snapshot?: ProviderLocalSnapshot,
  historicalSource = "Datos locales/históricos"): EditorialRow[] {
  const f = metadata?.fields ?? {}, source = mediaSourceName(metadata?.provenance.reference.provider);
  const rows: EditorialRow[] = [];
  const add = (label: string, value: string, origin = source) => rows.push({ label, value, source: origin });
  const has = (key: keyof typeof f) => Object.prototype.hasOwnProperty.call(f, key);
  if (f.canonicalTitle) add("Título canónico", f.canonicalTitle);
  const titles = [...f.titles ?? [], ...f.abbreviatedTitles ?? []];
  if (titles.length) add("Títulos alternativos", titles.map(t => `${t.value} (${t.language ?? "idioma sin identificar"}${t.script ? ` · ${t.script}` : ""})`).join("\n"));
  if (has("synopsis")) add("Sinopsis", f.synopsis ? `${f.synopsis.text}\nIdioma: ${f.synopsis.language ?? "sin identificar"}` : "Desconocida");
  else if (snapshot?.overview) add("Sinopsis", snapshot.overview, historicalSource);
  for (const [key,label] of [["startDate","Estreno / publicación"],["endDate","Finalización editorial"]] as const) {
    if (has(key)) { const date=f[key]; if (date === null) add(label,"Desconocida"); else if (metadataDate(date)) add(label,`${date.slice(8)}/${date.slice(5,7)}/${date.slice(0,4)} (fecha completa)`); }
  }
  if (!has("startDate") && snapshot?.year !== null && snapshot?.year !== undefined) add("Estreno / publicación", `${snapshot.year} (solo año conocido)`, historicalSource);
  if (has("editorialStatus")) {
    const status=f.editorialStatus;
    const labels = { current:"En emisión / publicación",finished:"Finalizado",upcoming:"Próximo",unreleased:"Sin estrenar / publicar",tba:"Por anunciar",unknown:"Estado sin equivalencia conocida" };
    add("Estado editorial",status ? `${labels[status.normalized]} (${status.original})` : "Desconocido");
  }
  for (const [key,label,unit] of [["episodeCount","Episodios",""],["episodeLengthMinutes","Duración por episodio"," min"],["totalLengthMinutes","Duración total informada"," min"]] as const) {
    if (key !== "totalLengthMinutes" && (f.classification?.medium ?? snapshot?.medium) && (f.classification?.medium ?? snapshot?.medium) !== "audiovisual") continue;
    if (has(key)) { const value=f[key]; if (value === null) add(label,"Desconocido"); else if (typeof value === "number" && Number.isFinite(value) && value >= 0) add(label,`${value}${unit}`); }
  }
  for (const [key,label] of [["genres","Géneros narrativos"],["categories","Categorías / temas editoriales"],["warnings","Advertencias explícitas"]] as const) {
    if (has(key)) add(label,f[key] === null ? "Desconocidos" : f[key]?.join(", ") || "Ninguno informado");
    else if (key === "genres" && snapshot?.genres.length) add(label,snapshot.genres.join(", "),historicalSource);
  }
  if (has("ageRating")) add("Clasificación de edad de la fuente",f.ageRating ? `${f.ageRating.value} · sistema ${mediaSourceName(f.ageRating.system)}` : "Desconocida");
  if (has("ageRatingGuide")) add("Guía de clasificación de la fuente",f.ageRatingGuide ?? "Desconocida");
  if (f.classification) add("Formato / clasificación",mediaClassificationLabel(f.classification));
  else if (snapshot) add("Formato / clasificación",mediaClassificationLabel(snapshot),historicalSource);
  return rows;
}

export function savedEditorialRows(item: SavedTitleWithProviderReferences): EditorialRow[] {
  const state=item.metadataState;
  const historicalRef=state ? activeMetadataDocument(state)?.snapshot ? state.selection.reference : state.baseline.reference :
    item.providerReferences.length===1 ? item.providerReferences[0] : null;
  return editorialRows(savedMediaPresentation(item).metadata, {...item,year:item.year??null,posterUrl:item.posterUrl??null,
    overview:item.overview??null,genres:item.genres??[]}, historicalRef ? `${mediaSourceName(historicalRef.provider)} · snapshot histórico` : "Datos locales/históricos");
}
