# ADR-0002: Hold streaming ticks in a keyed external store, not Redux

**Status:** Accepted
**Requirements:** R20 (smooth under bursts), R30 (responsive UI), R31 (efficient state management)

## Context

The app already uses Redux Toolkit for two things, and both are the right fit: RTK Query for
`/pairs/meta`, and a slice for favourites. The default move is therefore to put market data in a
third slice and dispatch on each incoming frame. That is the conventional answer, it is what most
React Native codebases do, and it is what an AI assistant suggests first when asked where the
WebSocket data should live.

It does not survive contact with the update rate. A Redux dispatch runs **every** reducer in the
tree, then wakes **every** `useSelector` subscriber, each of which re-runs its selector function and
shallow-compares the result. At 10 Hz across five pairs that is fifty full store traversals per
second plus a wake-up for every connected component in the app - to change one number in one row.

Under `SYNTHETIC_LOAD=1` the arithmetic gets worse rather than better, and R20 explicitly asks the
UI to stay smooth during sustained bursts. The requirement is a load test in disguise.

The mitigations are real but each has a catch. Batching dispatches at the emit interval reduces the
count but not the per-dispatch cost. Memoised selectors avoid re-renders but not the selector runs
themselves - every subscriber still executes on every dispatch. `reselect` with per-pair selector
factories gets close, at which point you have rebuilt a keyed subscription registry inside Redux,
with extra indirection.

## Decision

Keep tick data out of Redux entirely. `src/realtime/marketStore.ts` is a plain class holding
`Map<pair, Snapshot>` with a **per-pair listener registry**, consumed through React's
`useSyncExternalStore`.

A tick for `BTCUSDT` notifies exactly the listeners registered for `BTCUSDT`. The `FlashList` does
not re-render, the screen does not re-render, and sibling rows do not re-render. One row updates
because one row's data changed.

Two contract details this depends on:

- `getSnapshot` must return a referentially stable value or `useSyncExternalStore` re-renders
  forever. The store holds frozen per-pair snapshot objects and swaps the reference only when a
  field actually changed.
- All updates in an incoming batch are applied *before* any listener is notified, so no listener
  can observe a torn intermediate state.

Both are pinned by `src/realtime/__tests__/marketStore.test.ts`, along with the isolation property
itself - because "only the right component re-renders" is the entire value of this decision and it
would regress silently.

The store also has **no method to clear it**. That is deliberate and belongs here rather than in the
connection layer: R25 requires the app to keep showing the last received data when the backend goes
away, and making that structurally impossible to violate is worth more than remembering not to.

## Consequences

**Redux DevTools does not show market data.** A real cost for debugging, mitigated by the Telemetry
screen showing the rates and by the store being small enough to inspect directly. Time-travel
debugging over 10 Hz tick data was never going to be useful anyway.

**Two state systems in one app**, which needs explaining to anyone joining. `AGENTS.md` and
`.cursor/rules/09-realtime.mdc` state the rule in the form an agent or a new contributor will hit
it: never dispatch tick data to Redux.

**The performance claim is measurable.** The Telemetry screen's FPS gauge samples the **JS thread**
specifically, via a `requestAnimationFrame` loop. That is the honest metric: it is precisely the
thread a Redux dispatch storm would starve. If this decision is right, the gauge holds 60 under
synthetic load. If ticks had gone into Redux, that is the number that would visibly collapse.
See [ADR-0006](0006-telemetry-as-evidence.md).

## What would change this

A materially lower update rate - one update a second across a handful of pairs would not justify a
second state system. Or a requirement for tick history, undo, or cross-cutting derived state over
the market data, where Redux's centralisation starts paying for itself.
