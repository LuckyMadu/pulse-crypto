/**
 * The only module that knows a host name.
 *
 * ## Why the Android host is not `localhost`
 *
 * The Android emulator is a virtual machine with its own network stack, so
 * `127.0.0.1` inside it is the *emulator's* loopback, not the development
 * machine's. A gateway running on the host is unreachable at `localhost` and
 * the failure is silent - the socket just never opens. The emulator exposes the
 * host at the special alias **`10.0.2.2`**.
 *
 * This is the single most common reason a reviewer runs a React Native
 * submission and sees an app that never connects, so it is handled here rather
 * than left as a README instruction.
 *
 * iOS simulators share the host's network stack, so `localhost` is correct
 * there. A **physical device** needs either the machine's LAN IP or
 * `adb reverse tcp:8080 tcp:8080`, which maps the device's `localhost:8080`
 * back to the host - documented in the README.
 *
 * ## Cleartext
 *
 * `ws://` and `http://` are blocked on Android by default since API 28. See
 * `android/app/src/main/res/xml/network_security_config.xml`, which permits
 * cleartext to `10.0.2.2` and `localhost` **only**, rather than setting
 * `usesCleartextTraffic="true"` and disabling the protection everywhere.
 */

import { Platform } from "react-native";

/** Override to point at a LAN IP for a physical device. */
const HOST_OVERRIDE: string | null = null;

const DEFAULT_HOST = Platform.select({
  android: "10.0.2.2",
  ios: "localhost",
  default: "localhost",
});

const host = HOST_OVERRIDE ?? DEFAULT_HOST;
const port = 8080;

export const config = {
  api: {
    baseUrl: `http://${host}:${port}`,
    /** Metadata is small and cached; a long timeout would just delay the error. */
    timeoutMs: 10_000,
  },

  stream: {
    url: `ws://${host}:${port}/stream`,
    /** Reconnect backoff. Jittered, matching the gateway's own policy. */
    reconnectBaseMs: 500,
    reconnectMaxMs: 15_000,
    /**
     * No frame for this long means the connection is dead even though the
     * socket claims otherwise. The gateway sends a `stats` frame every second,
     * so silence for 10 s is unambiguous.
     */
    stallTimeoutMs: 10_000,
  },

  ui: {
    /**
     * A pair whose last tick is older than this shows a stale dot rather than a
     * live one. Long enough that a quiet pair is not mislabelled on every
     * render, short enough to notice a genuine stall.
     */
    stalePairThresholdMs: 2_500,
    /** Sample window for the JS-thread FPS gauge on the Telemetry screen. */
    fpsSampleWindowMs: 1_000,
  },

  /** The brief's default. The mockup's slider shows 250; the brief wins. */
  defaultEmitIntervalMs: 100,
  emitIntervalRange: { min: 10, max: 1_000 },
} as const;

export const HOST = host;
