// Metro bundler settings: Expo's defaults + allow 3D model files (.glb / .gltf) as assets.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("glb", "gltf");

module.exports = config;
