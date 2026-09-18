# PulseCrypto app

Bare React Native 0.86 client for the [PulseCrypto gateway](../backend). Setup prerequisites, the
state architecture and the requirements traceability table live in the
[root README](../README.md); this file is the operational summary.

## Run

Start the gateway first (`cd ../backend && npm run dev`), then:

```bash
npm install
npm start              # Metro
npm run android        # build and install on the running emulator
npm run verify         # eslint --max-warnings 0 && tsc --noEmit && jest
npm run sync:protocol  # re-copy the wire contract from ../backend
npm run fonts          # re-link assets/fonts after adding a face
```

The app reconnects on its own, so starting it before the gateway works - it just opens empty.

## Layout

```
src/
  app/               root component: providers, navigation container
  navigation/        RootNavigator, TabNavigator
  design-system/     tokens (colours, type, spacing, motion) + 7 primitives
  realtime/          MarketStreamClient, marketStore, hooks      <- the interesting part
  store/             RTK Query api + favourites slice + MMKV persistence
  features/
    markets/         watchlist: rows, search, favourites, price flash
    terminal/        detail: ticker, order book, depth chart, pressure
    telemetry/       FPS gauge, rate metrics, emit-interval slider
    settings/        placeholder; see "deliberately not built" in the root README
  components/        TopAppBar, ConnectionIndicator, ConnectionBanner, LiveDot
  lib/storage/       MMKV wrapper and the Redux persistence middleware
  config/            the only module that knows a host name
  types/protocol.ts  GENERATED - edit ../backend/src/types/protocol.ts instead
```

## Three rules worth knowing before editing

1. **Tick data never goes into Redux.** It lives in `realtime/marketStore.ts`, a keyed external
   store read through `useSyncExternalStore`, so a price change wakes one row rather than the tree.
   See [ADR-0002](../docs/adr/0002-external-store-for-ticks.md).
2. **`types/protocol.ts` is generated.** Change it in the backend and run `npm run sync:protocol`.
3. **Every number renders in JetBrains Mono.** Monospaced digits are tabular, so a price ticking
   from `64,239.50` to `64,240.00` causes no reflow. Use the `numeric` text variants.

## Networking

`src/config/index.ts` resolves the host per platform: `10.0.2.2` on Android (the emulator's alias
for the host machine - `localhost` is the emulator's own loopback and will silently never connect),
`localhost` on iOS. For a physical device, set `HOST_OVERRIDE` to your LAN IP or run
`adb reverse tcp:8080 tcp:8080`.

Android has blocked cleartext since API 28. `android/app/src/main/res/xml/network_security_config.xml`
permits it for `10.0.2.2`, `localhost` and `127.0.0.1` only.
