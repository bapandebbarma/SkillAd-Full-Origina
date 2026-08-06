/**
 * Shared Vite API origin for all landing-page configs.
 * Single env var: VITE_API_BASE (never VITE_API_BASE_URL).
 *
 * Landing paths already include `/api/...` (e.g. "/api/stats").
 * What gets baked into `__API_BASE__` is the origin only:
 *
 * - Production build: "https://api.skillad.in"
 *   → apiUrl("/api/stats") = "https://api.skillad.in/api/stats"
 * - Dev server: "" → relative "/api/..." (Vite proxy → localhost:3000)
 */
export const DEFAULT_API_ORIGIN = "https://api.skillad.in";

/** Normalize to origin only (no trailing slash, no /api suffix). */
export function normalizeApiOrigin(raw: string): string {
  return raw.trim().replace(/\/$/, "").replace(/\/api$/i, "");
}

/**
 * Value baked into `__API_BASE__` (API origin, or "" for relative /api in dev).
 */
export function resolveViteApiBase(command: "build" | "serve"): string {
  const fromEnv = process.env["VITE_API_BASE"];
  if (fromEnv && fromEnv.trim()) {
    return normalizeApiOrigin(fromEnv);
  }
  if (command === "build") {
    return DEFAULT_API_ORIGIN;
  }
  return "";
}
