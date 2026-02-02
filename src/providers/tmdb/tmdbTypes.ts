export type TmdbMediaType = "movie" | "tv";

export type TmdbSearchItem = {
  id: number;
  media_type: TmdbMediaType;

  title?: string;        // movie
  name?: string;         // tv
  release_date?: string; // movie
  first_air_date?: string; // tv

  overview?: string;
  poster_path?: string | null;
};
