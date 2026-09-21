# AGENTS.md

Operating instructions for AI agents working in this repository. Written to be
read by an agent before it edits anything, and by a human who wants to know what
the agent was told.

## What this project is

A real-time cryptocurrency market data system in two parts:

- `pulse-crypto/backend/` - an Express 5 + `ws` gateway that ingests Binance market streams,
  **conflates** them into one snapshot per pair, and fans out to mobile clients
  on a fixed interval.
- `pulse-crypto/mobile/` - a React Native CLI 0.86 app that renders a watchlist, a trading
  terminal and a telemetry screen.

Everything outside `pulse-crypto/` is written deliverable rather than code: `docs/`
holds the spec, the ADRs and the AI usage log, and `design/` holds the Figma
renders the design system was derived from.

`docs/SPEC.md` is the requirements document. Every requirement has an ID
(`R1`...`R37`). **Reference those IDs in test names and commit messages.**

## Invariants - do not break these

These are the load-bearing decisions. If a change appears to require breaking
one, stop and raise it rather than working around it.

1. **Never put streaming tick data in Redux.**
   Ticks arrive at 10 Hz for five pairs. A Redux dispatch per tick runs every
   reducer and wakes every `useSelector` in the tree. Tick data lives in
   `pulse-crypto/mobile/src/realtime/marketStore.ts`, a keyed external store read through
   `useSyncExternalStore`, so only the components subscribed to the pair that
   changed re-render. Redux holds metadata (RTK Query) and favourites only.

2. **Never buffer upstream messages in a queue.**
   `pulse-crypto/backend/src/market/marketStore.ts` holds exactly one mutable snapshot per
   pair. Memory is `O(pairs)`, independent of message rate and client count.
   Adding a queue reintroduces the unbounded growth the design exists to
   prevent (R6).

3. **Never call `JSON.stringify` per client in the fan-out path.**
   Serialize once per distinct depth-subscription group and reuse the string.
   See `pulse-crypto/backend/src/market/emitter.ts`.

4. **Never clear the market store on disconnect.**
   R25 requires the app keeps showing the last received data when the backend
   goes away. The store is keyed state, not a session cache.

5. **`config.ts` is the only module that reads `process.env`** (backend) and
   `pulse-crypto/mobile/src/config/index.ts` the only one that hardcodes hosts.

6. **`logger` is the only sanctioned output sink.** `no-console` is an error
   everywhere except `utils/logger.ts`. This is enforced by ESLint.

## Conventions

- **TypeScript strict.** `any` is an ESLint error in both packages. Prefer
  `unknown` plus a narrowing guard for untrusted input - see `isClientMessage`.
- **Double quotes, trailing commas, arrow parens avoided.** Prettier decides;
  do not hand-format.
- **Tests colocate** in `__tests__/` next to the unit under test.
- **Test names start with the requirement ID** they cover:
  `it("R6 skips the frame instead of queueing it when over the send budget")`.
- **No inline styles and no colour literals in React Native components.** Both
  are ESLint errors. Colours come from the design system tokens.
- **Styles live in an `X.styles.ts` sibling**, never in the component file. The
  file exports a `styles` object plus, where a style varies by prop, one
  pre-registered entry per variant - `toneStyles`, `sideStyles`, `levelStyles`.
- **Those style objects are static, built once at module load.** Do *not*
  introduce the `const styles = createStyles(theme)` pattern. The app has no
  runtime theme to parameterise on, and calling `StyleSheet.create` in a render
  body would run it on every tick in components like `OrderBookRow` and
  `MarketRow`. A style that varies by prop gets a registered variant; one that
  varies by a genuinely dynamic value gets `useMemo`.
- **Pure logic does not live in components.** Anything a component *computes*
  rather than renders belongs in `features/<name>/domain/`, colocated with its
  tests - the mobile counterpart to the backend's `market/metrics.ts`. The
  order book projection and the telemetry scales are the worked examples.
- **Design tokens are not negotiable ad hoc.**
  `pulse-crypto/mobile/src/design-system/tokens` is generated from the Figma
  style guide. Add a semantic alias rather than a new hex value. Geometry
  belonging to one hand-drawn glyph is the exception and stays a local
  constant in that component's `.styles.ts` - nothing else can reuse a
  magnifier's lens diameter.

## Commands

```bash
# backend
cd pulse-crypto/backend
npm run dev              # tsx watch, live reload
npm run dev:synthetic    # SYNTHETIC_LOAD=1, ~2000 msg/s generated
npm run verify           # lint (0 warnings) + tsc --noEmit + jest
npm test

# mobile
cd pulse-crypto/mobile
npm start                # metro
npm run android          # requires an emulator already running
npm run verify
npm run sync:protocol    # copy backend/src/types/protocol.ts -> mobile
```

`npm run verify` is the gate. Run it before claiming a change is done; a change
that has not passed it is not finished.

## The protocol contract

`pulse-crypto/backend/src/types/protocol.ts` is the source of truth and is **copied**
into `pulse-crypto/mobile/src/types/protocol.ts` by `npm run sync:protocol`. The copy carries a
"generated, do not edit" header.

If you change the wire format: edit the backend copy, run the sync script,
update the payload documentation in `README.md`, and update
`docs/SPEC.md` if the change affects an acceptance criterion.

## Things that are deliberately absent

Do not add these; their absence is an argued decision, documented in the README.

- No full Binance order book reconciliation (REST snapshot + `U`/`u` diff
  replay). `@depth20@100ms` is authoritative for a top-20 display.
- No Redis, Kafka, or horizontal scaling. Single process, in-memory.
- No auth, no database, no Docker, no GraphQL.
- No Settings screen implementation and no side drawer, despite both appearing
  in the mockup - they are account features with no backing service.
- No blanket test coverage. Targeted tests on the risky logic only.

## When you are unsure

Prefer the option that is easier to delete. This is a two-day exercise being
assessed on architectural judgement, and an unnecessary abstraction costs more
than a missing one.
