#!/usr/bin/env node
/**
 * SkillAd i18n maintenance checker
 *
 * - Scans mobile-app for hard-coded user-visible strings
 * - Compares LanguageContext.tsx ↔ api-server/data/translations.json
 * - Reports missing / duplicate / unused keys and hard-coded strings
 * - Exits non-zero when missing translations (or duplicates / empty values) are found
 *
 * Usage: pnpm check:i18n
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CTX_PATH = path.join(ROOT, "mobile-app/context/LanguageContext.tsx");
const JSON_PATH = path.join(ROOT, "api-server/data/translations.json");
const SCAN_DIRS = [
  path.join(ROOT, "mobile-app/app"),
  path.join(ROOT, "mobile-app/components"),
];

const LANGS = [
  "English", "Assamese", "Bengali", "Bodo", "Dogri",
  "Gujarati", "Hindi", "Kannada", "Kashmiri", "Kokborok",
  "Konkani", "Maithili", "Malayalam", "Manipuri", "Marathi",
  "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali",
  "Sindhi", "Tamil", "Telugu", "Urdu",
];

const SKIP_DIRS = new Set(["node_modules", ".expo", "dist", "build", "stubs"]);

/** Symbols / non-copy that should not be flagged as hard-coded UI. */
const IGNORE_EXACT = new Set([
  "—", "✓", "⚠", "+91", "₹", "U", "k", "Debug", "handleChangePhoto called",
]);

// ── File helpers ─────────────────────────────────────────────────────────────

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function walkTsx(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walkTsx(p, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

// ── Extract keys from LanguageContext ────────────────────────────────────────

function extractStringsTypeKeys(src) {
  const m = src.match(/type Strings\s*=\s*\{([\s\S]*?)\n\};/);
  if (!m) throw new Error("Could not find `type Strings` in LanguageContext.tsx");
  const keys = [];
  const re = /(\w+)\s*:\s*string\s*;/g;
  let x;
  while ((x = re.exec(m[1]))) keys.push(x[1]);
  return keys;
}

function extractObjectKeys(block) {
  const keys = [];
  const re = /(\w+)\s*:\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  let x;
  while ((x = re.exec(block))) keys.push(x[1]);
  return keys;
}

function extractExtraStringsKeys(src) {
  const m = src.match(/const EXTRA_STRINGS\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\};/);
  if (!m) return [];
  return extractObjectKeys(m[1]);
}

function extractEnglishBlockKeys(src) {
  const start = src.search(/\bEnglish\s*:\s*\{/);
  if (start < 0) return [];
  let i = src.indexOf("{", start) + 1;
  let depth = 1;
  const from = i;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === q) break;
        i++;
      }
    }
    i++;
  }
  return extractObjectKeys(src.slice(from, i - 1));
}

function collectCtxKeys(src) {
  const typeKeys = extractStringsTypeKeys(src);
  const extraKeys = extractExtraStringsKeys(src);
  const englishKeys = extractEnglishBlockKeys(src);
  const all = new Set([...typeKeys, ...extraKeys, ...englishKeys]);
  return {
    typeKeys,
    extraKeys,
    englishKeys,
    allKeys: [...all].sort(),
  };
}

// ── translations.json ────────────────────────────────────────────────────────

function loadTranslationsJson() {
  const data = JSON.parse(read(JSON_PATH));
  if (!Array.isArray(data)) throw new Error("translations.json must be an array");

  const byKey = new Map();
  const duplicates = [];
  const emptyValues = []; // { key, language }

  for (const entry of data) {
    const key = entry && entry.key;
    if (!key || typeof key !== "string") continue;
    if (byKey.has(key)) {
      duplicates.push(key);
    } else {
      byKey.set(key, entry);
    }
    const tr = entry.translations || {};
    for (const lang of LANGS) {
      const v = tr[lang];
      if (v == null || String(v).trim() === "") {
        emptyValues.push({ key, language: lang });
      }
    }
  }

  return {
    keys: [...byKey.keys()].sort(),
    duplicates: [...new Set(duplicates)].sort(),
    emptyValues,
    byKey,
  };
}

// ── Unused keys ──────────────────────────────────────────────────────────────

function findUsedKeys(files, knownKeys) {
  const used = new Set();
  const keySet = new Set(knownKeys);

  for (const file of files) {
    const src = read(file);
    // t.someKey / t?.someKey
    for (const m of src.matchAll(/\bt\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      if (keySet.has(m[1])) used.add(m[1]);
    }
    // translate("key") / translate('key')
    for (const m of src.matchAll(/\btranslate\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\)/g)) {
      if (keySet.has(m[1])) used.add(m[1]);
    }
    // t["key"] / t['key']
    for (const m of src.matchAll(/\bt\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g)) {
      if (keySet.has(m[1])) used.add(m[1]);
    }
    // Dynamic access via key: "someKnownKey" (e.g. FEATURES / plan maps) then t[item.key]
    for (const m of src.matchAll(/\bkey\s*:\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g)) {
      if (keySet.has(m[1])) used.add(m[1]);
    }
  }

  return used;
}

// ── Hard-coded string scan ───────────────────────────────────────────────────

function isLikelyUi(s) {
  if (!s || s.length < 2) return false;
  if (IGNORE_EXACT.has(s)) return false;
  // i18n placeholder tokens used in .replace("{name}", …)
  if (/^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(s)) return false;
  if (/^[\s\d\W]+$/.test(s)) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  if (/^(https?:|mailto:|tel:)/i.test(s)) return false;
  if (/^(flex|row|column|center|absolute|relative|none|auto)/i.test(s)) return false;
  if (/^(Inter_|SpaceGrotesk|ios|android|web)/i.test(s)) return false;
  if (/^(primary|secondary|muted|foreground|background|border)/i.test(s)) return false;
  // Skip pure identifiers that look like code tokens
  if (/^[a-z][a-zA-Z0-9]*$/.test(s) && s.length < 4) return false;
  return true;
}

function scanHardcoded(files) {
  const findings = [];
  const seen = new Set();

  for (const file of files) {
    // Skip LanguageContext itself
    if (file.replace(/\\/g, "/").includes("LanguageContext")) continue;
    const src = read(file);
    const lines = src.split(/\r?\n/);
    const fileRel = rel(file);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^\s*(import|export)\b/.test(line)) continue;
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;
      if (/StyleSheet\.create|fontFamily|backgroundColor|borderColor|color:\s*["'#]/.test(line)) continue;
      // Already using translations
      if (/\bt\.[A-Za-z_]|\btranslate\(/.test(line) && !/Alert\.alert\(\s*["']/.test(line)) {
        // Still check for mixed hard-coded Alert if any
      }

      const push = (kind, text) => {
        const t = text.trim();
        if (!isLikelyUi(t)) return;
        // Skip if the string is only used inside t. / translate on this line
        if (/^\s*\{?\s*t\./.test(trimmed)) return;
        const id = `${fileRel}:${i + 1}:${kind}:${t}`;
        if (seen.has(id)) return;
        seen.add(id);
        findings.push({ file: fileRel, line: i + 1, kind, text: t });
      };

      // JSX text: >English...<
      for (const m of line.matchAll(/>([A-Za-z][^<{]*?[A-Za-z.!?][A-Za-z\s,.!?'’\-:]*)<\//g)) {
        push("Text", m[1]);
      }

      // Props
      for (const m of line.matchAll(
        /\b(title|placeholder|label|accessibilityLabel|headerTitle|headerBackTitle|tabBarLabel)\s*=\s*\{?\s*["']([^"']+)["']/g,
      )) {
        push(m[1], m[2]);
      }

      // Object title: "..." in options (tab/stack)
      for (const m of line.matchAll(/\b(title|headerTitle|headerBackTitle)\s*:\s*["']([^"']+)["']/g)) {
        push(m[1], m[2]);
      }

      // Alert.alert("Title", "Message" — skip if the line already uses t./translate for copy
      if (/Alert\.alert\s*\(/.test(line)) {
        const usesT = /\bt\.[A-Za-z_]|\btranslate\(/.test(line);
        if (!usesT) {
          for (const m of line.matchAll(/["']([^"']{2,})["']/g)) {
            // Skip style tokens
            if (m[1] === "cancel" || m[1] === "destructive" || m[1] === "default") continue;
            push("Alert", m[1]);
          }
        }
      }
    }
  }

  return findings;
}

// ── Report ───────────────────────────────────────────────────────────────────

function section(title, items, formatter) {
  console.log(`\n=== ${title} (${items.length}) ===`);
  if (items.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const item of items) {
    console.log("  " + formatter(item));
  }
}

function main() {
  console.log("SkillAd i18n check\n");

  if (!fs.existsSync(CTX_PATH)) {
    console.error("Missing:", CTX_PATH);
    process.exit(2);
  }
  if (!fs.existsSync(JSON_PATH)) {
    console.error("Missing:", JSON_PATH);
    process.exit(2);
  }

  const ctxSrc = read(CTX_PATH);
  const ctx = collectCtxKeys(ctxSrc);
  const json = loadTranslationsJson();

  const ctxSet = new Set(ctx.allKeys);
  const jsonSet = new Set(json.keys);

  const missingInJson = ctx.allKeys.filter((k) => !jsonSet.has(k));
  const missingInCtx = json.keys.filter((k) => !ctxSet.has(k));

  // Duplicate keys inside Strings type / EXTRA_STRINGS
  function findDupes(arr) {
    const c = new Map();
    for (const k of arr) c.set(k, (c.get(k) || 0) + 1);
    return [...c.entries()].filter(([, n]) => n > 1).map(([k]) => k).sort();
  }
  const dupType = findDupes(ctx.typeKeys);
  const dupExtra = findDupes(ctx.extraKeys);
  const allDupes = [...new Set([...json.duplicates, ...dupType, ...dupExtra])].sort();

  const scanFiles = SCAN_DIRS.flatMap((d) => walkTsx(d));
  const used = findUsedKeys(scanFiles, ctx.allKeys);
  const unused = ctx.allKeys.filter((k) => !used.has(k));

  const hardcoded = scanHardcoded(scanFiles);

  // Summary
  console.log(`LanguageContext keys : ${ctx.allKeys.length} (type ${ctx.typeKeys.length}, EXTRA ${ctx.extraKeys.length}, English block ${ctx.englishKeys.length})`);
  console.log(`translations.json    : ${json.keys.length} entries`);
  console.log(`Scanned files        : ${scanFiles.length}`);

  section("Missing keys (in LanguageContext, not in translations.json)", missingInJson, (k) => k);
  section("Missing keys (in translations.json, not in LanguageContext)", missingInCtx, (k) => k);
  section("Empty / missing language values", json.emptyValues, (e) => `${e.key} → ${e.language}`);
  section("Duplicate keys", allDupes, (k) => k);
  section("Unused keys (not referenced in app/ or components/)", unused, (k) => k);
  section("Hard-coded user-visible strings", hardcoded, (h) => `${h.file}:${h.line} [${h.kind}] ${JSON.stringify(h.text)}`);

  const missingTranslations =
    missingInJson.length > 0 ||
    missingInCtx.length > 0 ||
    json.emptyValues.length > 0;

  const hasErrors = missingTranslations || allDupes.length > 0;

  console.log("\n=== Summary ===");
  console.log(`  Missing (ctx → json) : ${missingInJson.length}`);
  console.log(`  Missing (json → ctx) : ${missingInCtx.length}`);
  console.log(`  Empty values         : ${json.emptyValues.length}`);
  console.log(`  Duplicates           : ${allDupes.length}`);
  console.log(`  Unused               : ${unused.length}`);
  console.log(`  Hard-coded           : ${hardcoded.length}`);

  if (hasErrors) {
    console.log("\nFAIL: missing translations and/or duplicate keys found.");
    process.exit(1);
  }

  if (hardcoded.length > 0) {
    console.log("\nWARN: hard-coded strings found (reported above). Dictionaries are in sync.");
    // Hard-coded strings imply missing i18n coverage — treat as failure for maintenance CI.
    console.log("FAIL: hard-coded user-visible strings require translation keys.");
    process.exit(1);
  }

  console.log("\nPASS: no missing translations.");
  process.exit(0);
}

main();
