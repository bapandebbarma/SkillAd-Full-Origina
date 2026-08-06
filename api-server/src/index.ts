import "dotenv/config";

import type { Server } from "http";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? process.env["APP_PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  logger.warn({ rawPort }, "Invalid PORT value, falling back to 3000");
}

const listenPort = Number.isNaN(port) || port <= 0 ? 3000 : port;

const nodeEnv = process.env["NODE_ENV"] ?? "(not set)";
const trustProxy = app.get("trust proxy");

logger.info("Server starting...");
logger.info({ environment: nodeEnv }, `Environment: ${nodeEnv}`);
logger.info({ port: listenPort }, `Port: ${listenPort}`);
logger.info({ trustProxy }, `Trust Proxy: ${String(trustProxy)}`);

const SHUTDOWN_TIMEOUT_MS = 12_000;
let shuttingDown = false;
let server!: Server;

function logFatal(
  kind: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.fatal(
    {
      kind,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      err: error,
      ...extra,
    },
    kind,
  );
}

function shutdown(signal: string): void {
  if (shuttingDown) {
    logger.warn({ signal, timestamp: new Date().toISOString() }, "Shutdown already in progress");
    return;
  }
  shuttingDown = true;

  logger.info(
    { signal, timestamp: new Date().toISOString() },
    `Graceful shutdown started (${signal})`,
  );

  const forceTimer = setTimeout(() => {
    logFatal("shutdown_timeout", new Error(`Forced exit after ${SHUTDOWN_TIMEOUT_MS}ms`), {
      signal,
    });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  server.close((closeErr) => {
    if (closeErr) {
      logger.error(
        {
          signal,
          timestamp: new Date().toISOString(),
          message: closeErr.message,
          stack: closeErr.stack,
          err: closeErr,
        },
        "Error while closing HTTP server",
      );
      process.exit(1);
      return;
    }
    logger.info(
      { signal, timestamp: new Date().toISOString() },
      "HTTP server closed — exiting cleanly",
    );
    process.exit(0);
  });
}

// ── Process-level crash protection ───────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logFatal("uncaughtException", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const error =
    reason instanceof Error
      ? reason
      : new Error(typeof reason === "string" ? reason : JSON.stringify(reason));
  logFatal("unhandledRejection", error, {
    reason: reason instanceof Error ? undefined : reason,
  });
  process.exit(1);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── HTTP server ──────────────────────────────────────────────────────────────
server = app.listen(listenPort, "0.0.0.0", () => {
  logger.info({ port: listenPort, timestamp: new Date().toISOString() }, "Server listening");
});

// Request timeout protection (Phase 4) — hang forever prevention.
// 120s is above normal API latency; keep-alive / long polls are not used.
const SERVER_TIMEOUT_MS = 120_000;
server.requestTimeout = SERVER_TIMEOUT_MS;
server.headersTimeout = SERVER_TIMEOUT_MS + 5_000; // must exceed requestTimeout
server.timeout = SERVER_TIMEOUT_MS;
logger.info(
  {
    requestTimeoutMs: SERVER_TIMEOUT_MS,
    headersTimeoutMs: SERVER_TIMEOUT_MS + 5_000,
    socketTimeoutMs: SERVER_TIMEOUT_MS,
  },
  "HTTP server timeouts configured",
);

server.on("error", (err: NodeJS.ErrnoException) => {
  const code = err.code ?? "UNKNOWN";
  let detail = "HTTP server startup error";
  if (code === "EADDRINUSE") {
    detail = `Port ${listenPort} is already in use (EADDRINUSE)`;
  } else if (code === "EACCES") {
    detail = `Permission denied binding to port ${listenPort} (EACCES)`;
  }

  logger.fatal(
    {
      kind: "server_error",
      code,
      detail,
      timestamp: new Date().toISOString(),
      message: err.message,
      stack: err.stack,
      err,
    },
    detail,
  );
  process.exit(1);
});
