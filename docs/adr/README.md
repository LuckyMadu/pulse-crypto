# Architecture Decision Records

Six decisions that were genuinely contested - where a competent engineer could reasonably have gone
the other way, and where the reasoning is worth more than the outcome. Decisions with only one
sensible answer are not recorded here; that would be paperwork rather than documentation.

| ADR | Decision | Requirements |
|-----|----------|--------------|
| [0001](0001-conflation-buffer.md) | Conflate upstream messages into a per-pair snapshot instead of queueing them | R4, R6, R7 |
| [0002](0002-external-store-for-ticks.md) | Hold streaming ticks in a keyed external store rather than Redux | R20, R30, R31 |
| [0003](0003-partial-depth-stream.md) | Use `@depth20@100ms` as authoritative instead of reconciling a full order book | R3, R18 |
| [0004](0004-backpressure-policy.md) | Skip frames for slow consumers and terminate after a sustained breach | R6, R32 |
| [0005](0005-bare-react-native.md) | Bare React Native rather than Expo | R20, R16 |
| [0006](0006-telemetry-as-evidence.md) | Build the mockup's Telemetry screen as live instrumentation | R20, R30, R31 |

Format is deliberately short: context, decision, consequences, and what would change the answer.
The last section is the one that matters - a decision recorded without its expiry conditions is an
opinion.
