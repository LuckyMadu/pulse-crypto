/**
 * Font linking.
 *
 * `npm run fonts` copies everything in `assets/fonts` into the native projects.
 * The filenames are chosen to equal each font's PostScript name, because the
 * two platforms resolve `fontFamily` differently: Android matches the asset
 * filename, iOS matches the PostScript name recorded inside the file. Keeping
 * them identical means `src/design-system/tokens/typography.ts` names one
 * string per face instead of a `Platform.select` per face.
 */

module.exports = {
  project: {
    android: {},
    ios: {},
  },
  assets: ["./assets/fonts"],
};
