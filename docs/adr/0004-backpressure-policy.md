# ADR-0004: Skip frames for slow consumers, terminate after a sustained breach

**Status:** Accepted
**Requirements:** R6 (no unbounded memory growth from slow consumers), R32 (robust connections)

## Context

`ws` will buffer outbound frames in userland indefinitely. If a client stops draining its socket -
a phone that went to sleep, a debugger paused on a breakpoint, a congested mobile link - the server
accumulates frames for it at the emit rate, forever. One stalled client is enough to exhaust the
process.

The socket already tells us this is happening: `socket.bufferedAmount` is the count of bytes queued
but not yet flushed to the network. A client keeping up sits near zero. A client falling behind
climbs monotonically. It is a direct, per-connection backpressure signal, and it is free.

The question is what to do when it climbs. Four options were considered:

- **Queue per client, unbounded.** The default behaviour, and the failure R6 names.
- **Queue per client, bounded, dropping oldest.** Bounds memory, but needs a queue, a bound, and an
  eviction policy per connection - and it only makes sense if old frames have value, which after
  [ADR-0001](0001-conflation-buffer.md) they do not.
- **Terminate immediately on the first breach.** Bounds memory perfectly and is far too aggressive:
  a single GC pause or a brief tunnel would disconnect a perfectly healthy client.
- **Skip the frame, count the breach, terminate on a sustained one.** Chosen.

## Decision

`ws/clientRegistry.ts` checks each socket before every send:

1. If `bufferedAmount > MAX_BUFFERED_BYTES` (default 1 MB), **skip this frame for this client
   only**, increment its consecutive-skip counter, and record a `droppedFrames` stat. Every other
   client is sent the frame normally.
2. If the client is under budget, send and **reset** its counter to zero. Recovery is the normal
   case and should cost nothing.
3. If the counter reaches `MAX_CONSECUTIVE_SKIPS` (default 50 - five seconds at the default 100 ms
   interval), call `terminate()`. A client making no progress for five continuous seconds is gone,
   and `terminate()` rather than `close()` because a socket that is not draining will not complete a
   closing handshake either.

A separate 30-second ping/pong heartbeat runs alongside this, reaping half-open sockets: connections
that are gone but never sent a close frame. That is the normal failure mode on mobile networks, and
`bufferedAmount` does not detect it because nothing is being written.

## Consequences

**Skipping is safe, and that is entirely because of conflation.** The next tick carries current
state rather than the next item in a backlog, so a client that recovers is automatically back in
sync on the following frame with no resync protocol, no gap detection, and no server-side
per-client state beyond an integer. This is the payoff from ADR-0001 and the two decisions should be
read together.

**Server memory is bounded by the socket buffers it refuses to let grow**, so it stays `O(clients)`
with a constant ceiling each, independent of both client behaviour and message rate.

**Degradation is graceful and per-client.** A slow client receives a lower-frequency version of the
same stream rather than a stale one, and healthy clients are unaffected by its presence.

**The thresholds are guesses**, honestly. 1 MB and 50 ticks are reasonable defaults, not measured
optima. Both are environment variables, and `droppedFrames` and `terminatedClients` are exposed in
`/health` and the `stats` frame so the guess is observable rather than silent.

`ws/__tests__/clientRegistry.test.ts` covers the skip, the reset on recovery, the terminate, and -
most importantly - that a slow client's frames are skipped while a healthy client on the same tick
still receives its frame.

## What would change this

Paying customers with an SLA, where silently degrading a slow client is worse than telling it. Then
the answer is an explicit `{ type: "degraded" }` frame so the client can show its own warning, and
probably per-client emit cadences rather than a shared emitter.
