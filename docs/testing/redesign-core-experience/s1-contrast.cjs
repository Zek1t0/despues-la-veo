const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  module._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};

const { execFileSync } = require("node:child_process");
const { APPEARANCE_PALETTE_IDS } = require("../../../src/theme/types.ts");
const { resolveTheme, contrastRatio, assertLightThemeInvariant, resolveAppearanceTheme } = require("../../../src/theme/resolver.ts");
const { DEFAULT_APPEARANCE_PREFERENCE, parseAppearancePayload } = require("../../../src/theme/appearancePreference.ts");
const { DarkBase, LightBase } = require("../../../src/theme/bases.ts");
const { APPEARANCE_PALETTES } = require("../../../src/theme/palettes.ts");

// Check the inherited colors against the published PROPOSE checkpoint.
const baseline = { exports: {} };
const source = execFileSync("git", ["show", "087f8ab:src/theme/palettes.ts"], { encoding: "utf8" });
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function("require", "exports", output)((name) => require("../../../src/theme/" + name + ".ts"), baseline.exports);

assert.equal(APPEARANCE_PALETTES.original.displayName, "Original");
assert.deepEqual(DEFAULT_APPEARANCE_PREFERENCE, { version: 1, scheme: "dark", palette: "original" });
const restored = parseAppearancePayload({ version: 1, scheme: "light", palette: "original" });
assert.equal(resolveAppearanceTheme(restored.preference, "dark").global.background, "#f4f3f8");
assert.equal(resolveAppearanceTheme({ ...restored.preference, scheme: "system" }, "dark").global.background, "#14151b");

const rows = [];
for (const scheme of ["dark", "light"]) {
  for (const id of APPEARANCE_PALETTE_IDS) {
    const { global: g, semantic: s } = resolveTheme(scheme, id);
    if (scheme === "light") assertLightThemeInvariant(g);
    if (id !== "original") {
      assert.deepEqual(g, { ...(scheme === "dark" ? DarkBase : LightBase), ...baseline.exports.APPEARANCE_PALETTES[id].overrides[scheme] });
    }
    const surfaces = [g.background, g.surface, g.surfaceSecondary, g.inputBackground];
    const min = (fg, backgrounds = surfaces) => Math.min(...backgrounds.map(bg => contrastRatio(fg, bg)));
    const ratios = {
      text: min(g.textPrimary), secondary: min(g.textSecondary), muted: min(g.textMuted),
      primary: min(g.onAccent, [g.accent]), selection: min(g.selectedForeground, [g.selectedSurface]),
      boundary: min(g.borderStrong), field: min(g.borderStrong, [g.surface, g.inputBackground]),
      focus: min(g.accent, [...surfaces, g.selectedSurface]),
      danger: min(s.onDangerSurface, [s.dangerSurface]), error: min(s.dangerText),
      disabled: min(s.disabledText, [s.disabledSurface]),
      ratings: Math.min(...["Low", "Medium", "High"].map(level =>
        contrastRatio(s[`personalRating${level}Foreground`], s[`personalRating${level}Background`]))),
    };
    if (id === "original") {
      for (const key of ["text", "secondary", "muted", "primary", "selection", "danger", "error", "ratings"]) {
        assert.ok(ratios[key] >= 4.5, `${scheme} ${key}: ${ratios[key]}`);
      }
      for (const key of ["boundary", "field", "focus"]) assert.ok(ratios[key] >= 3, `${scheme} ${key}: ${ratios[key]}`);
    }
    rows.push({ scheme, id, ...Object.fromEntries(Object.entries(ratios).map(([key, value]) => [key, value.toFixed(2)])) });
  }
}
console.table(rows);
