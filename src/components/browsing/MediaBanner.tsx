import React from "react";
import { MediaPoster, type MediaPosterProps } from "./MediaPoster";
/** The same received-variant policy and error lifecycle as posters. */
export function MediaBanner(props: Omit<MediaPosterProps, "context" | "posterUrl">) {
  const images = props.metadata?.provenance.reference.provider === props.imageProvider
    ? props.metadata.fields.bannerImages : undefined;
  // Absence needs no frame; supplied variants retain MediaPoster's validation and failure fallback.
  if (!images?.length) return null;
  return <MediaPoster {...props} context="banner" />;
}
