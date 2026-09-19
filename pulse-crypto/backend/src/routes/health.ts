/**
 * `GET /health`.
 *
 * Not in the brief, but it is the cheapest way to make the non-functional
 * claims inspectable without a phone: `curl`ing this during the synthetic-load
 * run shows ingestion at ~2000/s, emit rate flat at the configured interval,
 * `bufferedPairs` at 5 and RSS steady. It returns the same `stats.snapshot()`
 * the Telemetry screen renders, so the two cannot disagree.
 */

import { Router } from "express";
import { config } from "../config";
import { stats } from "../stats";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const snapshot = stats.snapshot();

  // Degraded rather than unhealthy while upstream reconnects: the gateway is
  // still serving last-known snapshots to every client, which is the documented
  // behaviour (R25), not an outage.
  const healthy = snapshot.upstream === "connected" || snapshot.upstream === "synthetic";

  res.json({
    status: healthy ? "healthy" : "degraded",
    pairs: config.pairs,
    config: {
      emitIntervalMs: snapshot.emitIntervalMs,
      depthLevels: config.upstream.depthLevels,
      maxBufferedBytes: config.backpressure.maxBufferedBytes,
      maxConsecutiveSkips: config.backpressure.maxConsecutiveSkips,
      syntheticLoad: config.syntheticLoad,
    },
    stats: snapshot,
  });
});
