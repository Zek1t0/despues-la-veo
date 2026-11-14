import React, { useState } from "react";
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle, type ImageStyle } from "react-native";
import type { EnrichedMediaMetadata } from "../../core/enrichedMediaMetadata";
import { admittedImageUrl, selectImageVariant, type ImageContext, type ImageDestinationEvidence } from "../../core/mediaImagePresentation";
import { imagePolicy } from "./imageRuntime";
import { DetailPoster } from "./DetailPoster";

export type MediaPosterProps = {
  /** Trusted adapter evidence only; never read from backup fields. */
  destinationEvidence?: Readonly<Record<string, ImageDestinationEvidence>>;
  identity: string; imageProvider: string | null; metadata?: EnrichedMediaMetadata;
  posterUrl?: string | null; context?: ImageContext; style: StyleProp<ViewStyle & ImageStyle>;
};
/** Presentation only. Persistence projection and historical TMDB fallback stay intact. */
export function MediaPoster({ identity, imageProvider, metadata, posterUrl, context = "detail", style, destinationEvidence = {} }: MediaPosterProps) {
  const [width, setWidth] = useState<number | undefined>();
  const policy = imagePolicy(imageProvider);
  const fields = metadata?.provenance.reference.provider === imageProvider ? metadata.fields : undefined;
  const key = context === "banner" ? "bannerImages" : "posterImages";
  const supplied = fields && Object.prototype.hasOwnProperty.call(fields, key);
  const selected = width ? selectImageVariant(fields?.[key], policy, context, width, PixelRatio.get(), destinationEvidence) : null;
  // Null/empty clears; unauthorized variants may retain an attributed historical TMDB poster.
  const historical = width && context !== "banner" && (!supplied || !!fields?.[key]?.length && imageProvider === "tmdb")
    ? admittedImageUrl(posterUrl, policy, posterUrl ? destinationEvidence[posterUrl] : undefined) : null;
  return <View style={[style, styles.container]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <DetailPoster identity={`${identity}:${imageProvider}:${metadata?.provenance.reference.resourceNamespace}:${metadata?.provenance.reference.externalId}`} imageProvider={imageProvider} posterUrl={selected ?? historical}
      style={StyleSheet.absoluteFillObject} resizeMode="contain" />
  </View>;
}
const styles = StyleSheet.create({ container: { overflow: "hidden" } });
