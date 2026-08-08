import {
  LIBRARY_PIN_CONTEXT,
  createTagPinContext,
  normalizeSavedTitleTags,
  type PinContext,
} from "./contextualPin";
import type { SavedTitle } from "./savedTitle";

export type TitleDetailPinParams = {
  pinContext?: unknown;
  tag?: unknown;
};

export function parseTitleDetailPinContextCandidate({
  pinContext,
  tag,
}: TitleDetailPinParams): PinContext {
  if (pinContext === "library") return LIBRARY_PIN_CONTEXT;
  if (pinContext !== "tag" || typeof tag !== "string") return LIBRARY_PIN_CONTEXT;

  try {
    return createTagPinContext(tag);
  } catch {
    return LIBRARY_PIN_CONTEXT;
  }
}

export function resolveTitleDetailPinContext(
  params: TitleDetailPinParams,
  item: SavedTitle
): PinContext {
  const candidate = parseTitleDetailPinContextCandidate(params);
  if (candidate.contextType === "library") return candidate;

  return normalizeSavedTitleTags(item.tags ?? []).includes(candidate.contextKey)
    ? candidate
    : LIBRARY_PIN_CONTEXT;
}

export function titleDetailPinContextKey(savedTitleId: string, context: PinContext): string {
  return `${savedTitleId}\u0000${context.contextType}\u0000${context.contextKey}`;
}

export function titleDetailPinContextLabel(context: PinContext): string {
  return context.contextType === "library" ? "Biblioteca" : context.contextKey;
}
