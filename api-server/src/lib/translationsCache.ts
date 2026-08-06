/**
 * In-memory cache for data/translations.json (~1.17 MB).
 * Reads/parses from disk only on first use or explicit reload.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Bundled into dist/index.mjs at runtime — __dirname is dist/, so data is ../data
export const TRANSLATIONS_DATA_DIR = resolve(__dirname, "../data");
export const TRANSLATIONS_FILE = resolve(TRANSLATIONS_DATA_DIR, "translations.json");

export interface TranslationEntry {
  key: string;
  translations: Record<string, string>;
  updatedAt: string;
}

let cache: TranslationEntry[] | null = null;
let loadedAt: string | null = null;

function parseFromDisk(): TranslationEntry[] {
  if (!existsSync(TRANSLATIONS_FILE)) {
    throw new Error(`translations.json not found at ${TRANSLATIONS_FILE}`);
  }
  const raw = readFileSync(TRANSLATIONS_FILE, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("translations.json root must be an array");
  }
  return parsed as TranslationEntry[];
}

/**
 * Load cache from disk (first use / startup).
 * On failure: log, leave previous cache if any, otherwise empty array.
 */
export function ensureTranslationsCache(): TranslationEntry[] {
  if (cache !== null) return cache;

  try {
    cache = parseFromDisk();
    loadedAt = new Date().toISOString();
    logger.info(
      {
        kind: "translations_cache_loaded",
        timestamp: loadedAt,
        entries: cache.length,
        path: TRANSLATIONS_FILE,
      },
      "Translations cache loaded",
    );
  } catch (err) {
    logger.error(
      {
        kind: "translations_cache_load_failed",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        err,
      },
      "Failed to load translations.json — serving empty cache",
    );
    cache = [];
    loadedAt = new Date().toISOString();
  }

  return cache;
}

/**
 * Safe reload from disk. On failure, keeps the previous valid cache.
 * @returns true if cache was replaced with fresh disk data
 */
export function reloadTranslationsCache(): boolean {
  try {
    const fresh = parseFromDisk();
    cache = fresh;
    loadedAt = new Date().toISOString();
    logger.info(
      {
        kind: "translations_cache_reloaded",
        timestamp: loadedAt,
        entries: cache.length,
      },
      "Translations cache reloaded",
    );
    return true;
  } catch (err) {
    logger.error(
      {
        kind: "translations_cache_reload_failed",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        err,
        keptEntries: cache?.length ?? 0,
      },
      "Translations cache reload failed — keeping previous cache",
    );
    return false;
  }
}

/** Read path used by routes — same array shape as previous readAll(). */
export function getTranslations(): TranslationEntry[] {
  return ensureTranslationsCache();
}

/**
 * After a successful write to disk, update the in-memory cache
 * so GETs stay consistent without re-reading the file.
 */
export function replaceTranslationsCache(data: TranslationEntry[]): void {
  cache = data;
  loadedAt = new Date().toISOString();
}

export function getTranslationsCacheStatus(): {
  loaded: boolean;
  entries: number;
  loadedAt: string | null;
} {
  return {
    loaded: cache !== null,
    entries: cache?.length ?? 0,
    loadedAt,
  };
}
