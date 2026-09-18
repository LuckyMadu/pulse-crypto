# PulseCrypto

A real-time cryptocurrency market data pipeline: an Express gateway that ingests Binance public
market streams, conflates them, and fans them out over WebSocket to a bare React Native client.

Built for the *Staff Engineer - Mobile Apps (Architect)* practical assignment.

| | |
|---|---|
| **Backend** | Node 20+, Express 5, `ws`, TypeScript |
| **Mobile** | Bare React Native 0.86, React 19, TypeScript |
| **State** | RTK Query (metadata), Redux + MMKV (favourites), keyed external store (ticks) |
| **Spec** | [`docs/SPEC.md`](docs/SPEC.md) - 37 numbered requirements, referenced by test names and commits |
| **Decisions** | [`docs/adr/`](docs/adr/) - six ADRs |
| **AI usage** | [`docs/AI_USAGE.md`](docs/AI_USAGE.md) |

---

## Table of contents

- [Quick start](#quick-start)
- [Setup instructions](#setup-instructions)
- [Build and run](#build-and-run)
- [Architecture](#architecture)
- [The buffering strategy (R7)](#the-buffering-strategy-r7)
- [Slow consumers (R6)](#slow-consumers-r6)
- [Payload format (R10)](#payload-format-r10)
- [REST API](#rest-api)
- [Mobile state architecture](#mobile-state-architecture)
- [Assumptions](#assumptions)
- [Trade-offs considered](#trade-offs-considered)
- [Deliberately not built](#deliberately-not-built)
- [How AI-assisted development was used](#how-ai-assisted-development-was-used)
- [Testing](#testing)
- [Requirements traceability](#requirements-traceability)
- [Troubleshooting](#troubleshooting)

---

## Quick start

Three terminals, from the repository root:

```bash
# 1. gateway
cd backend && npm install && npm run dev

# 2. metro
cd mobile && npm install && npm start

# 3. app
cd mobile && npm run android
```

If Binance is unreachable from your network, swap step 1 for `npm run dev:synthetic` and everything
else is unchanged. See [Assumptions](#assumptions).

---

## Setup instructions

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node | >= 20 (backend), >= 22.11 (mobile) | React Native 0.86 requires the newer runtime |
| JDK | 17 | `JAVA_HOME` must point at it; Gradle for RN 0.86 will not accept 21 |
| Android SDK | platform 35, build-tools 35+ | Android Studio installs these |
| Android emulator | an AVD on API 34 or 35 | the brief requires the app to run on an emulator |
| Watchman | optional | Metro works without it, but warns on every start |

```bash
# in ~/.zshrc, adjust for your JDK
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
```

### Install

```bash
cd backend && npm install
cd ../mobile && npm install
```

The mobile app bundles Inter, Hanken Grotesk and JetBrains Mono from `mobile/assets/fonts`; they are
already linked into both native projects. If you add or replace a face, re-run `npm run fonts`.
Licences are in `mobile/assets/font-licenses/`.

### Configuration

The gateway runs with no configuration at all. Every value in
[`backend/.env.example`](backend/.env.example) is the default that `src/config.ts` already applies,
so the file is documentation rather than a required step. Copy it to `.env` only to override
something.

`config.ts` is the only module permitted to read `process.env`, and it range-checks everything once
at import time - a bad `EMIT_INTERVAL_MS` fails at boot with a readable message instead of becoming
a `NaN` that silently disables the emitter twenty minutes into a demo.

---

## Build and run

### Backend

```bash
npm run dev            # tsx watch, port 8080
npm run dev:synthetic  # same, but replaces Binance with a ~2000 msg/s local generator
npm run build          # tsc -> dist/
npm start              # node dist/server.js
npm run verify         # lint (zero warnings) + tsc --noEmit + jest
```

Check it is alive:

```bash
curl -s localhost:8080/health   | jq
curl -s localhost:8080/pairs/meta | jq
```

### Mobile

```bash
npm start              # Metro
npm run android        # build and install on the running emulator
npm run ios            # optional; the brief only requires Android
npm run verify         # lint + typecheck + tests
npm run sync:protocol  # re-copy the wire contract from backend/
```

Start the gateway **before** the app. The app will connect anyway once the gateway appears - that is
the point of the reconnect logic - but the first launch is less confusing with data present.

---

## Architecture

```
Binance combined stream                          React Native app
  @bookTicker  @depth20@100ms  @ticker                  |
          |                                             |
          v                                             |
  ┌───────────────────┐                                 |
  │  binance/         │  one upstream socket for all    |
  │  upstreamClient   │  five pairs, backoff reconnect  |
  │  normalize        │  -> { pair, field, value }      |
  └─────────┬─────────┘                                 |
            │ every message, ~50-2000/s                 |
            v                                           |
  ┌───────────────────┐                                 |
  │  market/          │  Map<pair, Snapshot> + dirty    |
  │  marketStore      │  set. Writes overwrite. This    |
  │  metrics          │  is the memory bound: O(pairs)  |
  └─────────┬─────────┘                                 |
            │ drained every EMIT_INTERVAL_MS (100 ms)   |
            v                                           |
  ┌───────────────────┐                                 |
  │  market/emitter   │  serialize once, send to N      |
  │  ws/wsServer      │  sockets; skip any client over  |
  │  ws/clientRegistry│  its send budget                |
  └─────────┬─────────┘                                 |
            │  ws://host:8080/stream                    |
            └───────────────────────────────────────────┘
                        snapshot / update / status / stats / config

  routes/pairs, routes/health  ──  http://host:8080  ──  RTK Query
```

The backend explains itself in one sentence: **`binance/` ingests, `market/` conflates, `ws/` fans
out, and `routes/` is the small REST surface on the side.** Folder names that reveal the domain beat
folder names that reveal the framework, and "clean architecture" and "separation of concerns" are
two of the brief's explicit non-functional requirements (R28, R34), so this is the requirement being
answered rather than decoration.

```
backend/src/
  server.ts          port, WebSocket attach, graceful shutdown
  app.ts             builds the Express app, never calls listen()
  config.ts          the only reader of process.env, validated at boot
  binance/           upstreamClient, normalize, syntheticFeed
  market/            marketStore (conflation), metrics (pure math), emitter
  ws/                wsServer, clientRegistry (backpressure)
  routes/            pairs, health
  middleware/        errorHandler
  stats.ts           shared counters for /health and the stats frame
  types/protocol.ts  the wire contract - source of truth, copied to mobile
  utils/logger.ts
```

The `app.ts` / `server.ts` split is the one Express convention worth being strict about: it is what
lets the REST layer be tested with `supertest` against the app object, with no port binding and no
open handles leaking between test files.

Four conventional Express folders are deliberately absent. `models/` and `database/`, because there
is no persistence - the state is one in-memory `Map` by design, and that is the whole point of the
conflation strategy. `views/` and `public/`, because the client is a React Native app. `controllers/`,
because both route handlers are about five lines that delegate straight into `market/`; a controller
layer here would be indirection with no behaviour in it. `services/`, because `market/` *is* the
service layer, and wrapping it would add a path segment and no information.

Express 5 rather than 4, because it auto-forwards rejected promises from async handlers to the error
middleware. `errorHandler.ts` therefore catches async failures with no `asyncHandler` wrapper (R33).

---

## The buffering strategy (R7)

**The gateway never queues upstream messages. It overwrites.**

Binance sends roughly 50 messages a second across five pairs on a quiet day, and the brief asks for
emission at a configurable interval defaulting to 100 ms. The naive implementation - push arriving
messages onto an array, drain it on each tick - is wrong in a way that only shows up under load: if
the upstream rate exceeds the drain rate for any sustained period, the array grows without bound.
That is precisely the unbounded memory growth R6 asks us to prevent, and it arrives from the
*upstream* side rather than the client side, which is the easier one to miss.

So `market/marketStore.ts` holds exactly one mutable snapshot per trading pair:

```ts
Map<string, MutableSnapshot>   // five entries, forever
Set<string>                    // pairs touched since the last flush
```

An arriving message writes its fields into that pair's snapshot and adds the pair to the dirty set.
A hundred messages for `BTCUSDT` inside one 100 ms window produce a hundred writes and **one** entry
in the dirty set. On each tick the emitter drains the dirty set, serializes only those pairs, and
clears it.

Three consequences worth stating plainly, because they are the argument for the design:

1. **Memory is `O(pairs)`, not `O(messages)`.** It is structurally incapable of growing with the
   message rate. `backend/src/market/__tests__/marketStore.test.ts` asserts this across 10,000
   ingested updates.

2. **Dropping intermediate ticks is correct here, not a compromise.** For a price display, the
   newest value fully supersedes the previous one. There is no information in the eleven prices you
   skipped that the twelfth does not already carry. This would be the wrong strategy for a trade
   tape or anything requiring sequence integrity - which is exactly why the choice is worth
   documenting rather than assuming.

3. **The conflation ratio is visible, not asserted.** Under `SYNTHETIC_LOAD=1` the Telemetry screen
   shows ingestion around 2000/s against an emit rate flat at 10/s: a 200:1 collapse, on screen, in
   the recording.

Conflation is also per *field*, not per message. The three upstream streams move at very different
rates - `@bookTicker` many times a second, `@ticker` roughly once - so an update frame carries only
the fields that actually changed rather than a full re-statement of the pair.

---

## Slow consumers (R6)

A client that stops draining its socket is the other unbounded-growth path: `ws` will happily buffer
frames in userland forever while a stalled phone or a paused debugger ignores them.

`ws/clientRegistry.ts` applies a three-stage policy per socket, before every send:

1. **Check the budget.** `socket.bufferedAmount > MAX_BUFFERED_BYTES` (default 1 MB) means the
   client is not keeping up.
2. **Skip, do not queue.** The frame is dropped for that client only. Every other client is
   unaffected, and the skip is counted in `droppedFrames`.
3. **Terminate after a sustained breach.** `MAX_CONSECUTIVE_SKIPS` over-budget ticks in a row
   (default 50, which is 5 s at the default interval) means the client is not coming back, so the
   socket is terminated rather than held open.

**Skipping is safe precisely because of conflation**, and this is the elegant part: the next tick
carries current state rather than the next item in a backlog, so a client that recovers resyncs
automatically instead of replaying stale history. A queueing design would have to choose between
replaying history nobody wants and dropping from the middle of a sequence; conflation removes the
choice.

A separate 30-second ping/pong heartbeat reaps half-open sockets - the connections that are gone but
never sent a close frame, which is the normal failure mode on mobile networks.

---

## Payload format (R10)

[`backend/src/types/protocol.ts`](backend/src/types/protocol.ts) is the executable form of this
section, and `mobile/scripts/sync-protocol.js` copies it verbatim into the app with a
"generated - do not edit" header. That is a deliberate three-line script rather than a shared
workspace package: two packages do not justify monorepo tooling, and
`node scripts/sync-protocol.js --check` fails if the copies have drifted, which is the property that
actually matters.

### Server to client

```ts
type ServerMessage =
  | { type: "snapshot"; serverTime: number; pairs: PairUpdate[] }  // once, on connect
  | { type: "update";   serverTime: number; pairs: PairUpdate[] }  // every emit interval
  | { type: "status";   upstream: UpstreamState; serverTime: number }
  | { type: "stats";    serverTime: number; stats: GatewayStats }  // once a second
  | { type: "config";   emitIntervalMs: number }                   // echo after clamping
  | { type: "error";    message: string };

interface PairUpdate {
  pair: string;          // R9: every update names its pair
  timestamp: number;
  price?: number;
  change24hPct?: number;
  spread?: number;       // best ask - best bid, in quote currency
  spreadPct?: number;
  buyPressure?: number;  // 0-100
  sellPressure?: number; // 100 - buyPressure
  book?: Book;           // only for pairs this client subscribed to
}

type Level = [price: number, quantity: number];
interface Book { bids: Level[]; asks: Level[] }
```

Every optional field is optional because it might not have changed. That is conflation showing
through into the wire format.

### Client to server

```ts
type ClientMessage =
  | { type: "subscribeDepth";  pairs: string[] }  // opt in to order book depth
  | { type: "setEmitInterval"; ms: number };      // the Telemetry screen's slider
```

Both are validated by `isClientMessage` before use. `JSON.parse` output from a socket is untrusted
input.

### Three encoding decisions

- **`[price, quantity]` tuples, not objects.** At 10 Hz with 40 levels per pair, the repeated key
  names `"price"` and `"quantity"` would be roughly 40% of the frame, forever, carrying no
  information.
- **One frame per tick carrying an array of pairs**, not one frame per pair. Five pairs at 10 Hz is
  10 frames/s instead of 50. Each element still names its own pair, so R9 holds and clients route
  without positional assumptions.
- **`book` is sent only to subscribers.** The watchlist renders no order book; pushing five
  20-level books at it would be pure waste. The detail screen sends `subscribeDepth` for the one
  pair it shows.

Each emitted frame is serialized **once** and the resulting string is sent to every client, so
`JSON.stringify` cost is `O(1)` in the number of connections rather than `O(n)`.

---

## REST API

### `GET /pairs/meta` (R11)

```jsonc
{
  "pairs": [{
    "pair": "BTCUSDT",
    "displayName": "BTC/USDT",
    "baseAsset": "BTC",
    "quoteAsset": "USDT",
    "status": "TRADING",
    "high24h": 64890.0,
    "low24h": 62110.5,
    "volume24h": 18234.9,
    "priceDecimals": 2,
    "marketCapUsd": 1274000000000,  // mocked; see assumptions
    "live": true                     // false => served from the static seed
  }],
  "serverTime": 1737300000000
}
```

`live` is the honest flag: `true` means high/low/volume came from the live `@ticker` stream, `false`
means the upstream has not delivered a ticker frame yet and these are seed values. The app renders
either, so the watchlist paints on first frame rather than waiting for the socket (R12).

### `GET /health`

Not required by the brief. It exists because it is the cheapest way to make the non-functional
claims inspectable without a phone - `curl` it during a synthetic-load run and you can see ingestion
at ~2000/s, emit rate flat, `bufferedPairs` pinned at 5, and RSS steady. It returns the same
`stats.snapshot()` the Telemetry screen renders, so the two cannot disagree.

Status is `degraded` rather than `unhealthy` while the upstream reconnects, because the gateway is
still serving last-known snapshots to every client. That is documented behaviour (R25), not an
outage.

---

## Mobile state architecture

Three kinds of state, three different tools, and the reasoning is the mobile headline:

| State | Tool | Why |
|-------|------|-----|
| Server metadata | RTK Query (`baseApi` + `pairsApi`) | caching and `refetch()` for pull-to-refresh, free |
| Favourites | Redux slice + MMKV persistence | low frequency, needs to survive a cold start |
| Streaming ticks | **not Redux** - a keyed external store | 10 Hz x 5 pairs would melt a Redux tree |

### Why ticks are not in Redux

A Redux dispatch runs every reducer in the tree and wakes every `useSelector` subscriber, which then
re-runs its selector and shallow-compares the result. At 10 updates a second across five pairs, that
is fifty full store traversals per second plus a wake-up for every connected component, to change
one number in one row.

`src/realtime/marketStore.ts` is a plain class holding `Map<pair, Snapshot>` with a **per-pair
listener registry**, read through `useSyncExternalStore`. A tick for `BTCUSDT` wakes exactly the one
`MarketRow` subscribed to `BTCUSDT`. **The list itself does not re-render at all** - not the
`FlashList`, not the screen, not the sibling rows.

Two implementation details this depends on:

- `getSnapshot` must return a referentially stable value or `useSyncExternalStore` loops forever, so
  the store holds frozen per-pair snapshot objects and swaps the reference only when something
  actually changed.
- Updates arriving in one frame are all applied *before* any listener is notified, so a batch never
  produces a torn intermediate render.

`src/realtime/__tests__/marketStore.test.ts` pins both, plus the isolation property itself.

This is measurable rather than asserted, which is the reason the Telemetry screen exists: the FPS
gauge samples the **JS thread** specifically, via a `requestAnimationFrame` loop. If the
architecture works, that number stays at 60 under synthetic load. If ticks had gone into Redux, that
is the number that would visibly collapse.

### Animations run off the JS thread

Price flashes (R21, R22) and order book depth bars (R23) use Reanimated 4 shared values with
`useAnimatedStyle`. They execute on the UI thread, so they stay smooth even while JS is busy - which
is directly what "remains smooth and responsive during sustained update bursts" (R20) is asking for.
An `Animated` implementation driven from JS would degrade exactly when the requirement is being
tested.

### Connection handling (R24 - R27, R32)

`src/realtime/MarketStreamClient.ts` wraps the socket with four things a bare `new WebSocket()` does
not have:

- **Exponential backoff with jitter**, so a dead gateway is not hammered and clients do not retry in
  lockstep.
- **App state awareness** - drop on background, reconnect on foreground. Both platforms stop
  draining sockets well before they suspend a process, so a backgrounded app holding a socket open
  wastes battery *and* looks like a slow consumer to the gateway's backpressure budget.
- **NetInfo connectivity**, which turns a 10-second silent stall into an immediate, accurate
  "offline".
- **A stall watchdog.** The gateway sends a `stats` frame every second, so silence is unambiguous
  evidence of a dead connection even when the socket still reports itself open. No `close` event
  ever fires for this, and it is the failure that actually happens on mobile networks.

**The store is never cleared on disconnect** - there is no method to do it, by design. That is what
satisfies "continue showing the most recently received data" (R25), and making it structurally
impossible rather than merely un-called is the difference between a property and a habit.

Pull-to-refresh calls RTK Query's `refetch()` on `/pairs/meta` and never touches the socket, so
prices keep ticking underneath the spinner (R27).

### The live indicator is per-row

Easy to misread. The brief lists the watchlist row contents as "Trading Pair, Current Price, 24 Hour
Change, **Live Connection Indicator**, Favourite Toggle" - the indicator is a row-level element, not
just the status in the app bar. So each `MarketRow` carries a dot driven by *that pair's* last tick
time, and a pair that goes quiet while the connection stays up is visibly distinguishable from one
that is ticking. The app bar keeps a global indicator as well.

---

## Assumptions

1. **Emit interval: 100 ms, not the mockup's 250 ms.** The brief specifies a configurable interval
   defaulting to 100 ms; the mockup's Update Frequency slider reads 250 ms. The brief wins, and the
   slider initialises at 100. Flagging the discrepancy seemed better than silently picking one.

2. **`setEmitInterval` retunes the shared emitter globally, not per client.** A per-client cadence
   would cost a timer per socket and buy nothing for a demo. Documented rather than hidden, since a
   second connected client would observe the change.

3. **Buy/sell pressure is an order book imbalance proxy.** Binance publishes no pressure metric, so
   it is computed as bid notional over total notional across the top 20 levels, x100. Standard, but
   derived, so it belongs here.

4. **Market cap is mocked.** The mockup shows it; Binance does not publish circulating supply. It
   comes from a small static supply table and the README says so rather than the number implying a
   data source that does not exist. Everything else on `/pairs/meta` is real.

5. **`@depth20@100ms` is treated as authoritative for the top 20 levels.** No REST snapshot plus
   `U`/`u` sequence diff reconciliation. For a top-20 display the partial-depth stream *is* correct;
   full order book sync only matters for execution. See [ADR-0003](docs/adr/0003-partial-depth-stream.md).

6. **Upstream host is `data-stream.binance.vision`.** It is the public market-data endpoint: no
   auth, and fewer regional restrictions than `stream.binance.com`, which is geo-blocked in several
   countries. A reviewer on a blocked network would otherwise see an app that connects to the
   gateway but shows no prices, which looks like a bug in the code.

7. **Android emulator is the target.** iOS is scaffolded and should build, but it is untested; the
   brief only requires Android.

---

## Trade-offs considered

**Conflation vs. a queue.** Covered above. The cost is that intermediate ticks are unrecoverable,
which would be disqualifying for a trade tape and is free for a price display.

**Express vs. Fastify.** Fastify is measurably faster at HTTP, and it is the wrong axis to optimise:
the REST surface here is two endpoints hit occasionally, while the hot path is WebSocket fan-out,
which does not go through the HTTP framework at all. Express 5's async error forwarding and its
ubiquity at review time are worth more than throughput this service will never need.

**Bare React Native vs. Expo.** Expo would have been faster to start. The brief calls for the
Android emulator and this app leans on MMKV, Reanimated worklets and font linking - all of which are
either config-plugin territory or a prebuild away from bare anyway.
See [ADR-0005](docs/adr/0005-bare-react-native.md).

**FlashList vs. FlatList.** Five rows do not need virtualisation, and FlashList costs a dependency
for nothing at this size. It is here because row recycling makes the per-row subscription pattern
worth demonstrating at a scale the brief does not reach - an honest over-build, and small.

**A shared `protocol` package vs. a copy script.** A workspace package is the correct answer for a
real product and disproportionate for two directories. The copy script with a `--check` mode gets
the guarantee that matters (drift fails CI) for three lines.

**Per-client vs. global emit cadence.** See assumption 2.

**Targeted tests vs. coverage.** Roughly a dozen tests, aimed at the logic that is easy to get
subtly wrong and hard to eyeball: memory boundedness, dirty-set flushing, the backpressure state
machine, the spread and pressure math, and the store's notification isolation. Chasing a coverage
number on a two-day exercise produces tests that assert the implementation back at itself.

---

## Deliberately not built

Naming the non-goals is the direct guard against over-engineering, so they are listed rather than
left implicit:

- **No full order book reconciliation.** See assumption 5.
- **No Redis, Kafka, or horizontal scaling.** Single process, in-memory. The scale-out path is
  sticky sessions or a shared conflation tier; neither is needed for five pairs and it would be
  architecture theatre to build it.
- **No auth, no database, no Docker, no GraphQL.** Nothing in the brief needs them.
- **No Settings screen and no side drawer**, despite both appearing in the mockup. The drawer is
  marked "Hidden by Default" and holds API Keys / Security / Trade History / Sign Out - account
  features with no backing service and nothing to do with real-time market data. The Settings tab
  renders a short placeholder saying exactly that. Cutting a designed-but-irrelevant screen is a
  better signal than half-building it.
- **No "Adaptive Polling Strategy" toggle** from the mockup. It sounds impressive and means nothing
  concrete here; the Update Frequency slider already demonstrates a configurable emit interval, for
  real.
- **No blanket test coverage.** See trade-offs.

---

## How AI-assisted development was used

Full detail in [`docs/AI_USAGE.md`](docs/AI_USAGE.md), including the places where the AI's first
suggestion was rejected. The short version:

**The workflow was spec-driven.** The brief was turned into
[`docs/SPEC.md`](docs/SPEC.md) - 37 numbered requirements with a one-line acceptance criterion each -
*before* any implementation. Every test name and every commit message then references a requirement
ID:

```bash
rg -o 'R\d+' backend/src mobile/src | sort -u   # what is covered
git log --oneline --grep 'R6'                    # what touched a requirement
```

That is the whole trick, and it costs nothing. When an agent writes most of the code you cannot
verify it by reading all of it, so completeness has to be greppable rather than taken on trust.

**The agent worked against committed context, not ad hoc prompts.** [`AGENTS.md`](AGENTS.md) holds
the invariants an agent must not break - "never dispatch tick data to Redux", "never queue upstream
messages", "serialize each frame once" - and `.cursor/rules/` carries nine rule files, eight adapted
from an existing production React Native codebase plus `09-realtime.mdc` written for this streaming
layer.

**Review was mechanical.** `npm run verify` in both packages (ESLint at zero warnings, `tsc --noEmit`,
Jest) gates every slice, and a Bugbot pass ran over the diff before the final commit. Generated code
gets more value from an automated gate than hand-written code does, because there is more of it and
it arrives faster than you can read it.

**Judgment was applied, and the log says where.** The most useful entry in `AI_USAGE.md` is the
tick-state one: the first suggestion was a Redux slice for market data, which is the conventional
answer and would have failed R20 and R31 under load. It was rejected in favour of the keyed external
store, and the Telemetry screen exists partly so the difference is demonstrable rather than
argued.

---

## Testing

```bash
cd backend && npm run verify
cd mobile  && npm run verify
```

Each `verify` runs ESLint with zero tolerance for warnings, `tsc --noEmit`, and Jest.

Backend tests cover memory staying `O(pairs)` across 10k synthetic updates, the emitter flushing only
dirty pairs, the backpressure guard skipping frames over budget and terminating after a sustained
breach, spread and pressure math, the Binance frame normalizer (including malformed input), the
synthetic feed's distribution, and the REST routes via `supertest`.

Mobile tests cover the favourites reducer and its MMKV round trip (including cold-start hydration
and version mismatch), the keyed store's notification isolation and `useSyncExternalStore`
contract, and the `/pairs/meta` normalizer.

---

## Requirements traceability

Full criteria in [`docs/SPEC.md`](docs/SPEC.md). This table is the map from requirement to code.

### Backend

| ID | Requirement | Where |
|----|-------------|-------|
| R1 | Five trading pairs | `backend/src/config.ts` |
| R2 | Connect to Binance WebSocket streams | `binance/upstreamClient.ts` |
| R3 | Continuously ingest order book updates | `binance/upstreamClient.ts`, `binance/normalize.ts` |
| R4 | Buffer / batch incoming updates | `market/marketStore.ts` |
| R5 | Configurable emit interval, default 100 ms | `market/emitter.ts`, `EMIT_INTERVAL_MS` |
| R6 | Prevent unbounded memory growth from slow consumers | `ws/clientRegistry.ts`, `market/marketStore.ts` |
| R7 | Buffering strategy explained | [above](#the-buffering-strategy-r7) |
| R8 | Local WebSocket server broadcasting updates | `ws/wsServer.ts` |
| R9 | Each update identifies its pair | `types/protocol.ts` (`PairUpdate.pair`) |
| R10 | Payload format documented | [above](#payload-format-r10), `types/protocol.ts` |
| R11 | `GET /pairs/meta` | `routes/pairs.ts`, `market/pairSeed.ts` |

### Mobile

| ID | Requirement | Where |
|----|-------------|-------|
| R12 | Watchlist shows all pairs | `features/markets/MarketsScreen.tsx` |
| R13 | Row: pair, price, 24h change, live dot, favourite | `features/markets/components/MarketRow.tsx`, `components/LiveDot.tsx` |
| R14 | Search / filter | `MarketsScreen.tsx`, `design-system/ui/SearchField.tsx` |
| R15 | Favourite pairs | `store/redux/slices/favouritesSlice.ts` |
| R16 | Favourites persisted | `lib/storage/persistSlice.ts` (MMKV) |
| R17 | Favourites restored on restart | `store/redux/index.ts` (`preloadedState`) |
| R18 | Detail: price, pressure, spread, order book, timestamp | `features/terminal/` |
| R19 | Continuous updates | `realtime/MarketStreamClient.ts` |
| R20 | Smooth under sustained bursts | `realtime/marketStore.ts`, `features/telemetry/components/FpsGauge.tsx` |
| R21 / R22 | Green / red price flash | `MarketRow.tsx`, `features/terminal/components/PriceTicker.tsx` |
| R23 | Order book volume animates smoothly | `features/terminal/components/OrderBookRow.tsx` |
| R24 | Show connection status when backend is down | `components/ConnectionIndicator.tsx`, `components/ConnectionBanner.tsx` |
| R25 | Keep showing last received data | `realtime/marketStore.ts` (no clear method) |
| R26 | Auto-reconnect | `realtime/MarketStreamClient.ts` |
| R27 | Pull-to-refresh without interrupting the stream | `MarketsScreen.tsx` (RTK Query `refetch`) |

### Non-functional and deliverables

| ID | Requirement | Where |
|----|-------------|-------|
| R28 | Clean architecture | [above](#architecture) |
| R29 | Maintainable code | `npm run verify` in both packages |
| R30 | Responsive UI | see R20 |
| R31 | Efficient state management | [above](#mobile-state-architecture), [ADR-0002](docs/adr/0002-external-store-for-ticks.md) |
| R32 | Robust connection handling | `MarketStreamClient.ts`, `ws/clientRegistry.ts` |
| R33 | Appropriate error handling | `middleware/errorHandler.ts`, `binance/normalize.ts` |
| R34 | Separation of concerns | `market/metrics.ts` is pure and tested without sockets |
| R35 | Git repo | this repository, commits in slices tagged by requirement ID |
| R36 | Screen recording | see below |
| R37 | README | this file |

---

## Screen recording

The recording follows this order, because each step demonstrates a requirement that is invisible
if you do not point at it:

1. `npm run dev`, then `curl /pairs/meta` and `curl /health` - the REST surface.
2. App launches on the emulator; watchlist populates; prices tick with green/red flashes and per-row
   live dots.
3. Search filters to `btc`; favourite two pairs; **kill and relaunch the app** - favourites restored
   with no flash of the un-favourited state.
4. Terminal detail: order book updating, depth bars animating, spread and pressure live,
   last-updated timestamp advancing.
5. Pull-to-refresh on the watchlist - metadata reloads while prices keep ticking underneath.
6. **Kill the backend.** Status flips to reconnecting, last prices stay on screen, dots go stale.
   Restart it; the app reconnects with no user action.
7. Telemetry: drag Update Frequency from 100 ms to 1000 ms and back; emit rate tracks it live.
8. Restart with `SYNTHETIC_LOAD=1`: ingestion jumps to ~2000 msg/s, **emit rate stays flat**, the FPS
   gauge holds 60, memory stays flat. This is the entire thesis of the submission on one screen.

---

## Troubleshooting

**The app connects but shows no prices.** Binance may be unreachable from your network. Check
`curl -s localhost:8080/health | jq .stats.upstream`. If it is stuck on `reconnecting`, run the
gateway with `npm run dev:synthetic`.

**The app never connects at all.** The Android emulator is a separate virtual device, so `localhost`
inside it is the emulator's own loopback, not your machine. The host is `10.0.2.2`, which
`mobile/src/config/index.ts` already selects per platform. On a **physical device**, either set
`HOST_OVERRIDE` in that file to your LAN IP, or run `adb reverse tcp:8080 tcp:8080`.

**Cleartext traffic is blocked.** Android has refused `http://` and `ws://` by default since API 28,
with no obvious error. `android/app/src/main/res/xml/network_security_config.xml` permits cleartext
to `10.0.2.2`, `localhost` and `127.0.0.1` **only** - deliberately scoped rather than setting
`usesCleartextTraffic="true"`, which would disable the protection for release builds too.

**Gradle rejects the JDK.** React Native 0.86 needs JDK 17. Android Studio ships its own JDK 21,
which Gradle will pick up if `JAVA_HOME` is unset.

**Fonts render as the system default.** Run `npm run fonts` and rebuild. A Metro reload is not
enough; font linking is a native change.
