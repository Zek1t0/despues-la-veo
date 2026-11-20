import { admittedImageUrl } from "../../core/mediaImagePresentation";
import { imagePolicy } from "./imageRuntime";
import React from "react";
import { Image, Platform, type StyleProp, type ViewStyle, type ImageStyle } from "react-native";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { usePosterImageError } from "./usePosterImageError";

export function DetailPoster({ identity, posterUrl, style, imageProvider = "tmdb", resizeMode = "cover", cacheOnly = false }: {
  identity: string;
  imageProvider?: string | null;
  resizeMode?: "cover" | "contain";
  posterUrl?: string | null;
  cacheOnly?: boolean;
  style: StyleProp<ViewStyle & ImageStyle>;
}) {
  posterUrl = cacheOnly && Platform.OS === "web" ? null : admittedImageUrl(posterUrl, imagePolicy(imageProvider));
  const { imageFailed, onImageError } = usePosterImageError(identity, posterUrl);
  return posterUrl && !imageFailed
    ? <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no" aria-hidden
        source={cacheOnly ? { uri: posterUrl, cache: "only-if-cached" } : { uri: posterUrl }} resizeMode={resizeMode} style={style} onError={onImageError}
        onLoad={event => {
          // Post-load diagnostic only: source.uri is not a guaranteed final network URL.
          const reported = event.nativeEvent.source?.uri;
          if (reported && !admittedImageUrl(reported, imagePolicy(imageProvider))) onImageError();
        }} />
    : <PosterPlaceholder style={style} />;
}
