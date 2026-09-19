module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [
    ["@babel/plugin-transform-export-namespace-from"],
    [
      "module-resolver",
      {
        root: ["."],
        alias: {
          "@components": "./src/components",
          "@config": "./src/config",
          "@design-system": "./src/design-system",
          "@features": "./src/features",
          "@hooks": "./src/hooks",
          "@lib": "./src/lib",
          "@navigation": "./src/navigation",
          // Not `@types`: TypeScript reserves that prefix for DefinitelyTyped
          // declaration packages. Keep this in step with tsconfig paths.
          "@protocol": "./src/types/protocol",
          "@realtime": "./src/realtime",
          "@store": "./src/store",
          "@utils": "./src/utils",
        },
      },
    ],
    // Must be last. Reanimated 4 delegates its worklet transform to
    // react-native-worklets, so this is the plugin to list rather than
    // `react-native-reanimated/plugin` as in Reanimated 3.
    ["react-native-worklets/plugin"],
  ],
};
