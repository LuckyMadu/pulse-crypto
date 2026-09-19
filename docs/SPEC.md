# PulseCrypto - Specification

Derived from *Practical Assignment - Staff Engineer - Mobile Apps (Architect - Mobile Apps)*.

Every requirement below has a stable ID. Those IDs appear in test names and commit messages, so
completeness is checkable by `grep` rather than by trust:

```bash
# which requirements are covered by tests?
rg -o 'R\d+' --no-filename pulse-crypto/*/src | sort -u

# which commits touched a requirement?
git log --oneline --grep 'R12'
```

If an ID appears here and nowhere else, the requirement is either unimplemented or the document is
theatre. That property is the point of writing it down.

Status legend: `[x]` implemented and verified, `[~]` partially implemented (deviation documented),
`[ ]` not implemented (with reason).

---

## Backend

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| R1 | The service SHALL subscribe to Binance public market streams for at least BTCUSDT, ETHUSDT, SOLUSDT, DOGEUSDT and XRPUSDT. | `config.ts` lists the five pairs; `/pairs/meta` returns all five. |
| R2 | The service SHALL connect to the Binance WebSocket market streams. | A single combined-stream socket opens and reports `upstream: "connected"`. |
| R3 | The service SHALL continuously ingest order book updates. | `depth20` frames increment the ingest counter continuously while connected. |
| R4 | The service SHALL buffer and/or batch incoming updates. | Upstream messages are conflated into one snapshot per pair; no per-message queue exists. |
| R5 | The service SHALL emit processed updates to connected clients at a configurable interval, defaulting to 100 ms. | `EMIT_INTERVAL_MS` defaults to 100; changing it changes observed emit cadence. |
| R6 | The service SHALL prevent slow consumers from causing unbounded memory growth. | Buffer stays `O(pairs)` under 10k ingested updates; a client over the send budget has frames skipped and is terminated after a sustained breach. |
| R7 | The buffering strategy SHALL be explained in the README. | README has a "Buffering strategy" section. |
| R8 | The service SHALL expose a local WebSocket server broadcasting processed market updates. | A client connecting to `ws://<host>:8080` receives `snapshot` then `update` messages. |
| R9 | Each update SHALL identify which trading pair it belongs to. | Every `PairUpdate` carries a `pair` field. |
| R10 | The payload format SHALL be documented. | README documents every `ServerMessage` and `ClientMessage` variant; `types/protocol.ts` is its executable form. |
| R11 | The service SHALL expose `GET /pairs/meta` returning display name, trading status, 24h high, 24h low and 24h volume for all supported pairs. | `curl /pairs/meta` returns all five fields for all five pairs. |

## Mobile - Watchlist

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| R12 | The watchlist SHALL display all supported trading pairs. | Five rows render on first paint from `/pairs/meta`, before any tick arrives. |
| R13 | Each watchlist row SHALL display the trading pair, current price, 24 hour change, a live connection indicator and a favourite toggle. | All five elements present per row. Note the indicator is **per row**, not only global. |
| R14 | The user SHALL be able to search or filter trading pairs. | Typing `btc` narrows the list to BTC/USDT. |
| R15 | The user SHALL be able to favourite trading pairs. | Tapping the toggle marks the pair and sorts it to the top. |
| R16 | Favourites SHALL be persisted locally. | Favourites survive a JS reload. |
| R17 | Favourites SHALL be restored when the application restarts. | Favourites are present on first paint after a cold start, with no un-favourited flash. |

## Mobile - Detail

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| R18 | Selecting a pair SHALL display current price, buy pressure, sell pressure, spread, a live order book of bids and asks, and a last-updated timestamp. | All six present and updating on the Terminal screen. |

## Mobile - Live updates

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| R19 | The application SHALL receive continuous updates from the backend. | Prices change without user interaction. |
| R20 | The interface SHALL remain smooth and responsive during sustained update bursts. | JS thread holds ~60 FPS with the backend under `SYNTHETIC_LOAD=1` (~2000 msg/s upstream). |
| R21 | Price increases SHALL briefly highlight in green. | Row/price flashes `up` colour then decays. |
| R22 | Price decreases SHALL briefly highlight in red. | Row/price flashes `down` colour then decays. |
| R23 | Order book volume changes SHALL animate smoothly. | Depth overlay width interpolates rather than snapping. |

## Mobile - Resilience

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| R24 | When the backend is unavailable the application SHALL display the current connection status. | Killing the backend surfaces a reconnecting state in the app bar and watchlist. |
| R25 | When the backend is unavailable the application SHALL continue showing the most recently received data. | Last prices remain on screen after the backend dies; the store is never cleared on disconnect. |
| R26 | The application SHALL automatically reconnect when connectivity is restored. | Restarting the backend restores live data with no user action. |
| R27 | The application SHALL support pull-to-refresh to reload metadata from `GET /pairs/meta` without interrupting the live WebSocket stream. | Pull-to-refresh refetches metadata while prices keep ticking; the socket is not torn down. |

## Non-functional

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| R28 | Clean architecture. | Backend folders mirror the pipeline stages; mobile is feature-sliced with a separate design system. |
| R29 | Maintainable code. | `npm run verify` (ESLint zero warnings + `tsc --noEmit` + tests) passes in both packages. |
| R30 | Responsive UI under continuous updates. | See R20. |
| R31 | Efficient state management. | Tick data is held outside Redux in a keyed external store; only the affected row re-renders. |
| R32 | Robust connection handling. | Exponential backoff with jitter, app-state awareness, and heartbeat on both ends. |
| R33 | Appropriate error handling. | A central Express error handler; WebSocket and parse failures are caught and logged, never thrown into the event loop. |
| R34 | Good separation of concerns. | Ingest, conflation and fan-out are independent modules; the pure math lives in `metrics.ts` and is tested without sockets. |

## Deliverables

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| R35 | Complete source code shared via a Git repo. | One repo containing `pulse-crypto/backend/` and `pulse-crypto/mobile/`, with commits in meaningful slices. |
| R36 | Screen recording of the app. | Recording follows the shot list in the README. |
| R37 | README containing setup instructions, build and run instructions, architectural decisions, assumptions made, trade-offs considered, and how AI-assisted development tools were used. | All six sections present. |

---

## Documented deviations

These are deliberate and each is argued in the README or an ADR. Listing them here keeps the
specification honest rather than retrofitted.

| Ref | Deviation | Reason |
|-----|-----------|--------|
| R5 | The mockup's Update Frequency slider shows a 250 ms default; the brief says 100 ms. | The brief wins. The slider initialises at 100 ms. |
| R9, R10 | Updates are batched as `{ type, serverTime, pairs: PairUpdate[] }` rather than one message per pair as in the brief's example. | One frame per tick instead of five. Every element still carries `pair`, so R9 holds. The brief states the exact format is up to the implementer provided it is documented. |
| R10 | `bids`/`asks` are delivered only for pairs a client has subscribed to via `subscribeDepth`. | The watchlist renders no order book, so shipping five 20-level books at 10 Hz would be waste. The detail screen subscribes to one pair. |
| R11 | 24h high/low/volume are real (from the `@ticker` stream); market cap shown in the mockup is mocked from a static supply table. | Binance does not publish circulating supply. The brief permits mocked metadata. |
| R18 | Buy/sell pressure is derived as bid notional over total notional across the top 20 levels. | Binance does not publish a pressure metric; this is a standard order book imbalance proxy. |
