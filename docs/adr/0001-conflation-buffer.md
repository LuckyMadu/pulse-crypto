# ADR-0001: Conflate upstream messages into a per-pair snapshot

**Status:** Accepted
**Requirements:** R4 (buffer/batch), R6 (no unbounded growth), R7 (explain the strategy)

## Context

The brief asks the gateway to "buffer and/or batch" incoming updates and emit at a configurable
interval, and separately to "prevent slow consumers from causing unbounded memory growth". Those two
sentences are usually read as independent, and they are not: the buffering strategy chosen for the
first determines whether the second is even achievable.

Binance delivers roughly 50 messages a second across the five pairs on a quiet day, arriving from
three streams with very different cadences - `@bookTicker` many times a second, `@depth20@100ms` ten
times a second, `@ticker` roughly once. The emit interval defaults to 100 ms.

The obvious implementation is a queue: push arriving messages onto an array, drain it on each tick.
It reads naturally and it is what "buffer" suggests. It is also wrong in a way that only appears
under load. If the arrival rate exceeds the drain rate for any sustained period - a burst, a slow
GC pause, an event loop blocked by a large `JSON.stringify` - the array grows, and nothing in the
design bounds it. That is unbounded memory growth arriving from the *upstream* side, which is the
harder one to notice because R6 phrases the risk as coming from clients.

## Decision

**Never queue upstream messages. Overwrite them.**

`market/marketStore.ts` holds exactly one mutable snapshot per trading pair, plus a set of pairs
touched since the last flush:

```ts
Map<string, MutableSnapshot>   // five entries, forever
Set<string>                    // dirty pairs
```

An arriving message writes its fields into that pair's snapshot and marks the pair dirty. A hundred
messages for `BTCUSDT` inside one 100 ms window produce a hundred writes and one dirty entry. The
emitter drains the dirty set on each tick, serializes only those pairs, and clears it.

Conflation is per *field*, not per message, so an emitted frame carries only what actually changed
rather than a full re-statement of the pair. That falls out of the three streams moving at different
rates.

## Consequences

**Memory is `O(pairs)`, not `O(messages)`.** Not "bounded in practice" - structurally incapable of
growing with the message rate. `market/__tests__/marketStore.test.ts` asserts it across 10,000
ingested updates.

**Intermediate ticks are unrecoverable.** This is the real cost and it should be stated as one. For
a price display it is not a compromise at all: the newest value fully supersedes the previous one,
and there is no information in the eleven prices skipped that the twelfth does not carry. For a
trade tape, an audit log, or anything needing sequence integrity, this design would be
disqualifying.

**Slow-consumer handling gets much simpler** (see [ADR-0004](0004-backpressure-policy.md)). Because
the next tick always carries current state rather than the next item in a backlog, a client whose
frame was skipped resyncs automatically on the following tick. A queueing design would have to
choose between replaying history nobody wants and dropping from the middle of a sequence.

**The conflation ratio becomes a demonstrable number.** Under `SYNTHETIC_LOAD=1`, ingestion runs at
~2000/s while the emit rate stays at 10/s - a 200:1 collapse, visible on the Telemetry screen and in
`/health`.

## What would change this

Any requirement for sequence integrity: trade-by-trade history, order execution, replay after
reconnect, or an audit trail. At that point the correct shape is a bounded ring buffer with an
explicit overflow policy, and the client needs to detect and repair gaps - substantially more
machinery, justified only by a requirement that does not exist here.
