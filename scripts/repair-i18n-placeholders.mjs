#!/usr/bin/env node
/** Repair mangled placeholders in translations.json (low memory). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JSON_PATH = path.join(ROOT, "api-server/data/translations.json");
const CACHE_PATH = path.join(ROOT, "scripts/.i18n-translate-cache.json");

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function gtx(text, tl) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
    encodeURIComponent(tl) +
    "&dt=t&q=" +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  return data[0].map((r) => r[0]).join("");
}

function protect(text) {
  const tokens = [];
  let out = text.replace(PLACEHOLDER_RE, (m) => {
    const i = tokens.length;
    tokens.push(m);
    return ` __PH${i}__ `;
  });
  for (const brand of [...PROTECT].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    out = out.replace(re, () => {
      const i = tokens.length;
      tokens.push(brand);
      return ` __PH${i}__ `;
    });
  }
  return { out, tokens };
}

function restore(text, tokens) {
  let out = text;
  for (let i = 0; i < tokens.length; i++) {
    out = out.replace(new RegExp(`__\\s*PH\\s*${i}\\s*__`, "gi"), tokens[i]);
    out = out.replace(new RegExp(`__PH${i}__`, "gi"), tokens[i]);
  }
  return out;
}

function isMangled(v) {
  return /⟦|P\d+⟧|__PH|[पপ][0०০]|P0⟧/.test(v);
}

async function main() {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {}

  let repaired = 0;
  const errors = [];

  for (const entry of data) {
    const en = entry.translations.English || "";
    const enPh = en.match(PLACEHOLDER_RE) || [];
    if (!enPh.length) continue;

    for (const lang of LANGS) {
      let v = entry.translations[lang] || "";
      const missing = enPh.some((ph) => !v.includes(ph));
      if (!missing && !isMangled(v)) continue;

      try {
        const { out, tokens } = protect(en);
        let translated = await gtx(out, LANG_CODE[lang] || "hi");
        translated = restore(translated, tokens);
        const ok = enPh.every((ph) => translated.includes(ph));
        if (!ok || isMangled(translated)) {
          // Keep placeholders safe — use English for this cell only
          translated = en;
        }
        entry.translations[lang] = translated;
        entry.updatedAt = new Date().toISOString();
        cache[`${lang}::${en}`] = translated;
        repaired++;
        await sleep(40);
        if (repaired % 25 === 0) {
          fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
          fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
          console.log(`Repaired ${repaired}...`);
        }
      } catch (e) {
        errors.push({ key: entry.key, lang, err: String(e.message || e) });
      }
    }
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");

  let phBroken = 0;
  for (const entry of data) {
    const en = entry.translations.English || "";
    const enPh = en.match(PLACEHOLDER_RE) || [];
    for (const lang of LANGS) {
      const v = entry.translations[lang] || "";
      if (enPh.some((ph) => !v.includes(ph))) phBroken++;
    }
  }

  function intentional(en) {
    const s = String(en).trim();
    if (!s) return true;
    if (PROTECT.includes(s)) return true;
    if (/^(OK|ID|SMS|OTP|GPS|API|URL|Email|WhatsApp|SkillAd|iOS|Android|UPI|IFSC)$/i.test(s)) return true;
    if (/^SkillAd\b/i.test(s)) return true;
    if (/PhonePe|GPay|Paytm|BHIM|NEFT|IMPS|RTGS|Visa|Mastercard|RuPay|Mobikwik|Freecharge/.test(s)) return true;
    if (/^YYYY-MM-DD$/i.test(s)) return true;
    if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(s)) return true;
    if (/^Wk\s?\d+$/i.test(s)) return true;
    if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i.test(s)) return true;
    if (/^UTR/i.test(s) || /^UPI ID$/i.test(s) || /^GST/i.test(s)) return true;
    if (/^[\W\d_]+$/u.test(s)) return true;
    return false;
  }

  let identical = 0;
  let intent = 0;
  let non = 0;
  const leftovers = [];
  const counts = { English: 0 };
  for (const lang of LANGS) counts[lang] = 0;

  for (const entry of data) {
    counts.English++;
    const en = entry.translations.English;
    for (const lang of LANGS) {
      counts[lang]++;
      if (entry.translations[lang] === en) {
        identical++;
        if (intentional(en)) intent++;
        else {
          non++;
          if (leftovers.length < 20) leftovers.push({ key: entry.key, lang, en });
        }
      }
    }
  }

  JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));

  console.log(
    JSON.stringify(
      {
        repaired,
        errors: errors.length,
        phBroken,
        identical,
        intentionalEnglish: intent,
        remainingNonBrandEnglish: non,
        leftovers,
        cacheSize: Object.keys(cache).length,
        keyParity: Object.values(counts).every((n) => n === data.length),
        totalKeys: data.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
