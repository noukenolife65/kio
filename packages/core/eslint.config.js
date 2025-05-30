import globals from "globals";
import pluginJs from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  { ignores: ["dist", "coverage", "docs"] },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
