# ADR-0003: Use `@depth20@100ms` as authoritative, rather than reconciling a full order book

**Status:** Accepted
**Requirements:** R3 (ingest order book updates), R18 (live order book on the detail screen)

## Context

Binance offers two ways to obtain order book data, and they solve different problems.

**Partial depth** (`btcusdt@depth20@100ms`) pushes the top 20 levels of each side, already sorted,
every 100 ms. It is self-contained: each message is a complete picture of the top of the book, so a
client can render it with no prior state.

**Diff depth** (`btcusdt@depth@100ms`) pushes incremental changes with `U` and `u` sequence numbers.
Using it correctly means fetching a REST snapshot, buffering diffs that arrive while the snapshot is
in flight, discarding diffs older than the snapshot, verifying that the first applied diff's `U` is
less than or equal to `lastUpdateId + 1`, applying each subsequent diff only if `U` equals the
previous `u + 1`, and restarting the whole procedure from a fresh snapshot on any gap. That is the
documented algorithm, and every step exists because skipping it produces a book that is subtly wrong
rather than obviously broken.

The second approach is what a real exchange client does, and it is a visible piece of engineering -
which is exactly why it is worth being explicit about not doing it.

## Decision

Subscribe to `@depth20@100ms` and treat each message as authoritative for the top 20 levels.

`market/marketStore.ts` replaces the stored book wholesale on each message rather than merging into
it. There is no sequence tracking, no REST snapshot, and no gap recovery, because none of those
concepts apply when every message is complete.

## Consequences

**The book is correct for what is displayed.** The detail screen renders the top levels. Partial
depth *is* the correct source for that, not an approximation of it.

**Depth beyond 20 levels is unavailable**, and the cumulative depth chart is therefore drawn from
the top 20 rather than the whole book. For a mobile display this is the right amount of data; the
chart is a shape, not a liquidity model.

**A gap in the stream is self-healing.** A dropped message costs one 100 ms frame and the next
message is a complete replacement. Under diff depth, the same dropped message silently corrupts the
book until a gap check catches it and forces a full resnapshot.

**It composes with conflation.** A whole-book replacement is idempotent, so
[ADR-0001](0001-conflation-buffer.md)'s overwrite semantics apply to the book exactly as they do to
the price. Diff depth would not conflate - every diff would have to be applied in order, which would
have forced a queue and undermined the memory bound.

**It is honest about scope.** Full order book reconciliation matters for execution: sizing an order,
estimating slippage, or anything where a wrong level costs money. This app displays prices.

## What would change this

Order placement, slippage estimation, or depth display beyond 20 levels. At that point the full
reconciliation algorithm is mandatory and the queue-versus-conflate decision in ADR-0001 has to be
revisited alongside it, since diffs cannot be conflated.
