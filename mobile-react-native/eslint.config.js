/* eslint-disable @typescript-eslint/no-var-requires */
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const reactNative = require("eslint-plugin-react-native");
const { FlatCompat } = require("@eslint/eslintrc");
const eslintConfigPrettier = require("eslint-config-prettier");
const prettier = require("eslint-plugin-prettier");

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = tseslint.config(
  {
    ignores: ["node_modules", "dist", "build"],
  },
  // Bring in legacy React Native config via compat
  ...compat.extends("plugin:react-native/all"),
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "react-native": reactNative,
      prettier,
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintConfigPrettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
    rules: {
      "react-native/no-inline-styles": "off",
      "prettier/prettier": "error",
    },
  },
);
