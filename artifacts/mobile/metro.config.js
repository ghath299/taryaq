const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /react-native-maps_tmp_.*/,
  /react-native-maps[\\/].*[\\/]android[\\/]gradle[\\/].*/,
];

module.exports = config;
