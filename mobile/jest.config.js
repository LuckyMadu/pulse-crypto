/** @type {import('jest').Config} */
module.exports = {
  // `react-native/jest-preset` was split into its own package in RN 0.86.
  preset: "@react-native/jest-preset",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@components$": "<rootDir>/src/components",
    "^@config$": "<rootDir>/src/config",
    "^@design-system$": "<rootDir>/src/design-system",
    "^@features/(.*)$": "<rootDir>/src/features/$1",
    "^@lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@navigation$": "<rootDir>/src/navigation",
    "^@protocol$": "<rootDir>/src/types/protocol",
    "^@realtime$": "<rootDir>/src/realtime",
    "^@store$": "<rootDir>/src/store",
    "^@utils$": "<rootDir>/src/utils",
  },
  // `node_modules` is not transformed by default, but these packages ship
  // untranspiled ESM, so Jest's CommonJS loader chokes on their `export`
  // statements. `immer` is the non-obvious one: it arrives transitively via
  // Redux Toolkit rather than being a direct dependency.
  transformIgnorePatterns: [
    "node_modules/(?!(?:@react-native|react-native|@react-navigation|react-native-reanimated" +
      "|react-native-worklets|react-native-gesture-handler|react-native-mmkv|@shopify/flash-list" +
      "|react-native-svg|@reduxjs/toolkit|redux|reselect|react-redux|immer)/)",
  ],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  clearMocks: true,
};
