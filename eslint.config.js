import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "backend/node_modules/**"],
  },
  {
    files: [
      "src/**/*.{js,jsx}",
      "backend/src/**/*.js",
      "backend/test/**/*.js",
      "test/**/*.js",
      "*.js",
    ],
    ...js.configs.recommended,
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "react/jsx-uses-vars": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];
