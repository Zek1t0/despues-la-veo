import { TmdbCredentialService } from "./TmdbCredentialService";
import { tmdbCredentialStore } from "./tmdbCredentialStore";
import { createTmdbCredentialValidator } from "./tmdbCredentialValidator";

export const tmdbCredentialService = new TmdbCredentialService(
  tmdbCredentialStore,
  createTmdbCredentialValidator(),
);
