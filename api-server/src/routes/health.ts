import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getTranslationsCacheStatus, ensureTranslationsCache } from "../lib/translationsCache.js";

const router: IRouter = Router();

const SUPABASE_CHECK_MS = 800;

async function checkSupabaseLight(): Promise<"ok" | "degraded" | "unconfigured"> {
  if (!supabase) return "unconfigured";
  try {
    const query = supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("supabase_check_timeout")), SUPABASE_CHECK_MS);
    });
    const { error } = (await Promise.race([query, timeout])) as { error: { message?: string } | null };
    if (error) return "degraded";
    return "ok";
  } catch {
    return "degraded";
  }
}

router.get("/healthz", async (_req, res) => {
  // Warm translations cache on first health check if not loaded yet (non-fatal)
  try {
    ensureTranslationsCache();
  } catch {
    /* ensureTranslationsCache already handles errors internally */
  }

  const mem = process.memoryUsage();
  const translationsCache = getTranslationsCacheStatus();
  const supabaseStatus = await checkSupabaseLight();
  const degraded = supabaseStatus === "degraded";

  // Keep `status: "ok"` for backward compatibility with existing probes.
  res.json({
    status: "ok",
    degraded,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    node: process.version,
    environment: process.env["NODE_ENV"] ?? "(not set)",
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
    translationsCache,
    supabase: supabaseStatus,
  });
});

export default router;
