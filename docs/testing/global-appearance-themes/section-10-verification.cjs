const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const settings = read("app/(tabs)/ajustes.tsx");
const credential = read("app/settings/tmdb.tsx");
const about = read("app/settings/about.tsx");
const runtime = read("src/providers/tmdb/credential/tmdbCredentialRuntime.ts");
const nativeStore = read("src/providers/tmdb/credential/tmdbCredentialStore.native.ts");
const webStore = read("src/providers/tmdb/credential/tmdbCredentialStore.web.ts");
const credentialKey = read("src/providers/tmdb/credential/tmdbCredentialKey.ts");

for (const source of [settings, credential, about]) {
  assert.match(source, /useAppTheme\(\)/);
  assert.match(source, /theme\.global\.background/);
  assert.doesNotMatch(source, /theme\/colors|\bcolors\./);
  assert.doesNotMatch(source, /paletteId|preference\.palette/);
}

for (const route of ["/settings/appearance", "TMDB_SETTINGS_ROUTE", "/settings/about"]) {
  assert.ok(settings.includes(route), `Settings navigation missing ${route}`);
}
for (const label of ["Exportar biblioteca", "Importar biblioteca"]) {
  assert.ok(settings.includes(label), `Backup action missing ${label}`);
}
assert.match(settings, /theme\.semantic\.disabledSurface/);

assert.match(credential, /placeholderTextColor=\{theme\.global\.textMuted\}/);
assert.match(credential, /secureTextEntry=\{hidden\}/);
assert.match(credential, /setHidden\(\(value\) => !value\)/);
assert.match(credential, /theme\.semantic\.disabledSurface/);
assert.match(credential, /theme\.semantic\.dangerText/);
assert.match(credential, /theme\.semantic\.dangerSurface/);
assert.match(credential, /theme\.semantic\.onDangerSurface/);
for (const needle of ["tmdbCredentialService.save", "tmdbCredentialService.delete", "retryInitialization", "TMDB_TOKEN_URL"]) {
  assert.ok(credential.includes(needle), `Credential lifecycle missing ${needle}`);
}
assert.match(nativeStore, /expo-secure-store/);
assert.match(webStore, /localStorage/);
assert.match(runtime, /TmdbCredentialService/);
assert.match(credentialKey, /despues-la-veo\.tmdb\.api-read-access-token/);

const tmdbNotice = "This product uses the TMDB API but is not endorsed or certified by TMDB.";
const justWatch = "Los datos de disponibilidad en streaming, alquiler y compra son provistos por JustWatch a través de TMDB.";
assert.ok(about.includes(tmdbNotice));
assert.ok(about.includes(justWatch));
assert.match(about, /tmdb-primary-full-blue\.png/);
assert.doesNotMatch(about, /tintColor|filter\s*:|recolor|palette transform/i);
assert.match(about, /https:\/\/www\.themoviedb\.org/);
assert.match(about, /https:\/\/www\.justwatch\.com\//);

console.log("Section 10 Settings navigation, credential lifecycle/theme states and exact TMDB/JustWatch branding verification passed.");
