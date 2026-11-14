import { admittedImageUrl } from "../../core/mediaImagePresentation";
import { imagePolicy } from "./imageRuntime";
import React from "react";
import { Image, type StyleProp, type ViewStyle, type ImageStyle } from "react-native";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { usePosterImageError } from "./usePosterImageError";

export function DetailPoster({ identity, posterUrl, style, imageProvider = "tmdb", resizeMode = "cover" }: {
  identity: string;
  imageProvider?: string | null;
  resizeMode?: "cover" | "contain";
  posterUrl?: string | null;
  style: StyleProp<ViewStyle & ImageStyle>;
}) {
  posterUrl = admittedImageUrl(posterUrl, imagePolicy(imageProvider));
  const { imageFailed, onImageError } = usePosterImageError(identity, posterUrl);
  return posterUrl && !imageFailed
    ? <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no" aria-hidden
        source={{ uri: posterUrl }} resizeMode={resizeMode} style={style} onError={onImageError}
        onLoad={event => {
          // Post-load diagnostic only: source.uri is not a guaranteed final network URL.
          const reported = event.nativeEvent.source?.uri;
          if (reported && !admittedImageUrl(reported, imagePolicy(imageProvider))) onImageError();
        }} />
    : <PosterPlaceholder style={style} />;
}
