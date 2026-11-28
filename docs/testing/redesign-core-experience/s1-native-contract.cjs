const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");

const native = {
  Platform: { OS: "android" },
  View: "View",
  ScrollView: "ScrollView",
  Modal: "Modal",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Pressable: "Pressable",
  StyleSheet: { absoluteFillObject: {} },
  findNodeHandle: control => control.tag,
  AccessibilityInfo: { setAccessibilityFocus: tag => accessibilityFocus.push(tag) },
};
const accessibilityFocus = [];
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
let theme;
let focused = false;
let renderBootstrap = false;
const load = Module._load;
const jsx = (type, props) => ({ type, props });

require.extensions[".ts"] = require.extensions[".tsx"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
Module._load = function (name, ...args) {
  if (name === "react" && !renderBootstrap) return {
    useRef: initial => ({ current: initial === false ? false : { tag: 1, focus() {} } }),
    useState: initial => [initial === false && focused, () => {}],
    useEffect: () => {},
  };
  if (name === "react/jsx-runtime" && !renderBootstrap) return { jsx, jsxs: jsx };
  if (name === "react-native") return renderBootstrap ? {
    useColorScheme: () => "light",
    View: ({ style }) => React.createElement("div", { "data-background": style.backgroundColor }),
  } : native;
  if (name === "@expo/vector-icons") return { Ionicons: "Icon" };
  if (name === "expo-router") return { Stack: () => { throw Error("El stack se montó antes de hidratar"); } };
  if (name === "@react-navigation/native") return {};
  if (name === "expo-status-bar") return { StatusBar: () => null };
  if (name === "react-native-safe-area-context") return {
    SafeAreaView: "SafeAreaView",
    useSafeAreaInsets: () => ({ top: 25, bottom: 34, left: 7, right: 9 }),
  };
  if (!renderBootstrap && name.endsWith("AppThemeProvider")) return { useAppTheme: () => ({ theme }) };
  if (name.endsWith("appearancePreferencesRepo")) return {
    getAppearancePreference: () => { throw Error("El render de bootstrap accedió a preferencias"); },
    setAppearancePreference: () => { throw Error("El render de bootstrap escribió preferencias"); },
  };
  if (name.endsWith("TmdbCredentialProvider")) return {
    TmdbCredentialProvider: () => { throw Error("Credenciales montadas antes de hidratar"); },
  };
  return load.call(this, name, ...args);
};

global.requestAnimationFrame = fn => fn();
const { Screen } = require("../../../src/components/Screen.tsx");
const { ActionPanel, ConfirmAction } = require("../../../src/components/ActionPanel.tsx");
const { OrganizationButton, OrganizationInput, OrganizationOption } = require("../../../src/components/organization/OrganizationUI.tsx");
const { resolveTheme, contrastRatio } = require("../../../src/theme/resolver.ts");
const { APPEARANCE_PALETTE_IDS } = require("../../../src/theme/types.ts");
theme = resolveTheme("dark", "original");
const ownInsets = Screen({ topOwner: "screen" });
const [header, scroll, footer] = ownInsets.props.children;
assert.equal(header, undefined);
assert.equal(footer, undefined);
assert.equal(ownInsets.props.style.paddingTop, 25);
assert.equal(ownInsets.props.style.paddingLeft, 7);
assert.equal(ownInsets.props.style.paddingRight, 9);
assert.equal(scroll.props.contentContainerStyle[0].paddingBottom, 58);
assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");

const [ , withFixedFooter, fixedFooter ] = Screen({ footer: "Acciones" }).props.children;
assert.equal(withFixedFooter.props.contentContainerStyle[0].paddingBottom, 24);
assert.equal(fixedFooter.props.style.paddingBottom, 34);
const withTabs = Screen({ bottomOwner: "tabs" });
assert.equal(withTabs.props.style.paddingTop, 0);
assert.equal(withTabs.props.children[1].props.contentContainerStyle[0].paddingBottom, 24);

let closeCount = 0;
const dialog = ActionPanel({
  title: "Confirmar",
  visible: true,
  onClose: () => { closeCount++; },
  triggerRef: { current: { tag: 2, focus() {} } },
});
assert.equal(dialog.type, "Modal");
assert.equal(dialog.props.children.props.children[1].type, "SafeAreaView");
dialog.props.onShow();
dialog.props.onRequestClose();
assert.equal(closeCount, 1);
assert.deepEqual(accessibilityFocus, [1, 2]);
console.log("PASS contrato simulado Android S1: insets, ownership, scroll, Atrás y foco sin DOM.");

function meets(foreground, background, minimum, detail) {
  const ratio = contrastRatio(foreground, background);
  assert.ok(ratio >= minimum, `${theme.effectiveScheme}/${theme.paletteId} ${detail}: ${ratio.toFixed(3)}`);
}

for (const scheme of ["dark", "light"]) {
  for (const palette of APPEARANCE_PALETTE_IDS) {
    theme = resolveTheme(scheme, palette);
    const { global: g, semantic: s } = theme;
    const hosts = [g.background, g.surface, g.surfaceSecondary];
    for (const isFocused of [false, true]) {
      focused = isFocused;
      for (const [variant, selected] of [["primary"], ["secondary"], ["quiet"], ["link"], ["danger"], ["secondary", true]]) {
        const button = OrganizationButton({ label: "Ejemplo", variant, selected, onPress() {} });
        const style = button.props.style({ pressed: false });
        const color = button.props.children.at(-1).props.style[1].color;
        assert.ok(style.minHeight >= 48);
        for (const host of hosts) {
          const fill = style.backgroundColor === "transparent" ? host : style.backgroundColor;
          meets(color, fill, 4.5, `texto ${variant}`);
          if (style.borderColor !== "transparent") meets(style.borderColor, fill, 3, `borde ${variant}`);
          if (!isFocused && variant === "secondary" && !selected) meets(style.borderColor, host, 3, "límite exterior del botón");
        }
      }
      for (const selected of [false, true]) {
        const option = OrganizationOption({ label: "Ejemplo de etiqueta larga", selected, onPress() {} });
        const style = option.props.style({ pressed: false });
        assert.equal(style.alignSelf, "stretch");
        assert.equal(option.props.children.at(-1)?.props?.name === "checkmark", selected);
        assert.equal(option.props.accessibilityState.selected, selected);
        meets(option.props.children[1].props.style[1].color, style.backgroundColor, 4.5, "texto de opción");
        if (isFocused) meets(style.borderColor, style.backgroundColor, 3, "foco de opción");
      }
      for (const error of [undefined, "Campo requerido"]) {
        const field = OrganizationInput({ label: "Ejemplo", error }).props.children[1].props;
        const style = field.style[0];
        meets(style.color, style.backgroundColor, 4.5, "texto de campo");
        meets(field.placeholderTextColor, style.backgroundColor, 4.5, "placeholder");
        meets(style.borderColor, style.backgroundColor, 3, "límite interior de campo");
        for (const host of hosts) meets(style.borderColor, host, 3, "límite exterior de campo");
      }
    }
    for (const host of hosts) {
      meets(g.textSecondary, host, 4.5, "texto de lectura");
      meets(s.dangerText, host, 4.5, "texto de error");
    }
  }
}
console.log("PASS contraste de estilos renderizados por componentes compartidos en las 14 combinaciones.");

async function verifyConfirmation() {
  let calls = 0;
  let closed = 0;
  let finish;
  const confirm = ConfirmAction({
    visible: true, title: "Confirmar", message: "Ejemplo", confirmLabel: "Aceptar",
    triggerRef: { current: null },
    onClose: () => { closed++; },
    onConfirm: () => {
      calls++;
      return new Promise(resolve => { finish = resolve; });
    },
  });
  const press = confirm.props.children.at(-1).props.onPress;
  press();
  press();
  assert.equal(calls, 1);
  assert.equal(closed, 0);
  assert.equal(confirm.props.canClose(), false);
  finish();
  await Promise.resolve();
  assert.equal(closed, 1);
  console.log("PASS confirmación: dos pulsaciones en el mismo ciclo ejecutan una sola operación.");
}

verifyConfirmation().then(() => {
  renderBootstrap = true;
  const ProductionRootLayout = require("../../../src/components/ProductionRootLayout.tsx").default;
  const markup = renderToStaticMarkup(React.createElement(ProductionRootLayout));
  assert.match(markup, /data-background="#14151b"/);
  console.log("PASS montaje del fallback: contexto real, default oscuro y stack sin montar.");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
