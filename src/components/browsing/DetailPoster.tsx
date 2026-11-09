import React from "react";
import { Image, type StyleProp, type ViewStyle, type ImageStyle } from "react-native";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { usePosterImageError } from "./usePosterImageError";

export function DetailPoster({ identity, posterUrl, style }: {
  identity: string;
  posterUrl?: string | null;
  style: StyleProp<ViewStyle & ImageStyle>;
}) {
  const { imageFailed, onImageError } = usePosterImageError(identity, posterUrl);
  return posterUrl && !imageFailed
    ? <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no" aria-hidden
        source={{ uri: posterUrl }} resizeMode="cover" style={style} onError={onImageError} />
    : <PosterPlaceholder style={style} />;
}
