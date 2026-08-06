/**
 * Centralized Express error middleware (Phase 4).
 * Logs full details; returns a generic JSON body (no stack in production responses).
 */
import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  const isMulter = err instanceof multer.MulterError;

  logger.error(
    {
      kind: "unhandled_route_error",
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl?.split("?")[0] ?? req.url?.split("?")[0],
      message: error.message,
      name: error.name,
      code: isMulter ? (err as multer.MulterError).code : (err as { code?: string })?.code,
      stack: error.stack,
      err: error,
    },
    "Unhandled route error",
  );

  // Multer validation (size / unexpected field) — client error, not a 500
  if (isMulter) {
    const code = (err as multer.MulterError).code;
    const message =
      code === "LIMIT_FILE_SIZE"
        ? "File too large"
        : code === "LIMIT_UNEXPECTED_FILE"
          ? "Unexpected file field"
          : "Upload validation failed";
    res.status(400).json({ success: false, message });
    return;
  }

  // File-type filter from upload middleware
  if (error.message.includes("Only image files")) {
    res.status(400).json({ success: false, message: error.message });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
