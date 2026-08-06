const fs = require('fs');
const path = require('path');

const findings = [];

function add(file, line, text, kind) {
  findings.push({ file, line, text, kind });
}

// Manually curated + pattern-derived remaining hardcodes
// --- subscription plan/payment config (user-visible) ---
const sub = fs.readFileSync('E:/SkillAd-Full-Origina/mobile-app/app/subscription.tsx','utf8').split(/\n/);
for (let i = 0; i < sub.length; i++) {
  const L = sub[i];
  const line = i + 1;
  // only in PLAN/PAY config region roughly lines 30-75
  if (line >= 30 && line <= 75) {
    for (const key of ['label', 'billedAs', 'badge', 'desc']) {
      const re = new RegExp(key + '\\s*:\\s*"([^"]+)"', 'g');
      let m;
      while ((m = re.exec(L))) add('app/subscription.tsx', line, m[1], key + ':');
    }
  }
  if (L.includes('throw new Error("Failed to submit")')) {
    add('app/subscription.tsx', line, 'Failed to submit', 'Error');
  }
}

// notifications empty/subtitle
add('app/(tabs)/notifications.tsx', 248, 'Stay updated with your bookings and activities.', 'jsx-text');

// register-provider
add('app/register-provider.tsx', 854, 'Add Photo', 'jsx-text');
add('app/register-provider.tsx', 520, 'Provider', 'fallback-name');
add('app/register-provider.tsx', 524, 'Agartala', 'fallback-location');

// ErrorFallback a11y
add('components/ErrorFallback.tsx', 58, 'View error details', 'accessibilityLabel');
add('components/ErrorFallback.tsx', 129, 'Close error details', 'accessibilityLabel');

// ReviewModal
add('components/ReviewModal.tsx', 68, 'Anonymous', 'fallback-name');

// Also scan for any remaining focused patterns we trust
const ROOTS = [
  'E:/SkillAd-Full-Origina/mobile-app/app',
  'E:/SkillAd-Full-Origina/mobile-app/components',
];
function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(e.name) && e.name !== 'searchBarStyles.ts') acc.push(p);
  }
  return acc;
}

for (const filePath of walk(ROOTS[0]).concat(walk(ROOTS[1]))) {
  const rel = path.relative('E:/SkillAd-Full-Origina/mobile-app', filePath).replace(/\\/g, '/');
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split(/\n/);

  // placeholder= / accessibilityLabel= / headerTitle=
  const attrRe = /\b(placeholder|accessibilityLabel|accessibilityHint|headerTitle|headerBackTitle)\s*=\s*(?:\{\s*)?(["'])([^"'\\{]*)\2/g;
  let m;
  const flat = src; // keep comments for line nums - strip for match on copy
  const noC = src.replace(/\/\*[\s\S]*?\*\//g, (x) => x.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');
  while ((m = attrRe.exec(noC))) {
    const text = m[3].trim();
    if (!text || /^(Debug)$/i.test(text)) continue;
    if (!/[A-Za-z]{2,}/.test(text)) continue;
    const line = noC.slice(0, m.index).split(/\n/).length;
    // dedupe later
    add(rel, line, text, m[1]);
  }

  // Alert.alert(" literal as first args only - simple line-based
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const am = L.match(/Alert\.alert\s*\(\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/);
    if (am) {
      const text = am[1].slice(1, -1);
      if (/^(Debug|handleChangePhoto called)$/i.test(text)) continue;
      if (/[A-Za-z]{2,}/.test(text)) add(rel, i + 1, text, 'Alert.alert');
    }
  }
}

// dedupe
const seen = new Set();
const unique = [];
for (const f of findings) {
  const k = `${f.file}|${f.line}|${f.text}|${f.kind}`;
  if (seen.has(k)) continue;
  seen.add(k);
  unique.push(f);
}
unique.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const OUT = 'E:/SkillAd-Full-Origina/_remaining_hardcoded.json';
fs.writeFileSync(OUT, JSON.stringify(unique, null, 2));

// verification counts
const lc = fs.readFileSync('E:/SkillAd-Full-Origina/mobile-app/context/LanguageContext.tsx', 'utf8');
const hasExtra = lc.includes('EXTRA_STRINGS');
const em = lc.match(/const EXTRA_STRINGS: Record<string, string> = \{([\s\S]*?)\n\};/);
const extraKeys = em ? [...em[1].matchAll(/^\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:/gm)].map((x) => x[1]) : [];
const tj = JSON.parse(fs.readFileSync('E:/SkillAd-Full-Origina/api-server/data/translations.json', 'utf8'));

console.log(JSON.stringify({
  remainingCount: unique.length,
  byKind: unique.reduce((a, f) => ((a[f.kind] = (a[f.kind] || 0) + 1), a), {}),
  topFiles: Object.entries(unique.reduce((a, f) => ((a[f.file] = (a[f.file] || 0) + 1), a), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([file, count]) => ({ file, count })),
  EXTRA_STRINGS: hasExtra,
  EXTRA_STRINGS_keys: extraKeys.length,
  translations_json_entries: Object.keys(tj).length,
  findings: unique,
}, null, 2));
