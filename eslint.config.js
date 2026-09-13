import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "backend/node_modules/**"],
  },
  {
    files: ["src/**/*.{js,jsx}", "backend/src/**/*.js", "*.js"],
    ...js.configs.recommended,
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
  },
];
