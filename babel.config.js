module.exports = function (api) {
  api.cache(true);
  return {
    // Expo bundles the preset as a nested dependency; resolve via Expo so Jest works
    // even when babel-preset-expo is not hoisted at the project root.
    presets: [require.resolve('expo/internal/babel-preset')],
  };
};
