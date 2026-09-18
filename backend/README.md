# PulseCrypto gateway

Ingests Binance public market streams, conflates them per pair, and fans the result out over
WebSocket at a configurable interval.

The architecture, the buffering strategy and the wire protocol are documented once in the
[root README](../README.md) rather than duplicated here. This file is the operational summary.

## Run

```bash
npm install
npm run dev            # tsx watch, port 8080
npm run dev:synthetic  # SYNTHETIC_LOAD=1: ~2000 msg/s from a local generator, no Binance needed
npm run verify         # eslint --max-warnings 0 && tsc --noEmit && jest
npm run build && npm start
```

No configuration is required. Every value in [`.env.example`](.env.example) is the default
`src/config.ts` already applies; copy it to `.env` only to override something.

## Endpoints

| | |
|---|---|
| `ws://localhost:8080/stream` | `snapshot` on connect, then `update` every emit interval |
| `GET /pairs/meta` | display name, status, 24h high/low/volume per pair (R11) |
| `GET /health` | the same counters the Telemetry screen renders |

```bash
curl -s localhost:8080/health | jq .stats
```

## Layout

```
src/
  server.ts          port, WebSocket attach, graceful shutdown
  app.ts             builds the Express app, never calls listen()
  config.ts          the only reader of process.env, range-checked at boot
  binance/           upstreamClient, normalize, syntheticFeed   - ingest
  market/            marketStore, metrics, emitter              - conflate
  ws/                wsServer, clientRegistry                   - fan out
  routes/            pairs, health
  middleware/        errorHandler
  stats.ts           counters shared by /health and the stats frame
  types/protocol.ts  wire contract; copied into the app by mobile's sync:protocol
  utils/logger.ts
```

`binance/` ingests, `market/` conflates, `ws/` fans out, `routes/` is the REST surface on the side.

`types/protocol.ts` is the source of truth for the wire format and must not import anything - the
mobile app copies it verbatim.
