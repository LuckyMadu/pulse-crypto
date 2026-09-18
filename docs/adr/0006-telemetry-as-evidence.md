# ADR-0006: Build the mockup's Telemetry screen as live instrumentation

**Status:** Accepted
**Requirements:** R20 (smooth under bursts), R30 (responsive UI), R31 (efficient state management)

## Context

Three of the brief's requirements are performance claims: the UI must remain smooth under sustained
update bursts, state management must be efficient, and memory must not grow without bound. All
three are normally answered in a README - "we used a keyed external store, so only the affected row
re-renders" - and a reader has no way to check any of it without building the app, generating load,
and attaching a profiler. In practice nobody does, so the claims are taken on faith or discounted.

The mockup contains a Telemetry screen that happens to be exactly the instrument that would settle
them: a "JS Thread Frame Rate" gauge reading 60 FPS, a "WS Message Ingestion Rate" of 42 msgs/sec, a
memory footprint tracker, a "HEALTHY" badge with average ping, and an "Update Frequency" slider.

It was designed as decoration. Every number on it corresponds to something the gateway already
counts.

It is also the screen most easily built as a lie - hardcode `60 FPS`, hardcode `42 msgs/sec`, ship
the screenshot. That version looks identical in a still and is worthless.

## Decision

Build it, wire every value to a real source, and make the sources the same ones `/health` reports.

| Displayed | Source |
|-----------|--------|
| JS Thread Frame Rate | a `requestAnimationFrame` loop counting frames on the JS thread |
| WS Message Ingestion Rate | `stats.upstreamMsgsPerSec` from the gateway's `stats` frame |
| Emitted update rate | `stats.emitsPerSec` - the ratio against ingestion *is* the conflation ratio |
| Dropped frames / terminated clients | the backpressure counters from [ADR-0004](0004-backpressure-policy.md) |
| Memory footprint | the gateway's RSS, sampled once a second |
| Update Frequency slider | sends `setEmitInterval`; the gateway clamps and echoes it back |

The gateway's `stats.ts` is a single set of counters read by both `GET /health` and the WebSocket
`stats` frame, so the screen and the endpoint cannot disagree. If they could, one of them would be
wrong and there would be no way to tell which.

The FPS gauge measures the **JS thread** specifically. That is the honest choice: it is the thread a
Redux dispatch storm would starve, and the one that [ADR-0002](0002-external-store-for-ticks.md) is
protecting. A UI-thread FPS reading would sit at 60 regardless, because Reanimated runs the
animations there - it would look better and prove nothing.

Two toggles in the mockup are handled by not pretending. "Binary Protocol Compression" and
"Adaptive Polling Strategy" are named in the README as decorative rather than wired, because a
toggle that moves and does nothing is worse than an absent one.

## Consequences

**The performance claims become demonstrable in about ten seconds.** Restart the gateway with
`SYNTHETIC_LOAD=1`: ingestion jumps to ~2000 msg/s, the emit rate stays flat at the configured
interval, the FPS gauge holds 60, and memory does not move. Conflation, the emit interval, the
memory bound and the rendering architecture are all on one screen at once.

**The architecture is being measured rather than asserted**, which changes what a failure means. If
ticks had gone into Redux, the FPS gauge would collapse under that same load - so the screen is a
live regression test for ADR-0002, not a dashboard.

**The slider makes "configurable interval" real.** R5 is otherwise demonstrated by editing an
environment variable and restarting, which shows the config was read, not that the emitter responds.
Dragging it from 100 ms to 1000 ms and watching the emit rate track it is the same requirement,
observable.

**It costs a screen that the brief did not ask for.** The justification is that it is the evidence
for three requirements the brief *did* ask for, and it was already designed.

## What would change this

Nothing about this app. On a production build the equivalent belongs behind a debug flag and feeds a
metrics backend rather than a screen - but the instrumentation itself is the same instrumentation,
which is the point.
