import { metadataImageUrl } from "../../core/metadataImageUrl";
import { TMDB_IMAGE_HOSTS } from "../../core/mediaImagePresentation";
export function posterUrl(posterPath?: string | null, size: "w185" | "w342" = "w342") {
  if (!posterPath) return null;
  return metadataImageUrl(`https://image.tmdb.org/t/p/${size}${posterPath}`, TMDB_IMAGE_HOSTS);
}
