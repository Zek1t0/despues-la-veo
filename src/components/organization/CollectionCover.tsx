import React, { useState } from "react";
import { radius } from "../../theme/presentation";
import { Image } from "react-native";
import type { SavedTitleWithProviderReferences } from "../../core/savedTitle";
import { savedMediaPresentation } from "../../core/mediaPresentation";
import { admittedImageUrl, selectImageVariant } from "../../core/mediaImagePresentation";
import { imagePolicy } from "../browsing/imageRuntime";
import { PosterPlaceholder } from "../browsing/PosterPlaceholder";
/** Receives visible members only, in incorporation order. Never resolves remote metadata. */
export function CollectionCover({ members, width = 72 }: { members: SavedTitleWithProviderReferences[]; width?: number }) {
  const [failed,setFailed] = useState<ReadonlySet<string>>(new Set());
  const style = { width, height: width * 1.5, flexShrink: 0, borderRadius: radius.control };
  const candidates = members.flatMap(item => {
    const view = savedMediaPresentation(item), policy = imagePolicy(view.imageProvider), fields = view.metadata?.fields;
    const supplied = fields && Object.prototype.hasOwnProperty.call(fields,"posterImages");
    const url = selectImageVariant(fields?.posterImages,policy,"list",width) ??
      (!supplied || !!fields?.posterImages?.length && view.imageProvider === "tmdb" ? admittedImageUrl(item.posterUrl,policy) : null);
    return url ? [{ item, url, provider: view.imageProvider }] : [];
  });
  const candidate = candidates.find(v => !failed.has(v.url));
  if (!candidate) return <PosterPlaceholder style={style} />;
  const fail = () => setFailed(old => new Set([...old,candidate.url]));
  return <Image accessible={false} source={{ uri: candidate.url }} style={style} resizeMode="cover" onError={fail} onLoad={event => {
    const uri = event.nativeEvent.source?.uri;
    if (uri && !admittedImageUrl(uri,imagePolicy(candidate.provider))) fail();
  }} />;
}
