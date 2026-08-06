/**
 * Shared Vite API base for all admin-panel configs.
 * Single env var: VITE_API_BASE (never VITE_API_BASE_URL).
 *
 * Env value is the API origin (e.g. https://api.skillad.in), with or without /api.
 * What gets baked into `__API_BASE__` always ends with `/api` for production builds.
 *
 * - Production build: "https://api.skillad.in/api"
 * - Dev server: "" → client uses relative "/api" (Vite proxy → localhost:3000)
 */
export const DEFAULT_API_ORIGIN = "https://api.skillad.in";

/** Normalize to origin only (no trailing slash, no /api suffix). */
export function normalizeApiOrigin(raw: string): string {
  return raw.trim().replace(/\/$/, "").replace(/\/api$/i, "");
}

/**
 * Value baked into `__API_BASE__` (full path including `/api`, or "" for relative).
 */
export function resolveViteApiBase(command: "build" | "serve"): string {
  const fromEnv = process.env["VITE_API_BASE"];
  let origin = "";
  if (fromEnv && fromEnv.trim()) {
    origin = normalizeApiOrigin(fromEnv);
  } else if (command === "build") {
    origin = DEFAULT_API_ORIGIN;
  } else {
    return "";
  }
  return `${origin}/api`;
}
