import React, { useEffect, useState } from "react";
import { Image, PixelRatio, Platform, StyleSheet, View, type StyleProp, type ViewStyle, type ImageStyle } from "react-native";
import type { EnrichedMediaMetadata } from "../../core/enrichedMediaMetadata";
import { admittedImageUrl, selectImageVariant, type ImageContext, type ImageDestinationEvidence } from "../../core/mediaImagePresentation";
import { imagePolicy } from "./imageRuntime";
import { DetailPoster } from "./DetailPoster";

export type MediaPosterProps = {
  /** Trusted adapter evidence only; never read from backup fields. */
  destinationEvidence?: Readonly<Record<string, ImageDestinationEvidence>>;
  identity: string; imageProvider: string | null; metadata?: EnrichedMediaMetadata;
  cacheOnly?: boolean;
  posterUrl?: string | null; context?: ImageContext; style: StyleProp<ViewStyle & ImageStyle>;
};
/** Presentation only. Persistence projection and historical TMDB fallback stay intact. */
export function MediaPoster({ identity, imageProvider, metadata, posterUrl, context = "detail", style, destinationEvidence = {}, cacheOnly }: MediaPosterProps) {
  const [width, setWidth] = useState<number | undefined>();
  const [cached, setCached] = useState<{ request: string; url: string | null }>();
  const policy = imagePolicy(imageProvider);
  const fields = metadata?.provenance.reference.provider === imageProvider ? metadata.fields : undefined;
  const key = context === "banner" ? "bannerImages" : "posterImages";
  const supplied = fields && Object.prototype.hasOwnProperty.call(fields, key);
  const selected = width ? selectImageVariant(fields?.[key], policy, context, width, PixelRatio.get(), destinationEvidence) : null;
  // Null/empty clears; unauthorized variants may retain an attributed historical TMDB poster.
  const historical = width && context !== "banner" && (!supplied || !!fields?.[key]?.length && imageProvider === "tmdb")
    ? admittedImageUrl(posterUrl, policy, posterUrl ? destinationEvidence[posterUrl] : undefined) : null;
  // A different surface can have loaded a different size of the same admitted poster.
  const cacheRequest = cacheOnly && Platform.OS === "android" && width
    ? JSON.stringify([identity, [...new Set([
      selected, historical, ...(fields?.[key] ?? []).map(image =>
        admittedImageUrl(image.url, policy, destinationEvidence[image.url])),
    ].filter((url): url is string => !!url))]])
    : null;

  useEffect(() => {
    if (!cacheRequest || !Image.queryCache) return;
    const [, urls] = JSON.parse(cacheRequest) as [string, string[]];
    if (!urls.length) return;
    let current = true;
    void Image.queryCache(urls).then(hits => {
      if (current) setCached({ request: cacheRequest, url: urls.find(url => !!hits[url]) ?? null });
    }).catch(() => {
      if (current) setCached({ request: cacheRequest, url: null });
    });
    return () => { current = false; };
  }, [cacheRequest]);

  const imageUrl = cacheRequest
    ? cached?.request === cacheRequest ? cached.url : null
    : selected ?? historical;
  return <View style={[style, styles.container]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <DetailPoster identity={`${identity}:${imageProvider}:${metadata?.provenance.reference.resourceNamespace}:${metadata?.provenance.reference.externalId}`} imageProvider={imageProvider} posterUrl={imageUrl}
      style={StyleSheet.absoluteFillObject} resizeMode="contain" cacheOnly={cacheOnly} />
  </View>;
}
const styles = StyleSheet.create({ container: { overflow: "hidden" } });
