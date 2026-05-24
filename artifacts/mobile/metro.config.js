const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /react-native-maps_tmp_.*/,
  /react-native-maps[\\/].*[\\/]android[\\/]gradle[\\/].*/,
];

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@rnmapbox/maps" && platform === "web") {
    return { filePath: path.resolve(__dirname, "mocks/rnmapbox-stub.js"), type: "sourceFile" };
  }
  // react-native-maps uses native-only internals that crash the web bundler.
  // osm-map.web.tsx already shows a friendly fallback on web, so we stub out
  // the entire package to keep the web build clean.
  if (moduleName === "react-native-maps" && platform === "web") {
    return { filePath: path.resolve(__dirname, "mocks/react-native-maps-stub.js"), type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
