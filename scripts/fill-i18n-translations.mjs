#!/usr/bin/env node
/**
 * Low-memory resume for SkillAd i18n fill.
 * - Reuses scripts/.i18n-translate-cache.json
 * - Processes one language at a time in small batches
 * - Only fills missing / English-fallback cells
 * - Never overwrites existing non-English translations
 * - Saves translations.json + cache every SAVE_EVERY cells
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JSON_PATH = path.join(ROOT, "api-server/data/translations.json");
const CACHE_PATH = path.join(ROOT, "scripts/.i18n-translate-cache.json");

const CONCURRENCY = 12;
const BATCH_SIZE = 20;
const SAVE_EVERY = 100;
const REPORT_EVERY = 500;

const LANGS = [
  "Assamese", "Bengali", "Bodo", "Dogri", "Gujarati", "Hindi", "Kannada",
  "Kashmiri", "Kokborok", "Konkani", "Maithili", "Malayalam", "Manipuri",
  "Marathi", "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali", "Sindhi",
  "Tamil", "Telugu", "Urdu",
];

const LANG_CODE = {
  Assamese: "as", Bengali: "bn", Bodo: "hi", Dogri: "hi", Gujarati: "gu",
  Hindi: "hi", Kannada: "kn", Kashmiri: "ur", Kokborok: "bn", Konkani: "mr",
  Maithili: "hi", Malayalam: "ml", Manipuri: "bn", Marathi: "mr", Nepali: "ne",
  Odia: "or", Punjabi: "pa", Sanskrit: "sa", Santali: "hi", Sindhi: "sd",
  Tamil: "ta", Telugu: "te", Urdu: "ur",
};

const PROTECT = [
  "SkillAd", "WhatsApp", "App Store", "Google Play", "OTP", "GPS",
  "Android", "iOS", "API", "URL", "Email", "SMS",
];

const PLACEHOLDER_RE = /(\{\{?[a-zA-Z_][\w]*\}?\}|%[sd]|\{[a-zA-Z_][\w]*\})/g;

function isIntentionalEnglish(en) {
  const t = String(en).trim();
  if (!t) return true;
  if (PROTECT.some((b) => b === t)) return true;
  if (/^(OK|ID|SMS|OTP|GPS|API|URL|Email|WhatsApp|SkillAd|iOS|Android)$/i.test(t)) return true;
  if (/^[\W\d_]+$/u.test(t)) return true;
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadJson() {
  return JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveJson(data) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
}

function protectText(text) {
  const tokens = [];
  let out = text;
  out = out.replace(PLACEHOLDER_RE, (m) => {
    const i = tokens.length;
    tokens.push(m);
    return `⟦P${i}⟧`;
  });
  const brands = [...PROTECT].sort((a, b) => b.length - a.length);
  for (const brand of brands) {
    const re = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    out = out.replace(re, () => {
      const i = tokens.length;
      tokens.push(brand);
      return `⟦P${i}⟧`;
    });
  }
  return { out, tokens };
}

function restoreText(text, tokens) {
  let out = text;
  for (let i = 0; i < tokens.length; i++) {
    out = out.split(`⟦P${i}⟧`).join(tokens[i]);
    out = out.split(`[P${i}]`).join(tokens[i]);
  }
  return out;
}

async function gtxTranslate(text, tl) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
    encodeURIComponent(tl) +
    "&dt=t&q=" +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.[0])) throw new Error("bad response");
  return data[0].map((row) => row[0]).join("");
}

async function translateOne(english, lang, cache) {
  const cacheKey = `${lang}::${english}`;
  if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) {
    return { value: cache[cacheKey], fromCache: true };
  }

  const { out: protectedText, tokens } = protectText(english);
  const code = LANG_CODE[lang] || "hi";
  let translated;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      translated = await gtxTranslate(protectedText, code);
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(300 * (attempt + 1));
    }
  }
  translated = restoreText(translated, tokens);
  if (!translated || !translated.trim()) translated = english;
  cache[cacheKey] = translated;
  return { value: translated, fromCache: false };
}

function countRemaining(data) {
  let n = 0;
  for (const entry of data) {
    const en = entry.translations?.English;
    if (en == null) continue;
    for (const lang of LANGS) {
      const v = entry.translations[lang];
      if (v == null || v === "" || v === en) n++;
    }
  }
  return n;
}

function applyCachedForLang(data, cache, lang) {
  let applied = 0;
  for (const entry of data) {
    const en = entry.translations?.English;
    if (en == null) continue;
    const cur = entry.translations[lang];
    if (cur != null && cur !== "" && cur !== en) continue;
    const k = `${lang}::${en}`;
    if (!Object.prototype.hasOwnProperty.call(cache, k)) continue;
    const next = cache[k];
    if (entry.translations[lang] !== next) {
      entry.translations[lang] = next;
      entry.updatedAt = new Date().toISOString();
      applied++;
    }
  }
  return applied;
}

async function processBatch(items, concurrency, fn) {
  const errors = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async (item) => {
        try {
          await fn(item);
          return null;
        } catch (e) {
          return { item, err: String(e.message || e) };
        }
      })
    );
    for (const r of results) if (r) errors.push(r);
  }
  return errors;
}

async function main() {
  let data = loadJson();
  if (!Array.isArray(data)) throw new Error("translations.json must be an array");

  let cache = loadCache();
  const cacheStart = Object.keys(cache).length;
  console.log(`Resume start. keys=${data.length} cache=${cacheStart}`);

  // Phase 1: apply all cached values language-by-language, save once
  let cacheApplied = 0;
  for (const lang of LANGS) {
    cacheApplied += applyCachedForLang(data, cache, lang);
  }
  saveJson(data);
  saveCache(cache);
  console.log(`Applied from cache into JSON: ${cacheApplied}`);
  console.log(`Remaining cells after cache apply: ${countRemaining(data)}`);

  let newlyFetched = 0;
  let cellsUpdated = cacheApplied;
  let sinceSave = 0;
  let sinceReport = 0;
  const allErrors = [];

  // Phase 2: language by language, small batches
  for (const lang of LANGS) {
    // Collect work for this language only (small list)
    const work = [];
    const seenEn = new Set();
    for (const entry of data) {
      const en = entry.translations?.English;
      if (en == null) continue;
      const cur = entry.translations[lang];
      if (cur != null && cur !== "" && cur !== en) continue;
      const k = `${lang}::${en}`;
      if (Object.prototype.hasOwnProperty.call(cache, k)) {
        // apply late cache hit
        if (entry.translations[lang] !== cache[k]) {
          entry.translations[lang] = cache[k];
          entry.updatedAt = new Date().toISOString();
          cellsUpdated++;
          sinceSave++;
        }
        continue;
      }
      if (!seenEn.has(en)) {
        seenEn.add(en);
        work.push({ lang, en, entryIndexes: [] });
      }
    }

    // Attach entry indexes for applying (avoid re-scan of all keys for unique EN)
    const enToIndexes = new Map();
    for (let i = 0; i < data.length; i++) {
      const en = data[i].translations?.English;
      if (en == null) continue;
      const cur = data[i].translations[lang];
      if (cur != null && cur !== "" && cur !== en) continue;
      if (!enToIndexes.has(en)) enToIndexes.set(en, []);
      enToIndexes.get(en).push(i);
    }
    for (const item of work) {
      item.entryIndexes = enToIndexes.get(item.en) || [];
    }

    console.log(`Language ${lang}: unique to fetch=${work.length}`);

    for (let b = 0; b < work.length; b += BATCH_SIZE) {
      const batch = work.slice(b, b + BATCH_SIZE);
      const errors = await processBatch(batch, CONCURRENCY, async (item) => {
        const { value, fromCache } = await translateOne(item.en, item.lang, cache);
        if (!fromCache) newlyFetched++;
        for (const idx of item.entryIndexes) {
          const entry = data[idx];
          const cur = entry.translations[lang];
          const en = entry.translations.English;
          if (cur != null && cur !== "" && cur !== en) continue;
          if (entry.translations[lang] !== value) {
            entry.translations[lang] = value;
            entry.updatedAt = new Date().toISOString();
            cellsUpdated++;
            sinceSave++;
            sinceReport++;
          }
        }
        await sleep(10);
      });
      allErrors.push(...errors);

      if (sinceSave >= SAVE_EVERY) {
        saveJson(data);
        saveCache(cache);
        console.log(
          `Saved batch. cache=${Object.keys(cache).length} remaining≈${countRemaining(data)} lang=${lang}`
        );
        sinceSave = 0;
        // Drop and reload references less aggressively — keep data in place but
        // encourage GC of temporary batch arrays
      }

      if (sinceReport >= REPORT_EVERY) {
        console.log(
          JSON.stringify({
            progressReport: true,
            completedCellsUpdated: cellsUpdated,
            remaining: countRemaining(data),
            cacheSize: Object.keys(cache).length,
            currentLanguage: lang,
            newlyFetched,
          })
        );
        sinceReport = 0;
      }
    }

    // End of language save
    saveJson(data);
    saveCache(cache);
    console.log(`Finished language ${lang}. remaining=${countRemaining(data)}`);
  }

  // Ensure all keys present
  for (const entry of data) {
    if (!entry.translations.English) throw new Error(`Missing English for ${entry.key}`);
    for (const lang of LANGS) {
      if (entry.translations[lang] == null || entry.translations[lang] === "") {
        entry.translations[lang] = entry.translations.English;
      }
    }
  }
  saveJson(data);
  saveCache(cache);

  // Validation
  const counts = {};
  for (const lang of ["English", ...LANGS]) counts[lang] = 0;
  let identical = 0;
  let intentional = 0;
  let nonIntentional = 0;
  const leftovers = [];
  let placeholderBroken = 0;

  for (const entry of data) {
    for (const lang of Object.keys(counts)) {
      if (entry.translations[lang] != null && entry.translations[lang] !== "") counts[lang]++;
    }
    const en = entry.translations.English;
    const enPh = en.match(PLACEHOLDER_RE) || [];
    for (const lang of LANGS) {
      const v = entry.translations[lang];
      if (v === en) {
        identical++;
        if (isIntentionalEnglish(en)) intentional++;
        else {
          nonIntentional++;
          if (leftovers.length < 25) leftovers.push({ key: entry.key, lang, en: String(en).slice(0, 80) });
        }
      }
      for (const ph of enPh) {
        if (!String(v).includes(ph)) {
          placeholderBroken++;
          break;
        }
      }
    }
  }

  // Re-parse validate
  JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));

  const summary = {
    totalKeys: data.length,
    languagesCompleted: LANGS.length + 1,
    cacheStart,
    cacheEnd: Object.keys(cache).length,
    cachedTranslationsReusedApprox: cacheApplied,
    newlyTranslatedValues: newlyFetched,
    cellsUpdated,
    remainingIdenticalToEnglish: identical,
    intentionalBrandEnglish: intentional,
    remainingUntranslatedNonBrand: nonIntentional,
    placeholderBroken,
    fetchErrors: allErrors.length,
    perLangKeyCounts: counts,
    leftoverSamples: leftovers,
    errorSamples: allErrors.slice(0, 10),
  };
  console.log("\n=== DONE ===");
  console.log(JSON.stringify(summary, null, 2));

  const expected = data.length;
  const bad = Object.entries(counts).filter(([, n]) => n !== expected);
  if (bad.length) {
    console.error("KEY PARITY FAIL", bad);
    process.exit(1);
  }
  console.log("KEY PARITY OK");
  console.log("JSON PARSE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
