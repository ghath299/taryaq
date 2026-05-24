// Stub for react-native-maps on web.
// The real map screen uses osm-map.web.tsx on web which shows a friendly message.
// This stub prevents the web bundler from crashing on native-only map internals.
const React = require("react");
const { View } = require("react-native");

const noop = () => null;
const EmptyView = () => React.createElement(View, null);

module.exports = {
  __esModule: true,
  default: EmptyView,
  MapView: EmptyView,
  Marker: EmptyView,
  Polyline: EmptyView,
  Polygon: EmptyView,
  Circle: EmptyView,
  Callout: EmptyView,
  CalloutSubview: EmptyView,
  Overlay: EmptyView,
  Heatmap: EmptyView,
  PROVIDER_GOOGLE: "google",
  PROVIDER_DEFAULT: null,
  MAP_TYPES: {},
  AnimatedRegion: class {
    constructor() {}
    timing() { return { start: noop }; }
  },
};
