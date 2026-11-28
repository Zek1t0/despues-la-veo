const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");

const load = Module._load;
const tsLoader = require.extensions[".ts"];
const platform = { OS: "android" };
let appState;
let cleanup;
let sample;
let nextTimer = 0;
let nativeSubscriptions = 0;
const timers = new Map();
const RealDate = global.Date;
let now = new RealDate(2026, 10, 27, 12).valueOf();
const originalGlobals = Object.fromEntries(
  ["window", "document", "Date", "setTimeout", "clearTimeout"].map(name => [name, Object.getOwnPropertyDescriptor(global, name)])
);

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
Module._load = function(name, ...args) {
  if (name === "react") return {
    useState: initial => [sample = initial(), update => { sample = update(sample); }],
    useEffect: effect => { cleanup = effect(); },
  };
  if (name === "react-native") return {
    Platform: platform,
    AppState: { addEventListener(event, listener) {
      assert.equal(event, "change");
      assert.equal(appState, undefined);
      appState = listener;
      nativeSubscriptions++;
      return { remove() { assert.equal(appState, listener); appState = undefined; } };
    } },
  };
  return load.call(this, name, ...args);
};

function eventTarget() {
  const events = new Map();
  return {
    events,
    addEventListener(name, listener) {
      assert.equal(events.has(name), false);
      events.set(name, listener);
    },
    removeEventListener(name, listener) {
      assert.equal(events.get(name), listener);
      events.delete(name);
    },
  };
}

try {
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
  };
  global.setTimeout = (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; };
  global.clearTimeout = id => timers.delete(id);
  global.window = {};
  delete global.document;
  const { useGranularDay } = require("../../../src/components/granular/useGranularDay.ts");
  const { GUIDE_VALIDITY_MS } = require("../../../src/core/granularCoverage.ts");
  const index = now - GUIDE_VALIDITY_MS + 10;
  const snapshot = now - 100;
  assert.equal(useGranularDay(index, snapshot).current, true);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 10);
  now += 10;
  appState("background");
  assert.equal(sample.current, true);
  appState("active");
  assert.equal(sample.current, false);
  const priorDay = sample.day;
  now += 24 * 60 * 60 * 1000;
  appState("active");
  assert.notEqual(sample.day, priorDay);
  assert.equal(timers.size, 1);
  cleanup();
  assert.equal(timers.size, 0);
  assert.equal(appState, undefined);

  platform.OS = "web";
  const browser = eventTarget();
  const dom = eventTarget();
  global.window = browser;
  global.document = dom;
  const today = useGranularDay().day;
  assert.deepEqual([...browser.events.keys()], ["focus"]);
  assert.deepEqual([...dom.events.keys()], ["visibilitychange"]);
  now += 24 * 60 * 60 * 1000;
  browser.events.get("focus")();
  assert.notEqual(sample.day, today);
  const afterFocus = sample.day;
  now += 24 * 60 * 60 * 1000;
  dom.events.get("visibilitychange")();
  assert.notEqual(sample.day, afterFocus);
  cleanup();
  assert.equal(browser.events.size + dom.events.size + timers.size, 0);

  global.window = { addEventListener() { assert.fail("Un listener sin cleanup no debe instalarse"); } };
  delete global.document;
  useGranularDay();
  cleanup();
  assert.equal(timers.size, 0);
  assert.equal(nativeSubscriptions, 1);
  console.log("PASS granular runtime: Android sin DOM, AppState, vencimiento, cambio de día y listeners Web simétricos.");
} finally {
  Module._load = load;
  if (tsLoader) require.extensions[".ts"] = tsLoader;
  else delete require.extensions[".ts"];
  for (const [name, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor) Object.defineProperty(global, name, descriptor);
    else delete global[name];
  }
}
