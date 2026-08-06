import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { runSubscriptionExpiryCheck } from "./routes/subscriptions";
import { errorHandler } from "./middlewares/errorHandler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = resolve(__dirname, "../data/uploads");
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

// Auto-create upload subdirectories
for (const sub of ["profile", "services", "banners", "documents"]) {
  const p = resolve(UPLOADS_DIR, sub);
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

const app: Express = express();

// Hostinger / reverse proxy: trust one hop so req.ip uses X-Forwarded-For.
// Must be set before rate limiting (and any middleware that keys off client IP).
app.set("trust proxy", 1);

// ─── CORS ────────────────────────────────────────────────────────────────────
// Unconditionally allow all origins — security is enforced via x-admin-key header.
// This explicit middleware wins over any proxy/server-level interception (e.g. Apache).
const isDev = process.env["NODE_ENV"] !== "production";

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers["origin"] as string | undefined;
  res.setHeader("Access-Control-Allow-Origin", origin ?? "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key,Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-admin-key", "Authorization"],
  }),
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Strict limiter for auth routes — 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: () => isDev,
});

// General API limiter — 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: () => isDev,
});

// Contact form — max 5 submissions per IP per hour
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages. Please try again later." },
  skip: () => isDev,
});

// Simple request logger (no worker threads)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({ method: req.method, url: req.url?.split("?")[0], status: res.statusCode, ms: Date.now() - start });
  });
  next();
});

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Soft per-request idle timeout (complements HTTP server timeouts in index.ts).
// Does not abort handlers that finish within the limit; prevents hung sockets.
const REQUEST_TIMEOUT_MS = 120_000;
app.use((req: Request, res: Response, next: NextFunction) => {
  req.setTimeout(REQUEST_TIMEOUT_MS);
  res.setTimeout(REQUEST_TIMEOUT_MS);
  next();
});

// Apply rate limiting
app.use("/api/auth", authLimiter);
app.use("/api/contact", contactLimiter);
app.use("/api", apiLimiter);

// ── Root-level aliases — support APKs built without the /api prefix ──────────
// Rewrite /providers, /ads, /auth/*, etc. → /api/... BEFORE the router runs.
// Do NOT rewrite SPA / static paths (e.g. /provider/:id public profiles).
app.use((req: Request, res: Response, next: NextFunction) => {
  const p = req.path || "";
  if (p.startsWith("/api") || p === "/") {
    next();
    return;
  }
  if (
    p.startsWith("/provider") ||
    p.startsWith("/assets") ||
    p.startsWith("/favicon") ||
    p.startsWith("/icon") ||
    p.endsWith(".html") ||
    p.endsWith(".js") ||
    p.endsWith(".css") ||
    p.endsWith(".png") ||
    p.endsWith(".svg") ||
    p.endsWith(".webp") ||
    p.endsWith(".php")
  ) {
    next();
    return;
  }
  req.url = `/api${req.url}`;
  next();
});

// Serve uploads — flat root + all subdirectories
app.use("/api/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));
app.use("/api", router);

// Serve static files when PUBLIC_DIR is set (Hostinger deployment)
const PUBLIC_DIR = process.env["PUBLIC_DIR"];
if (PUBLIC_DIR && existsSync(PUBLIC_DIR)) {
  // Crawler-friendly OG HTML for shared provider links (before SPA fallback)
  app.get("/provider/:id", (req: Request, res: Response, next: NextFunction) => {
    const ua = req.headers["user-agent"] as string | undefined;
    // Dynamic import avoided — sync check inline
    const isBot =
      !!ua &&
      /(WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot)/i.test(
        ua,
      );
    if (!isBot) {
      next();
      return;
    }
    const id = encodeURIComponent(String(req.params["id"] ?? ""));
    res.redirect(302, `/api/providers/${id}/public/preview`);
  });

  app.use(express.static(PUBLIC_DIR));
  app.get("*", (_req, res) => {
    res.sendFile(resolve(PUBLIC_DIR, "index.html"));
  });
}

// Centralized error middleware — must be registered after all routes.
// Express 5 forwards rejected promises from async handlers here automatically.
app.use(errorHandler);

// ─── Subscription expiry scheduler ──────────────────────────────────────────
// Run on boot and then every hour to check for expiring/expired subscriptions
try {
  runSubscriptionExpiryCheck();
} catch (err) {
  logger.error(
    {
      kind: "subscription_expiry_boot",
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      err,
    },
    "Subscription expiry check failed on boot",
  );
}
setInterval(() => {
  try {
    runSubscriptionExpiryCheck();
  } catch (err) {
    logger.error(
      {
        kind: "subscription_expiry_interval",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        err,
      },
      "Subscription expiry check failed",
    );
  }
}, 60 * 60 * 1000);

export default app;
