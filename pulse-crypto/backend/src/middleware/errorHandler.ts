/**
 * The central error funnel (R33).
 *
 * Express 5 forwards rejections from async handlers here automatically, which
 * is the main reason this project is on 5 rather than 4 - on 4 every async
 * route needs an `asyncHandler` wrapper or the rejection escapes to
 * `unhandledRejection` and the request hangs until the client times out.
 *
 * Two behaviours worth stating: the stack is logged but never serialized to the
 * client, and the response shape is identical for 404 and 500 so a client has
 * one error contract to parse.
 */

import { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../utils/logger";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: "not_found",
    message: `${req.method} ${req.originalUrl} is not a route on this gateway`,
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const message = error instanceof Error ? error.message : "unknown error";

  logger.error(`[http] ${req.method} ${req.originalUrl} failed: ${message}`, {
    stack: error instanceof Error ? error.stack : undefined,
  });

  // A response already streaming cannot be replaced with an error body; all
  // that is left is to destroy the socket so the client sees a failure rather
  // than a truncated success.
  if (res.headersSent) {
    res.end();
    return;
  }

  res.status(500).json({
    error: "internal_error",
    message: "The gateway failed to handle this request.",
  });
};
