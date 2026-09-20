export function posterUrl(posterPath?: string | null, size: "w185" | "w342" = "w342") {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}
