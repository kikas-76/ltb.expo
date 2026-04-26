// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "supabase/functions/**"],
  },
  {
    rules: {
      // We rely on JSX runtime escaping; bare apostrophes/quotes in French copy
      // are not an XSS vector and the rule produces ~80 false positives.
      "react/no-unescaped-entities": "off",
    },
  },
]);
