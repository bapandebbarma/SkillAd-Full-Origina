import { Router, type Request, type Response, type NextFunction } from "express";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { logger } from "../lib/logger.js";
import {
  TRANSLATIONS_DATA_DIR,
  TRANSLATIONS_FILE,
  type TranslationEntry,
  getTranslations,
  replaceTranslationsCache,
  reloadTranslationsCache,
} from "../lib/translationsCache.js";

// Re-export for any internal callers / tests
export type { TranslationEntry };
export { reloadTranslationsCache };

const router = Router();

function readAll(): TranslationEntry[] {
  return getTranslations();
}

function writeAll(data: TranslationEntry[]): void {
  if (!existsSync(TRANSLATIONS_DATA_DIR)) mkdirSync(TRANSLATIONS_DATA_DIR, { recursive: true });
  writeFileSync(TRANSLATIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
  // Keep memory cache in sync with disk after successful write
  replaceTranslationsCache(data);
}

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const key = process.env["ADMIN_KEY"] ?? "skillad-admin";
  if (req.headers["x-admin-key"] !== key) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ── GET /api/admin/translations — all entries (admin panel) ──────────────────
router.get("/admin/translations", adminAuth, (_req, res) => {
  res.json(readAll());
});

// ── GET /api/translations — all entries (public / mobile use) ─────────────────
router.get("/translations", (_req, res) => {
  res.json(readAll());
});

// ── GET /api/translations/:language — flat key→value map for one language ────
// Falls back to English value for each key if the language translation is missing.
router.get("/translations/:language", (req, res) => {
  const lang = decodeURIComponent(req.params.language ?? "");
  const all = readAll();
  const result: Record<string, string> = {};
  for (const entry of all) {
    const val = entry.translations[lang] ?? entry.translations["English"] ?? "";
    if (val) result[entry.key] = val;
  }
  res.json(result);
});

// ── POST /api/admin/translations — create a new key ───────────────────────────
router.post("/admin/translations", adminAuth, (req, res) => {
  const { key, translations = {} } = req.body as { key?: string; translations?: Record<string, string> };
  if (!key || typeof key !== "string" || !key.trim()) {
    res.status(400).json({ error: "key is required" });
    return;
  }
  const trimmed = key.trim();
  const all = readAll();
  if (all.some((e) => e.key === trimmed)) {
    res.status(409).json({ error: `Key "${trimmed}" already exists` });
    return;
  }
  const entry: TranslationEntry = {
    key: trimmed,
    translations: translations as Record<string, string>,
    updatedAt: new Date().toISOString(),
  };
  all.push(entry);
  writeAll(all);
  logger.info({ key: trimmed }, "translations: key created");
  res.status(201).json(entry);
});

// ── PUT /api/admin/translations/:key — update translations for a key ──────────
router.put("/admin/translations/:key", adminAuth, (req, res) => {
  const k = req.params.key ?? "";
  const { translations } = req.body as { translations?: Record<string, string> };
  if (!translations || typeof translations !== "object") {
    res.status(400).json({ error: "translations object is required" });
    return;
  }
  const all = readAll();
  const idx = all.findIndex((e) => e.key === k);
  if (idx === -1) {
    res.status(404).json({ error: `Key "${k}" not found` });
    return;
  }
  all[idx] = {
    ...all[idx],
    translations: { ...(all[idx].translations), ...translations },
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
  logger.info({ key: k }, "translations: key updated");
  res.json(all[idx]);
});

// ── DELETE /api/admin/translations/:key ───────────────────────────────────────
router.delete("/admin/translations/:key", adminAuth, (req, res) => {
  const k = req.params.key ?? "";
  const all = readAll();
  const idx = all.findIndex((e) => e.key === k);
  if (idx === -1) {
    res.status(404).json({ error: `Key "${k}" not found` });
    return;
  }
  all.splice(idx, 1);
  writeAll(all);
  logger.info({ key: k }, "translations: key deleted");
  res.json({ ok: true });
});

// ── POST /api/admin/translations/import — bulk import (merge) ─────────────────
// Body: array of TranslationEntry objects. Merges language values into existing keys.
// New keys are created. Existing keys have their language values merged (not replaced).
router.post("/admin/translations/import", adminAuth, (req, res) => {
  const incoming = req.body as TranslationEntry[];
  if (!Array.isArray(incoming)) {
    res.status(400).json({ error: "Body must be an array of translation entries" });
    return;
  }
  const all = readAll();
  const map = new Map(all.map((e) => [e.key, e]));
  let created = 0;
  let updated = 0;
  for (const entry of incoming) {
    if (!entry.key) continue;
    const existing = map.get(entry.key);
    if (existing) {
      existing.translations = { ...existing.translations, ...entry.translations };
      existing.updatedAt = new Date().toISOString();
      updated++;
    } else {
      map.set(entry.key, { key: entry.key, translations: entry.translations ?? {}, updatedAt: new Date().toISOString() });
      created++;
    }
  }
  const result = Array.from(map.values());
  writeAll(result);
  logger.info({ created, updated }, "translations: bulk import done");
  res.json({ ok: true, created, updated, total: result.length });
});

export default router;
