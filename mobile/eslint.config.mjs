import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jestPlugin from "eslint-plugin-jest";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactNative from "eslint-plugin-react-native";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "babel.config.js",
      "jest.config.js",
      "metro.config.js",
      "eslint.config.mjs",
      "react-native.config.js",
      "jest.setup.js",
      ".prettierrc.js",
      "scripts/",
      "android/",
      "ios/",
      "vendor/",
      "coverage/",
      // Generated from backend/src/types/protocol.ts by `npm run sync:protocol`.
      "src/types/protocol.ts",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2021,
        ...reactNative.environments["react-native"].globals,
      },
      parserOptions: {
        project: "./tsconfig.json",
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
  },

  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],

  importPlugin.flatConfigs.errors,
  importPlugin.flatConfigs.warnings,
  importPlugin.flatConfigs.typescript,

  jestPlugin.configs["flat/recommended"],

  // Must stay near-last so it can switch off the formatting rules above.
  prettier,

  {
    plugins: {
      "react-hooks": reactHooks,
      "react-native": reactNative,
      "unused-imports": unusedImports,
      "@eslint-community/eslint-comments": eslintComments,
    },
    rules: {
      "no-console": "error",
      "no-unused-vars": "off",
      eqeqeq: ["error", "allow-null"],
      "no-eval": "error",
      "no-new-func": "error",
      "no-return-assign": "warn",
      radix: "warn",

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-shadow": "warn",
      "no-shadow": "off",
      "@typescript-eslint/dot-notation": "warn",
      "dot-notation": "off",

      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Inline styles and colour literals allocate a new object per render and
      // put colour decisions outside the token layer. Both matter more than
      // usual here, where rows re-render at 10 Hz.
      "react-native/no-inline-styles": "error",
      "react-native/no-color-literals": "error",
      "react-native/no-raw-text": ["error", { skip: ["Text"] }],

      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          pathGroups: [
            { pattern: "react", group: "external", position: "before" },
            { pattern: "react-native", group: "external", position: "before" },
            {
              pattern:
                "@{config,navigation,design-system,features,components,protocol,store,realtime,utils,lib}/**",
              group: "internal",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/newline-after-import": "error",
      "import/namespace": "off",
      "import/no-named-as-default-member": "off",
      "import/no-named-as-default": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[importKind='type']",
          message: "Use standard imports instead of import type per project conventions.",
        },
      ],

      "@eslint-community/eslint-comments/no-unlimited-disable": "warn",
      "@eslint-community/eslint-comments/no-unused-disable": "warn",

      "unused-imports/no-unused-imports": "error",
    },
  },

  {
    files: ["src/utils/logger.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["src/navigation/types.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}"],
    rules: {
      // Test doubles stand in for sockets and native modules, which needs a
      // widening cast at the boundary.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
);
