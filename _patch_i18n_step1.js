const fs = require("fs");
const path = require("path");

const ROOT = "E:/SkillAd-Full-Origina";
const NEW_KEYS_PATH = path.join(ROOT, "_new_i18n_keys.json");
const LC_PATH = path.join(ROOT, "mobile-app/context/LanguageContext.tsx");
const TJ_PATH = path.join(ROOT, "api-server/data/translations.json");

const LANGUAGES = [
  "English", "Assamese", "Bengali", "Bodo", "Dogri", "Gujarati", "Hindi",
  "Kannada", "Kashmiri", "Kokborok", "Konkani", "Maithili", "Malayalam",
  "Manipuri", "Marathi", "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali",
  "Sindhi", "Tamil", "Telugu", "Urdu",
];

function escapeTsString(s) {
  return JSON.stringify(s);
}

const newKeys = JSON.parse(fs.readFileSync(NEW_KEYS_PATH, "utf8"));
let lc = fs.readFileSync(LC_PATH, "utf8");
const tjBefore = JSON.parse(fs.readFileSync(TJ_PATH, "utf8"));
const tjBeforeLen = tjBefore.length;
const tjBeforeKeys = new Set(tjBefore.map((e) => e.key));

const typeMatch = lc.match(/type Strings = \{([\s\S]*?)\n\}/);
if (!typeMatch) throw new Error("Strings type not found");
const existingTypeKeys = new Set(
  [...typeMatch[1].matchAll(/(\w+)\s*:\s*string/g)].map((x) => x[1])
);

const engMatch = lc.match(/English:\s*\{([\s\S]*?)\n\s*\},?\n\s*Assamese:/);
if (!engMatch) throw new Error("English block not found");
const existingEngKeys = new Set(
  [...engMatch[1].matchAll(/(\w+)\s*:/g)].map((x) => x[1])
);

const existing = new Set([...existingTypeKeys, ...existingEngKeys, ...tjBeforeKeys]);

const filtered = {};
let skipped = 0;
for (const [k, v] of Object.entries(newKeys)) {
  if (existing.has(k)) {
    skipped++;
    continue;
  }
  filtered[k] = v;
}
const filteredKeys = Object.keys(filtered);
console.log(
  JSON.stringify({
    newTotal: Object.keys(newKeys).length,
    skipped,
    toAdd: filteredKeys.length,
    typeKeys: existingTypeKeys.size,
    engKeys: existingEngKeys.size,
    tjBefore: tjBeforeLen,
  })
);

fs.writeFileSync(
  path.join(ROOT, "_filtered_new_i18n_keys.json"),
  JSON.stringify(filtered, null, 2),
  "utf8"
);
