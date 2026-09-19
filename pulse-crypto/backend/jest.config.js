/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  clearMocks: true,
  // Tests that assert on real timers must not race the suite timeout, and the
  // backpressure test deliberately drives 50+ ticks.
  testTimeout: 15000,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: { module: "CommonJS", types: ["node", "jest"] } }],
  },
};
