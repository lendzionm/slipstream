// Extends app.json. When the website is built for GitHub Pages, it lives at
// https://lendzionm.github.io/slipstream/, so every link and file needs the
// "/slipstream" prefix. The deploy workflow sets EXPO_BASE_URL for that;
// on your computer it's empty, so localhost:8081 works as before.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_BASE_URL || "",
  },
});
