export type TmdbMediaType = "movie" | "tv";

export type TmdbSearchItem = {
  id: number;
  media_type: TmdbMediaType;

  title?: string; // movie
  name?: string; // tv
  release_date?: string; // movie
  first_air_date?: string; // tv

  overview?: string;
  poster_path?: string | null;
};

export type TmdbCastMember = {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
};

export type TmdbCrewMember = {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path?: string | null;
};

export type TmdbCreditsResponse = {
  id: number;
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
};
export type TmdbWatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
};

export type TmdbWatchProvidersCountry = {
  link?: string;
  flatrate?: TmdbWatchProvider[]; // streaming/subscripción
  rent?: TmdbWatchProvider[];     // alquiler
  buy?: TmdbWatchProvider[];      // compra
};

export type TmdbWatchProvidersResponse = {
  id: number;
  results: Record<string, TmdbWatchProvidersCountry>;
};