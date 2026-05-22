const baseConfig = require("./app.json");

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
const projectId = "0161a6fb-b916-49b4-a3ca-ac504926c032";

module.exports = {
  expo: {
    ...baseConfig.expo,

    extra: {
      ...(baseConfig.expo.extra ?? {}),
      eas: {
        ...(baseConfig.expo.extra?.eas ?? {}),
        projectId,
      },
    },

    android: {
      ...baseConfig.expo.android,
      config: {
        ...(baseConfig.expo.android?.config ?? {}),
        googleMaps: {
          ...(baseConfig.expo.android?.config?.googleMaps ?? {}),
          apiKey: googleMapsApiKey,
        },
      },
    },

    ios: {
      ...baseConfig.expo.ios,
      config: {
        ...(baseConfig.expo.ios?.config ?? {}),
        googleMapsApiKey: googleMapsApiKey,
      },
    },
  },
};