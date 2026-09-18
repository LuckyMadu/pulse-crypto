# AI-assisted development

The brief asks how AI tools were used, and the job description names the skill twice. This document
is specific rather than enthusiastic: what the tooling was, what it got right, where it was
overridden, and what it got wrong that a human had to catch.

**Tooling:** Cursor with Claude, in agent mode, for essentially all of the implementation. The
Figma MCP server for design extraction. Bugbot for a review pass over the final diff.

The short version: AI wrote most of the code in this repository. The value was not in typing speed.
It was in front-loading the specification so the output stayed checkable, and in keeping the
architectural decisions with the human.

---

## 1. Spec-driven, because you cannot read all of it

The workflow was: **brief → numbered requirements → plan → implement → verify**, in that order, with
the first two written before any implementation.

[`docs/SPEC.md`](SPEC.md) turns the brief into 37 requirements (`R1` … `R37`), each with a one-line
acceptance criterion. It is mostly mechanical to produce from the brief and took about half an hour.
Every test name and every commit message then references the IDs it covers:

```ts
test("R6 terminates a client after a sustained backpressure breach", ...)
```

```
feat(backend): conflation buffer with dirty-set flush [R4,R5,R7]
```

Which makes coverage a query rather than a claim:

```bash
rg -o 'R\d+' backend/src mobile/src | sort -u    # what the code and tests cover
git log --oneline --grep 'R6'                     # what touched a requirement
```

This is the part worth generalising. When you write the code yourself, you verify by having written
it. When an agent writes it, that verification is gone and nothing replaces it by default - the
output arrives faster than you can read it, and reading all of it would cost more than writing it
would have. The spec is what restores a completeness check that runs in a second instead of an
afternoon. **Numbered requirements are cheap; they became worth doing at all only because an agent
was writing the code.**

The loop maps onto the full spec-driven cycle without ceremony: `SPEC.md` is requirements and
specification, the ADRs are architecture, the commits are implementation, the requirement IDs are
tests, and `npm run verify` plus Bugbot are review.

---

## 2. Context that is committed, not prompted

Three artifacts carry the standing context, so it does not have to be re-established in each
conversation and so it survives into the repository:

- **[`AGENTS.md`](../AGENTS.md)** - the invariants an agent must not break, stated as prohibitions
  because that is the form a violation takes: never dispatch tick data to Redux, never queue
  upstream messages, serialize each broadcast frame once.
- **`.cursor/rules/`** - nine rule files. Eight were adapted from an existing production React
  Native codebase (identity, architecture, styling, TypeScript, state management, performance,
  UI/UX, workflow), which is why the conventions here match a real team's. The ninth,
  `09-realtime.mdc`, was written for this project's streaming layer.
- **[`docs/SPEC.md`](SPEC.md)** - as above.

An invariant written into `AGENTS.md` is enforced on every subsequent turn. The same instruction in
a chat message is enforced until the context window rolls.

---

## 3. Where the AI was overridden

The most useful thing in this document, because it is where judgment shows.

### Redux for tick data

Asked where WebSocket market data should live, the first suggestion was a Redux slice with a
`marketDataReceived` action. That is the conventional answer, it is what most React Native
codebases do, and it would have failed R20 and R31 under load - fifty full store traversals a
second plus a wake-up for every `useSelector` in the tree, to change one number in one row.

Rejected in favour of the keyed external store in
[ADR-0002](adr/0002-external-store-for-ticks.md). The Telemetry screen's JS-thread FPS gauge exists
partly so the difference is observable rather than argued: under synthetic load it holds 60, and
under the Redux design it is the number that would visibly collapse.

Worth noting *why* the suggestion was reasonable. It is the correct default for 95% of app state,
and it is correct in this app for favourites and metadata. It was wrong only for the one case with
an update rate that breaks the assumption behind it - which is the kind of distinction a model
trained on the common case will not draw unprompted.

### A queue for the buffering requirement

"Buffer and/or batch incoming updates" first produced an array with a drain-on-tick loop. It reads
naturally and it is what the word *buffer* suggests. It also grows without bound whenever arrival
outpaces drain, which is the exact failure the next requirement asks us to prevent - the two
sentences in the brief are not independent, and treating them as one problem is what produced the
conflation map in [ADR-0001](adr/0001-conflation-buffer.md).

### A `services/` and `controllers/` layer for the backend

Asked for an Express structure, the model produced the standard MVC scaffold: `controllers/`,
`services/`, `models/`, `routes/`, `middleware/`. It is the shape of every Express tutorial and it
does not fit a streaming pipeline. Both route handlers here are about five lines that delegate
straight into `market/`, so a controller layer would have been indirection with no behaviour in it,
and `market/` already *is* the service layer.

Replaced with folders named after pipeline stages - `binance/` ingests, `market/` conflates, `ws/`
fans out - which makes the architecture legible from the directory listing. The `app.ts` /
`server.ts` split and `config.ts` were kept, because those conventions earn their place: the former
is what makes the routes testable with `supertest` and no port binding.

### Tests written after the fact

Offered generated tests for everything, which on a two-day exercise produces assertions that restate
the implementation and pass by construction. Scoped instead to the logic that is easy to get subtly
wrong and impossible to eyeball: memory boundedness under 10k updates, dirty-set flushing,
backpressure skip-and-terminate, the spread and pressure math, and the store's notification
isolation.

---

## 4. Where the AI caught things a human would have missed

The traffic runs both ways, and the honest version of this document says so.

**The synthetic feed had an aliasing bug.** Stream types were selected with `tick % 20` and
`tick % 500` while the pair was selected with `tick % pairs.length`. With five pairs, both moduli
are multiples of five, so certain pairs received `bookTicker` frames and *never* a `depth` or
`ticker` frame - BTCUSDT would have had no order book for the entire load demo. The failure is
invisible in aggregate statistics, which is exactly where a human eye stops. Found by asking for a
test that every pair receives every stream type, then fixed with a per-pair sequence counter.

**`normalizeFrame` would throw on `JSON.parse("null")`.** `typeof null === "object"`, so a null
check that only tested the type passed, and the next property access crashed the ingest handler.
Caught by a generated edge-case test over malformed upstream input (R33).

**The `@types` path alias was a latent trap.** The mobile `tsconfig` originally aliased `@types/*`,
which collides with TypeScript's reserved namespace for DefinitelyTyped packages. Renamed to
`@protocol`.

---

## 5. Design extraction via MCP

The mockup was a Figma file. Rather than eyeballing colours from screenshots, the Figma MCP server
was connected to read the file directly - node structure, layout, and the exact spacing and sizing
of the screens.

Two things did not work and are worth recording, because "we used MCP" is not useful information on
its own:

- **`get_variable_defs` returned nothing.** The file uses no Figma Variables, so there was no token
  system to import. Tokens were hand-authored from the style guide instead.
- **The style guide node is a flattened raster image**, not live layers. So the four nine-step
  tonal ramps in `src/design-system/tokens/colors.ts` were derived by pixel-sampling the exported
  PNG with a short script - accurate, and faster than reading hex codes off a screen.

The renders are committed in [`design/`](../design/) so the derivation is checkable against the
source.

---

## 6. Review gate

Every slice passes the same gate before it is committed:

```bash
npm run verify   # eslint --max-warnings 0 && tsc --noEmit && jest
```

in both packages, followed by one Bugbot pass over the diff before the final commit.

Zero-warning ESLint matters more with generated code than with hand-written code. A human writing an
unused variable notices while typing; an agent producing two hundred lines does not, and neither
does the reviewer skimming them. The gate is the thing that catches it, and it is also why the
`verify` script is a single command rather than three the author has to remember.

---

## 7. What this would look like on a real team

Three things here generalise, and one does not.

**Generalises:** requirement IDs threaded through tests and commits; invariants committed as
`AGENTS.md` rather than re-prompted; a single non-negotiable `verify` gate on every change.

**Does not generalise:** the volume of documentation. Six ADRs and a 37-line specification are
proportionate to an exercise that is being *assessed on its reasoning*. On a real two-day feature it
would be one ADR and a paragraph. Writing documents nobody reads is over-engineering wearing a
process costume, and it would be a poor lesson to take from this repository.
