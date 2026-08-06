/**
 * Lightweight in-memory TTL + static file caches for Phase 3B hot endpoints.
 * Does not change response shapes — callers must compute identical payloads.
 */
import { logger } from "./logger.js";

const TTL_MS = 90_000; // 90s — within 60–300s guidance

export const ENDPOINT_TTL_MS = TTL_MS;

export const CACHE_KEYS = {
  CITIES: "endpoint:cities",
  ACTIVITY_LIVE: "endpoint:activity/live",
  CATEGORIES: "endpoint:categories",
  STATS: "endpoint:stats",
} as const;

/** Static JSON file keys (plans / settings / content) — held until write invalidates. */
export const JSON_FILE_KEYS = {
  PLANS: "plans",
  SETTINGS: "settings",
  CONTENT: "content",
} as const;

interface TtlEntry {
  value: unknown;
  expiresAt: number;
}

const ttlStore = new Map<string, TtlEntry>();
const jsonFileStore = new Map<string, unknown>();

export function getTtlCache<T>(key: string): T | undefined {
  const entry = ttlStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    ttlStore.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setTtlCache(key: string, value: unknown, ttlMs: number = TTL_MS): void {
  ttlStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateTtlCache(key: string): void {
  if (ttlStore.delete(key)) {
    logger.debug({ kind: "ttl_cache_invalidate", key }, "ttl cache invalidated");
  }
}

export function invalidateTtlCaches(keys: string[]): void {
  for (const key of keys) invalidateTtlCache(key);
}

/**
 * Return cached value if fresh; otherwise run factory, store, return.
 * Failed factories are not cached.
 */
export async function getOrSetTtlAsync<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs: number = TTL_MS,
): Promise<T> {
  const hit = getTtlCache<T>(key);
  if (hit !== undefined) return hit;

  const value = await factory();
  setTtlCache(key, value, ttlMs);
  logger.debug({ kind: "ttl_cache_miss", key, ttlMs }, "ttl cache filled");
  return value;
}

// ── Static JSON file cache (plans / settings / content) ───────────────────────

export function getCachedJsonFile<T>(name: string): T | undefined {
  if (!jsonFileStore.has(name)) return undefined;
  return jsonFileStore.get(name) as T;
}

/** Deep clone so route handlers that mutate objects cannot corrupt the cache. */
export function getCachedJsonFileClone<T>(name: string): T | undefined {
  const cached = getCachedJsonFile<T>(name);
  if (cached === undefined) return undefined;
  return JSON.parse(JSON.stringify(cached)) as T;
}

export function setCachedJsonFile(name: string, data: unknown): void {
  jsonFileStore.set(name, data);
  logger.debug({ kind: "json_file_cache_set", name }, "static json cache updated");
}

export function invalidateJsonFileCache(name: string): void {
  if (jsonFileStore.delete(name)) {
    logger.debug({ kind: "json_file_cache_invalidate", name }, "static json cache invalidated");
  }
}

const CACHED_JSON_FILES = new Set<string>([
  JSON_FILE_KEYS.PLANS,
  JSON_FILE_KEYS.SETTINGS,
  JSON_FILE_KEYS.CONTENT,
]);

export function isCachedJsonFile(name: string): boolean {
  return CACHED_JSON_FILES.has(name);
}

/** After admin writes that affect aggregate endpoints. */
export function invalidateLandingAggregates(): void {
  invalidateTtlCaches([
    CACHE_KEYS.CITIES,
    CACHE_KEYS.ACTIVITY_LIVE,
    CACHE_KEYS.CATEGORIES,
    CACHE_KEYS.STATS,
  ]);
}

export function invalidateCategoryDependentCaches(): void {
  invalidateTtlCaches([
    CACHE_KEYS.CATEGORIES,
    CACHE_KEYS.STATS,
    CACHE_KEYS.ACTIVITY_LIVE,
  ]);
}
