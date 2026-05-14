const baseConfig = require("./app.json");

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";

module.exports = {
  expo: {
    ...baseConfig.expo,
    android: {
      ...baseConfig.expo.android,
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...baseConfig.expo.ios,
      config: {
        googleMapsApiKey: googleMapsApiKey,
      },
    },
  },
};
