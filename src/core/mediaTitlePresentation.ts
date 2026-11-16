import type { AlternateMediaTitle, EnrichedMediaMetadata } from "./enrichedMediaMetadata";
import { DEFAULT_MEDIA_PREFERENCES } from "./mediaPreferences";
import { metadataText, METADATA_LIMITS } from "./metadataValidation";
export type ResolvedMediaTitle = Readonly<{ title: string; origin: "preferred" | "canonical" | "variant" | "historical" | "personal"; language: string | null; script: string | null }>;
const valid = (text: unknown): text is string => metadataText(text, METADATA_LIMITS.title) && !/[\r\n\t]/.test(text);
function parts(code: string, script?: string | null) {
  const tokens=code.toLowerCase().split("-");
  return { language:tokens[0], script:script?.toLowerCase() ?? tokens.find(t=>t.length===4) ?? null, code:tokens.join("-") };
}
const compare = (a: AlternateMediaTitle,b: AlternateMediaTitle) => {
  const ka=JSON.stringify([a.language ?? "",a.script ?? "",a.value]),kb=JSON.stringify([b.language ?? "",b.script ?? "",b.value]);
  return ka<kb ? -1 : ka>kb ? 1 : 0;
};
/** Display only. Callers pass exclusively the active document; this never writes metadata/title. */
export function resolveMediaTitle(metadata: EnrichedMediaMetadata | undefined, historical: string,
  languages: readonly string[] = DEFAULT_MEDIA_PREFERENCES.languages, personalOverride?: string): ResolvedMediaTitle {
  if (valid(personalOverride)) return {title:personalOverride,origin:"personal",language:null,script:null};
  const f=metadata?.fields;
  const titles=[...f?.titles ?? [],...f?.abbreviatedTitles ?? []].filter(t=>valid(t.value)).sort(compare);
  for (const wanted of languages) {
    const preference=parts(wanted);
    const matches=titles.filter(t=> {
      if (!t.language) return false;
      const candidate=parts(t.language,t.script);
      return candidate.language===preference.language &&
        (preference.script ? candidate.script===preference.script : !(candidate.language==="ja" && candidate.script==="latn")) &&
        (preference.code===preference.language || preference.script !== null || candidate.code===preference.code);
    });
    const chosen=matches.find(t=>t.language?.toLowerCase()===wanted.toLowerCase()) ?? matches[0];
    if (chosen) return {title:chosen.value,origin:"preferred",language:chosen.language,script:chosen.script};
  }
  if (valid(f?.canonicalTitle)) return {title:f.canonicalTitle,origin:"canonical",language:null,script:null};
  const alternate=titles[0];
  return alternate ? {title:alternate.value,origin:"variant",language:alternate.language,script:alternate.script} :
    {title:historical,origin:"historical",language:null,script:null};
}
export function titleFallbackLabel(value: ResolvedMediaTitle): string | null {
  return value.origin==="canonical" ? "Título canónico: no hay variante en los idiomas preferidos." :
    value.origin==="variant" ? "Otra variante disponible; no coincide con los idiomas preferidos." :
    value.origin==="historical" ? "Título local / histórico." : null;
}
