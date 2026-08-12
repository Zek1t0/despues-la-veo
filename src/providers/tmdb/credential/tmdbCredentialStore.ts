// Metro selecciona `.native.ts` en Android/iOS y `.web.ts` en web.
// Este fallback conserva resolución TypeScript y plataformas native no especializadas.
export { createNativeTmdbCredentialStore, tmdbCredentialStore } from "./tmdbCredentialStore.native";
