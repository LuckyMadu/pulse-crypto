import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "coverage/", "node_modules/", "eslint.config.mjs", "jest.config.js", ".prettierrc.js"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `logger` is the only sanctioned sink; see utils/logger.ts.
      "no-console": "error",
      eqeqeq: ["error", "allow-null"],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The bug class that matters most in a long-lived socket process: a
      // rejected promise nobody awaited silently stops a pipeline stage.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-shadow": "warn",
      "no-shadow": "off",
    },
  },

  {
    files: ["src/utils/logger.ts"],
    rules: { "no-console": "off" },
  },

  {
    files: ["**/__tests__/**/*.ts"],
    rules: {
      // Test doubles stand in for `ws` sockets, which needs a widening cast.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
);
