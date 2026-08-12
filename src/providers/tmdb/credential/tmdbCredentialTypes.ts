export interface TmdbCredentialStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  delete(): Promise<void>;
}

export type TmdbCredentialStatus =
  | "initializing"
  | "configured"
  | "not-configured"
  | "storage-error";

export type TmdbCredentialSnapshot = Readonly<{
  status: TmdbCredentialStatus;
  tokenAvailable: boolean;
  generation: number;
}>;

export type TmdbCredentialValidator = (candidate: string) => Promise<void>;

