# ADR-0005: Bare React Native rather than Expo

**Status:** Accepted
**Requirements:** R16 (persist favourites), R20 (smooth under bursts), plus the brief's Android
emulator requirement

## Context

Expo is the default recommendation for new React Native projects and it is usually the right one:
faster setup, managed native dependencies, and no Xcode or Gradle knowledge required to get running.
On a two-day exercise, setup time is a real cost.

The counter-argument is specific to what this app needs rather than a general preference.

The dependencies here are all native: `react-native-mmkv` (JSI, synchronous), `react-native-svg`,
`react-native-reanimated` with worklets, and three custom font families. In the managed workflow,
MMKV and Reanimated need config plugins or a development build, and font linking is a prebuild step.
The path from "managed" to "actually running this app" ends at `expo prebuild`, which produces the
bare projects anyway - just later, and with an extra layer between the code and the build output
while debugging.

The brief also requires the app to run on an Android emulator, so the native Android project is
being touched regardless. Two of those touches were unavoidable and are documented in the README:
the `10.0.2.2` host alias, and a scoped `network_security_config.xml` for cleartext traffic. Both
are easier to reason about with the manifest in front of you.

## Decision

Bare React Native 0.86 via `@react-native-community/cli`.

Configuration - `babel.config.js`, `tsconfig.json` path aliases, `eslint.config.mjs`,
`.prettierrc.js` - was carried over from an existing production React Native codebase rather than
written fresh. That recovers most of the setup time Expo would have saved, and it is the reason this
repository's conventions look like a team's rather than a weekend's.

## Consequences

**Native configuration is directly visible.** `network_security_config.xml` and the font linking are
plain files in the Android project, which matters because they are exactly the two things most
likely to stop a reviewer from running the app. Explaining a scoped cleartext policy is easier when
you can point at the XML.

**No Expo Go.** A reviewer needs the Android toolchain. The brief already requires an emulator, so
this costs nothing that was not already required, and the README lists the prerequisites and the
two `JAVA_HOME`-shaped traps.

**Upgrades are manual.** Real, and irrelevant at this timescale.

**MMKV's synchronous reads are available**, which is what makes R17 work properly: favourites are
read synchronously and passed as Redux `preloadedState`, so the first painted frame already has
them. An async store would paint the un-favourited state and then correct itself - a visible flash
on every cold start, and precisely the moment a reviewer is watching the recording.

## What would change this

A team without native tooling experience, a need for over-the-air updates, or a project where EAS
Build's managed signing and submission pipeline is worth more than direct native access. None
applies to a single-developer, two-day, emulator-targeted exercise.
