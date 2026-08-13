const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const about = read("app/settings/about.tsx");
const settings = read("app/(tabs)/ajustes.tsx");
const layout = read("app/_layout.tsx");
const sourceRecord = read("docs/testing/tmdb-user-credential/tmdb-logo-source.md");
const logoPath = path.join(root, "assets/tmdb-primary-full-blue.png");
const exactNotice = "This product uses the TMDB API but is not endorsed or certified by TMDB.";
const justWatchAttribution =
  "Los datos de disponibilidad en streaming, alquiler y compra son provistos por JustWatch a través de TMDB.";
const legacyEnvName = ["EXPO", "PUBLIC", "TMDB", "TOKEN"].join("_");

function testNavigation() {
  assert.match(settings, /label="Acerca de \/ Créditos"/);
  assert.match(settings, /router\.push\("\/settings\/about"\)/);
  assert.match(layout, /<Stack\.Screen name="settings\/about" options=\{\{ title: "Acerca de \/ Créditos" \}\} \/>/);
  assert.doesNotMatch(layout, /name="settings\/about"[^\n]*presentation:\s*"modal"/);
  assert.match(layout, /<Stack\.Screen name="settings\/tmdb"/);
}

function testAttributionAndLink() {
  assert.equal((about.match(new RegExp(exactNotice.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1);
  assert.equal(about.includes(justWatchAttribution), true);
  assert.match(about, /JustWatch/);
  assert.match(about, /const TMDB_URL = "https:\/\/www\.themoviedb\.org";/);
  assert.match(about, /const JUSTWATCH_URL = "https:\/\/www\.justwatch\.com\/";/);
  assert.doesNotMatch(about, /(?:TMDB_URL|JUSTWATCH_URL)[^\n]*(?:token|Authorization|\?)/i);
  assert.doesNotMatch(about, /Linking\.canOpenURL/);
  assert.match(about, /const openExternalLink = async \(url: string, failureMessage: string\)/);
  assert.match(about, /await Linking\.openURL\(url\)/);
  assert.match(about, /openExternalLink\(\s*TMDB_URL,/);
  assert.match(about, /openExternalLink\(\s*JUSTWATCH_URL,/);
  assert.match(about, /catch \{/);
  assert.match(about, /if \(linkOpeningRef\.current\) return;/);
  assert.match(about, /linkOpeningRef\.current = true;/);
  assert.match(about, /finally \{\s*linkOpeningRef\.current = false;/);
  assert.match(about, /mountedRef\.current = true;[\s\S]*?return \(\) => \{\s*mountedRef\.current = false;/);
  assert.match(about, /catch \{\s*if \(mountedRef\.current\) \{\s*setLinkError\(failureMessage\)/);
  assert.match(about, /No pudimos abrir TMDB/);
  assert.match(about, /No pudimos abrir JustWatch\. Intentá nuevamente desde tu navegador\./);
  assert.match(about, /accessibilityLabel="Abrir el sitio oficial de JustWatch"\s*accessibilityRole="link"/);
  assert.equal((about.match(/accessibilityRole="link"/g) || []).length, 2);
  assert.equal((about.match(/minHeight: 44/g) || []).length, 2);
}

function testApprovedLogo() {
  assert.equal(fs.existsSync(logoPath), true);
  const png = fs.readFileSync(logoPath);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 370);
  assert.equal(png.readUInt32BE(20), 267);
  assert.match(about, /require\("\.\.\/\.\.\/assets\/tmdb-primary-full-blue\.png"\)/);
  assert.match(about, /aspectRatio: 185\.04 \/ 133\.4/);
  assert.match(about, /resizeMode="contain"/);
  assert.match(sourceRecord, /Primary full \(blue\)/);
  assert.match(sourceRecord, /https:\/\/www\.themoviedb\.org\/about\/logos-attribution/);
  assert.equal(fs.readdirSync(path.join(root, "assets")).filter((name) => /^tmdb-/i.test(name)).length, 1);
  assert.equal(fs.readdirSync(path.join(root, "assets")).filter((name) => /justwatch/i.test(name)).length, 0);
  assert.doesNotMatch(about, /require\([^\n]*justwatch/i);
}

function testIndependenceAndSecurity() {
  const forbiddenImports = /credential|SecureStore|localStorage|SQLite|libraryBackup|app_preferences|savedTitlesRepo/i;
  assert.doesNotMatch(about, forbiddenImports);
  assert.doesNotMatch(about, /candidate|Authorization|console\.|useTmdbCredential|token/i);
  assert.equal(about.includes(legacyEnvName), false);
  assert.doesNotMatch(about, /privacy|terms|analytics|telemetry|copyright|licen[cs]/i);
}

function testSettingsRegression() {
  assert.match(settings, /router\.push\(TMDB_SETTINGS_ROUTE\)/);
  assert.match(settings, /label="Exportar biblioteca"/);
  assert.match(settings, /label="Importar biblioteca"/);
  assert.match(settings, /label="Acerca de \/ Créditos"[\s\S]*?router\.push\("\/settings\/about"\)/);
  assert.doesNotMatch(settings, /label="Acerca de \/ Créditos"[\s\S]{0,120}disabled=\{busy\}/);
}

testNavigation();
testAttributionAndLink();
testApprovedLogo();
testIndependenceAndSecurity();
testSettingsRegression();

console.log("Section 5 TMDB attribution and credits verification: OK");
console.log("Visual limits: source inspection verifies responsive constraints, aspect-ratio preservation, and accessibility wiring; real Android/iOS/web layout and keyboard behavior remain manual checks.");
