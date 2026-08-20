const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const { deriveBrowserChromeTheme } = require("../../../src/theme/browserChromeTheme.ts");
const { resolveTheme } = require("../../../src/theme/resolver.ts");
const { DARK_ORIGINAL_BASELINE } = require("../../../src/theme/darkOriginalBaseline.ts");

function cssVariable(source, name) {
  const match = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(source);
  assert.ok(match, `Missing CSS bootstrap variable ${name}`);
  return match[1].toLowerCase();
}

function testRootProviderAndNavigationTheme() {
  const root = read("app/_layout.tsx");
  const navigation = read("src/theme/navigationTheme.ts");
  assert.match(root, /<AppThemeProvider fallback=\{<ThemeBootstrapFallback \/>\}>/);
  assert.match(root, /function ThemedRootLayout\(\)[\s\S]*useAppTheme\(\)/);
  assert.match(root, /createNavigationTheme\(theme\)/);
  assert.match(root, /<ThemeProvider value=\{navigationTheme\}>/);
  assert.doesNotMatch(root, /const colors\s*=|const navDark\s*=|DarkTheme/);
  assert.match(navigation, /background: theme\.global\.background/);
  assert.match(navigation, /card: theme\.global\.surface/);
  assert.match(navigation, /text: theme\.global\.textPrimary/);
  assert.match(navigation, /border: theme\.global\.border/);
  assert.match(navigation, /primary: theme\.global\.accent/);
  assert.match(navigation, /notification: theme\.semantic\.dangerText/);
}

function testStatusBarTabsAndSystem() {
  const root = read("app/_layout.tsx");
  const tabs = read("app/(tabs)/_layout.tsx");
  const titleDetail = read("app/title/[id].tsx");
  const remoteDetail = read("app/tmdb/[type]/[id].tsx");
  const provider = read("src/theme/AppThemeProvider.tsx");
  assert.match(root, /StatusBar style=\{effectiveScheme === "dark" \? "light" : "dark"\}/);
  assert.match(tabs, /useAppTheme\(\)/);
  for (const token of ["background", "textPrimary", "accent", "textMuted", "border"]) {
    assert.match(tabs, new RegExp(`theme\\.global\\.${token}`));
  }
  assert.doesNotMatch(tabs, /src\/theme\/colors|green-apple|tide|lavender|obsidian/);
  assert.doesNotMatch(titleDetail, /headerStyle:\s*\{\s*backgroundColor:\s*colors\.|headerTintColor:\s*colors\./);
  assert.match(titleDetail, /headerRight:[\s\S]*backgroundColor: theme\.global\.surface[\s\S]*color: theme\.global\.textPrimary/);
  assert.doesNotMatch(remoteDetail, /headerStyle:\s*\{\s*backgroundColor:\s*colors\.|headerTintColor:\s*colors\./);
  assert.match(provider, /const observedScheme = useColorScheme\(\)/);
  assert.match(provider, /resolveAppearanceTheme\(state\.displayed, runtimeSystemScheme\)/);
  const systemSegment = provider.slice(provider.indexOf("const observedScheme"),
    provider.indexOf("const setScheme"));
  assert.doesNotMatch(systemSegment, /setAppearancePreference|coordinator\.select/);
}

function testWebRuntimeAndBootstrap() {
  const sync = read("src/theme/WebThemeSynchronizer.tsx");
  const css = read("global.css");
  assert.match(sync, /deriveBrowserChromeTheme\(theme\)/);
  assert.match(sync, /browserChrome\.scrollbarThumbHover/);
  assert.match(sync, /root\.style\.colorScheme = theme\.effectiveScheme/);
  assert.match(sync, /typeof document === "undefined"/);
  assert.doesNotMatch(sync, /green-apple|midnight-twilight|lavender|obsidian/);
  assert.match(css, /--app-background: #0b0b0b/);
  assert.match(css, /--app-foreground: #f2f2f2/);
  assert.match(css, /--app-scrollbar-track: #0f0f0f/);
  const bootstrapThumb = DARK_ORIGINAL_BASELINE.bootstrap.scrollbarThumb;
  const bootstrapHover = DARK_ORIGINAL_BASELINE.bootstrap.scrollbarThumbHover;
  assert.equal(bootstrapThumb.value, "#2b2b2b");
  assert.equal(bootstrapThumb.finalAccessibleValue, "#5c5c5c");
  assert.equal(bootstrapHover.value, "#3a3a3a");
  assert.equal(bootstrapHover.finalAccessibleValue, "#646464");
  assert.equal(cssVariable(css, "--app-scrollbar-thumb"), bootstrapThumb.finalAccessibleValue);
  assert.equal(cssVariable(css, "--app-scrollbar-thumb-hover"), bootstrapHover.finalAccessibleValue);
  assert.match(css, /background: var\(--app-scrollbar-thumb-hover\)/);
  assert.doesNotMatch(css, /color-mix/);
  assert.match(css, /background: var\(--app-background\)/);
  assert.match(css, /color-scheme: dark/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /green-apple|midnight-twilight|lavender|obsidian/);
  const hydratedChrome = deriveBrowserChromeTheme(resolveTheme("dark", "original"));
  assert.deepEqual(hydratedChrome, {
    background: "#0b0b0b",
    foreground: "#f2f2f2",
    surface: "#101010",
    border: "#242424",
    accent: "#ffffff",
    scrollbarTrack: "#0f0f0f",
    scrollbarThumb: "#5c5c5c",
    scrollbarThumbHover: "#646464",
  });
  assert.equal(cssVariable(css, "--app-scrollbar-thumb"), hydratedChrome.scrollbarThumb);
  assert.equal(cssVariable(css, "--app-scrollbar-thumb-hover"), hydratedChrome.scrollbarThumbHover);
}

function testConfigAndScope() {
  const appConfig = JSON.parse(read("app.json"));
  assert.equal(appConfig.expo.userInterfaceStyle, "automatic");
  const packageJson = JSON.parse(read("package.json"));
  const bundledNativeModules = JSON.parse(read("node_modules/expo/bundledNativeModules.json"));
  assert.equal(packageJson.dependencies["expo-system-ui"], bundledNativeModules["expo-system-ui"]);
  const compatibleSystemUiVersion = bundledNativeModules["expo-system-ui"].replace(/^[~^]/, "");
  assert.equal(
    JSON.parse(read("node_modules/expo-system-ui/package.json")).version,
    compatibleSystemUiVersion,
  );
  assert.equal(fs.existsSync(path.join(repoRoot, "node_modules/expo-system-ui/app.plugin.js")), true);
  assert.match(read("node_modules/@expo/prebuild-config/build/plugins/withDefaultPlugins.js"),
    /expo-system-ui/);
  assert.deepEqual(appConfig.expo.plugins, ["expo-router", "expo-sqlite", "expo-secure-store"]);
  const allowedDependencies = [
    "@expo/metro-runtime", "@expo/vector-icons", "expo", "expo-document-picker",
    "expo-file-system", "expo-router", "expo-secure-store", "expo-sharing", "expo-sqlite",
    "expo-status-bar", "expo-system-ui", "react", "react-dom", "react-native",
    "react-native-safe-area-context", "react-native-screens", "react-native-web",
  ];
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), allowedDependencies.sort());
}

testRootProviderAndNavigationTheme();
testStatusBarTabsAndSystem();
testWebRuntimeAndBootstrap();
testConfigAndScope();
console.log("Section 3 root, navigation, tabs, StatusBar and web synchronization verification passed.");
