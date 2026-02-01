// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Permite importar assets .wasm (necesario para expo-sqlite en web)
config.resolver.assetExts.push("wasm");

module.exports = config;
