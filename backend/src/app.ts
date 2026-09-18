/**
 * Builds the Express app and **does not** call `listen()`.
 *
 * That split is the one convention from the standard Express layout worth
 * keeping verbatim, because it is what makes the REST surface testable:
 * `supertest(createApp())` drives the routes in-process with no port binding,
 * so test files cannot collide on a port and cannot leak an open handle that
 * keeps Jest alive after the suite passes. `server.ts` owns the port, the
 * WebSocket attach and shutdown.
 */

import cors from "cors";
import express, { Express } from "express";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { healthRouter } from "./routes/health";
import { pairsRouter } from "./routes/pairs";

export const createApp = (): Express => {
  const app = express();

  // The RN debug client is an arbitrary origin (`http://localhost:8081` on
  // Android, a device IP on iOS), and this gateway serves only public market
  // data with no credentials, so a permissive CORS policy costs nothing. A real
  // deployment would allowlist.
  app.use(cors());
  app.use(express.json({ limit: "16kb" }));

  app.use(healthRouter);
  app.use("/pairs", pairsRouter);

  // Order matters and is easy to get wrong: 404 must be registered after every
  // route, and the error handler must be last or Express treats it as a
  // four-argument middleware and never calls it.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
