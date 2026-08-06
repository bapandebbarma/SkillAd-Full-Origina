const fs = require("fs");
const path = require("path");

const ROOT = "E:/SkillAd-Full-Origina";
const LC_PATH = path.join(ROOT, "mobile-app/context/LanguageContext.tsx");
const TJ_PATH = path.join(ROOT, "api-server/data/translations.json");
const FILTERED_PATH = path.join(ROOT, "_filtered_new_i18n_keys.json");

const LANGUAGES = [
  "English", "Assamese", "Bengali", "Bodo", "Dogri", "Gujarati", "Hindi",
  "Kannada", "Kashmiri", "Kokborok", "Konkani", "Maithili", "Malayalam",
  "Manipuri", "Marathi", "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali",
  "Sindhi", "Tamil", "Telugu", "Urdu",
];

const filtered = JSON.parse(fs.readFileSync(FILTERED_PATH, "utf8"));
const filteredKeys = Object.keys(filtered);
if (filteredKeys.length === 0) throw new Error("No keys to add");

let lc = fs.readFileSync(LC_PATH, "utf8");
const tjBefore = JSON.parse(fs.readFileSync(TJ_PATH, "utf8"));
const tjBeforeLen = tjBefore.length;
const tjBeforeKeyList = tjBefore.map((e) => e.key);

// Snapshot existing English values for integrity check later
const engMatch0 = lc.match(/English:\s*\{([\s\S]*?)\n\s*\},?\n\s*Assamese:/);
const engBlockBefore = engMatch0[1];

// --- 1) Add keys to Strings type ---
if (lc.includes("// Additional UI strings")) {
  throw new Error("Additional UI strings section already exists");
}
if (lc.includes("EXTRA_STRINGS")) {
  throw new Error("EXTRA_STRINGS already exists");
}

const typeEnd = lc.indexOf("\n}", lc.indexOf("type Strings = {"));
if (typeEnd < 0) throw new Error("Could not find end of Strings type");

const typeLines = filteredKeys
  .map((k) => `  ${k}: string;`)
  .join("\n");
const typeInsert =
  "\n  // Additional UI strings\n" + typeLines;

lc = lc.slice(0, typeEnd) + typeInsert + lc.slice(typeEnd);

// --- 2) Insert EXTRA_STRINGS after translations object ---
const marker = "type LanguageContextType";
const markerIdx = lc.indexOf(marker);
if (markerIdx < 0) throw new Error("LanguageContextType not found");

// Find the `};` that closes translations just before LanguageContextType
const before = lc.slice(0, markerIdx);
const closeIdx = before.lastIndexOf("};");
if (closeIdx < 0) throw new Error("Could not find translations closing };");

const extraEntries = filteredKeys
  .map((k) => `  ${k}: ${JSON.stringify(filtered[k])},`)
  .join("\n");

const extraBlock =
  `\n/** Newly added UI strings — English copied to all languages until verified translations exist. */\n` +
  `const EXTRA_STRINGS: Record<string, string> = {\n` +
  extraEntries +
  `\n};\n\n` +
  `for (const lang of ALL_LANGUAGES) {\n` +
  `  Object.assign(translations[lang], EXTRA_STRINGS as Partial<Strings>);\n` +
  `}\n\n`;

lc = lc.slice(0, closeIdx + 2) + extraBlock + lc.slice(closeIdx + 2);

fs.writeFileSync(LC_PATH, lc, "utf8");

// Verify we did not alter English block content
const lcAfter = fs.readFileSync(LC_PATH, "utf8");
const engMatch1 = lcAfter.match(/English:\s*\{([\s\S]*?)\n\s*\},?\n\s*Assamese:/);
if (!engMatch1 || engMatch1[1] !== engBlockBefore) {
  throw new Error("English translation block was modified unexpectedly");
}
if (!lcAfter.includes("EXTRA_STRINGS")) throw new Error("EXTRA_STRINGS missing after write");
if (!lcAfter.includes("// Additional UI strings")) throw new Error("Additional UI strings missing");

// --- 3) Append to translations.json ---
const updatedAt = "2026-07-11T00:00:00.000Z";
const newEntries = filteredKeys.map((k) => {
  const translations = {};
  for (const lang of LANGUAGES) {
    translations[lang] = filtered[k];
  }
  return { key: k, translations, updatedAt };
});

const tjAfter = tjBefore.concat(newEntries);
fs.writeFileSync(TJ_PATH, JSON.stringify(tjAfter, null, 2) + "\n", "utf8");

// Verify existing entries unchanged
const tjCheck = JSON.parse(fs.readFileSync(TJ_PATH, "utf8"));
if (tjCheck.length !== tjBeforeLen + filteredKeys.length) {
  throw new Error("translations.json length mismatch");
}
for (let i = 0; i < tjBeforeLen; i++) {
  if (JSON.stringify(tjCheck[i]) !== JSON.stringify(tjBefore[i])) {
    throw new Error("Existing translations.json entry modified at index " + i);
  }
}
for (const k of tjBeforeKeyList) {
  if (!tjCheck.some((e) => e.key === k)) {
    throw new Error("Existing key removed: " + k);
  }
}

fs.writeFileSync(
  path.join(ROOT, "_i18n_patch_meta.json"),
  JSON.stringify(
    {
      added: filteredKeys.length,
      tjBefore: tjBeforeLen,
      tjAfter: tjCheck.length,
      skipped: 0,
    },
    null,
    2
  ),
  "utf8"
);

console.log(
  JSON.stringify({
    ok: true,
    added: filteredKeys.length,
    tjBefore: tjBeforeLen,
    tjAfter: tjCheck.length,
  })
);
