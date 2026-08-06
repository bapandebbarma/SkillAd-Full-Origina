const fs = require('fs');
const path = require('path');

const ROOTS = [
  'E:/SkillAd-Full-Origina/mobile-app/app',
  'E:/SkillAd-Full-Origina/mobile-app/components',
];
const OUT = 'E:/SkillAd-Full-Origina/_remaining_hardcoded.json';

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const PURE_SYMBOL = /^[\s\d₹$€£¥%.,:;!?@#&*+=\-_/\\|<>()[\]{}'"`~•·…—–✓✔✗✘⚠⚡★☆♥♡→←↑↓]+$/u;
const DEBUG_RE = /^(Debug|handleChangePhoto called)$/i;
const HAS_ENGLISH_WORD = /[A-Za-z]{2,}/;

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function isExcludedText(text) {
  const t = text.trim();
  if (!t) return true;
  if (PURE_SYMBOL.test(t)) return true;
  if (DEBUG_RE.test(t)) return true;
  if (!HAS_ENGLISH_WORD.test(t)) return true;
  if (/^(\+91|₹|Rs\.?|INR)\s*[\d.,]*$/i.test(t)) return true;
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(t) && t.length < 40) return true;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t)) return true;
  if (/^(System|monospace|serif|sans-serif|Roboto|Inter|Arial)$/i.test(t)) return true;
  if (/^[./@]/.test(t) || /\.(tsx?|jsx?|json|png|jpg|svg)$/i.test(t)) return true;
  // i18n replace placeholders
  if (/^\{[a-zA-Z0-9_]+\}$/.test(t)) return true;
  // HTTP methods / status enums used in logic
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|pending|declined|accepted|completed|cancelled|canceled|active|inactive)$/i.test(t)) return true;
  // code fragments
  if (/[;={}()]/.test(t)) return true;
  if (/\?/.test(t) && /:/.test(t)) return true; // ternary fragments
  if (/^(null|undefined|true|false)$/i.test(t)) return true;
  return false;
}

function lineOf(src, index) {
  return src.slice(0, index).split(/\n/).length;
}

function addFinding(findings, file, line, text, kind) {
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  if (isExcludedText(cleaned)) return;
  if (/^(t\.|translate\()/.test(cleaned)) return;
  findings.push({ file, line, text: cleaned, kind });
}

function findStyleRanges(src) {
  const styleRanges = [];
  let i = 0;
  while (i < src.length) {
    const slice = src.slice(i);
    const m = slice.match(/StyleSheet\.create\s*\(/);
    if (!m) break;
    const start = i + m.index;
    let depth = 0;
    let j = start + m[0].length - 1;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === '(' || c === '{') depth++;
      else if (c === ')' || c === '}') {
        depth--;
        if (depth === 0) { j++; break; }
      }
    }
    styleRanges.push([start, j]);
    i = j;
  }
  return styleRanges;
}

/** Walk Alert.alert(...) and collect only UI-facing string literals. */
function collectAlertUiStrings(src, openParenIdx) {
  // Token-ish scan with depth tracking. Capture:
  // - string literals at parenDepth===1 that are direct args (not after . or inside [])
  // - text: "..." at object depth within the buttons array (parenDepth>=1)
  // Skip function bodies: when we see => or function, skip until matching brace depth returns
  const out = [];
  let i = openParenIdx;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let inStr = null;
  let strStart = -1;
  let escaped = false;
  let skipFuncBrace = null; // when entering callback, ignore strings until brace back
  let pendingProp = null; // 'text' | 'title' | null after seeing ident:
  let lastNonSpace = '';
  let identBuf = '';

  function considerString(val, start, kindHint) {
    const before = src.slice(Math.max(0, start - 2), start);
    // skip property access .replace("...")
    if (lastNonSpace === '.' || /\.\s*$/.test(src.slice(Math.max(0, start - 15), start).replace(/\s/g, ''))) {
      // more reliable:
    }
    const pre = src.slice(Math.max(0, start - 40), start);
    if (/\.\s*(replace|includes|startsWith|endsWith|indexOf|match|test)\s*\(\s*$/.test(pre)) return;
    if (/console\.(log|warn|error|debug|info)\s*\(\s*$/.test(pre)) return;
    if (/status\s*:\s*$/.test(pre) || /status:\s*["']/.test(pre)) return;
    if (/style\s*:\s*$/.test(pre) && /^(default|cancel|destructive)$/i.test(val)) return;
    if (/method\s*:\s*$/.test(pre)) return;
    if (/fetch\s*\(\s*$/.test(pre) || /\/(conversations|api|v1)\//.test(val)) return;

    // Direct arg at top-level Alert.alert( "title", "msg", ... )
    if (paren === 1 && brace === 0 && bracket === 0 && kindHint === 'arg') {
      out.push({ start, val });
      return;
    }
    // Button text: { text: "OK" }
    if ((pendingProp === 'text' || pendingProp === 'title' || pendingProp === 'message') && brace >= 1) {
      out.push({ start, val });
    }
  }

  for (; i < src.length; i++) {
    const c = src[i];

    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === inStr) {
        const val = src.slice(strStart + 1, i);
        if (skipFuncBrace === null) {
          const kindHint = pendingProp ? 'prop' : 'arg';
          considerString(val, strStart, kindHint);
        }
        inStr = null;
        pendingProp = null;
        lastNonSpace = '"';
        identBuf = '';
      }
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      strStart = i;
      continue;
    }

    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    // detect => callback / function (
    if (c === '=' && src[i + 1] === '>') {
      // entering arrow function — if next nonspace is {, skip body
      let j = i + 2;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === '{') {
        skipFuncBrace = brace; // when we enter that brace, mark; clear when brace returns to this
      } else {
        // concise body — skip until comma/paren at same level roughly: ignore strings on this "line" hard; set skip until , or ) at paren level
        // simpler: treat as skip until we see , or ) at current paren with brace unchanged
        skipFuncBrace = 'concise:' + paren + ':' + brace;
      }
      i++;
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      identBuf += c;
      lastNonSpace = c;
      continue;
    }

    if (c === ':') {
      const id = identBuf;
      if (id === 'text' || id === 'title' || id === 'message' || id === 'label') pendingProp = id;
      else pendingProp = null;
      identBuf = '';
      lastNonSpace = c;
      continue;
    }

    if (/\s/.test(c)) {
      // keep identBuf only if still building — whitespace ends ident
      if (identBuf && !/^\s*$/.test(c)) { /* noop */ }
      // don't clear pendingProp on whitespace
      if (identBuf) {
        // end of ident without :
        identBuf = '';
      }
      continue;
    }

    identBuf = '';

    if (c === '(') { paren++; lastNonSpace = c; continue; }
    if (c === ')') {
      paren--;
      lastNonSpace = c;
      if (paren === 0) break;
      continue;
    }
    if (c === '{') {
      brace++;
      if (skipFuncBrace !== null && typeof skipFuncBrace === 'number' && brace === skipFuncBrace + 1) {
        // inside skipped function body — keep skipFuncBrace as number meaning "exit when brace == skipFuncBrace"
      }
      lastNonSpace = c;
      continue;
    }
    if (c === '}') {
      brace--;
      if (typeof skipFuncBrace === 'number' && brace === skipFuncBrace) {
        skipFuncBrace = null;
      }
      lastNonSpace = c;
      pendingProp = null;
      continue;
    }
    if (c === '[') { bracket++; lastNonSpace = c; continue; }
    if (c === ']') { bracket--; lastNonSpace = c; continue; }

    if (c === ',' && typeof skipFuncBrace === 'string' && skipFuncBrace.startsWith('concise:')) {
      const parts = skipFuncBrace.split(':');
      if (paren === Number(parts[1]) && brace === Number(parts[2])) skipFuncBrace = null;
    }

    lastNonSpace = c;
    pendingProp = null;
  }
  return out;
}

/**
 * Find JSX text: after a tag close `>`, before next `<`, with English letters.
 * Require the opening `<` before this `>` to be a real JSX tag (not generic).
 */
function scanJsxText(src, file, findings, inStyle) {
  // Match sequences: >TEXT< where TEXT has no <>{
  const re = />([^<>{]+)</g;
  let m;
  while ((m = re.exec(src))) {
    if (inStyle(m.index)) continue;
    const gt = m.index;
    // Find matching opening < for this tag
    let open = -1;
    for (let k = gt - 1; k >= 0; k--) {
      if (src[k] === '>') break; // nested weirdness
      if (src[k] === '<') { open = k; break; }
    }
    if (open < 0) continue;
    const afterOpen = src[open + 1];
    if (!(afterOpen === '/' || /[A-Za-z_]/.test(afterOpen))) continue;
    // Reject TypeScript generics: identifier immediately before `<`
    let p = open - 1;
    while (p >= 0 && /\s/.test(src[p])) p--;
    if (p >= 0 && /[A-Za-z0-9_>]/.test(src[p])) continue;

    // Closing tag or next open tag
    const lt = gt + m[0].length - 1;
    const afterLt = src[lt + 1];
    if (!(afterLt === '/' || afterLt === '>' || /[A-Za-z_]/.test(afterLt))) continue;

    const text = m[1].trim();
    if (!text || !HAS_ENGLISH_WORD.test(text)) continue;
    // Must look like prose / UI label, not code
    if (/^[a-z][a-zA-Z0-9]*\s*\?/.test(text)) continue; // isIOS ?
    if (/^\)/.test(text) || /\($/.test(text)) continue;
    if (!/^[A-Za-z0-9].*[A-Za-z].*$/.test(text) && !/^[A-Z]/.test(text)) {
      // allow normal sentences
    }
    // Require at least one space OR starts with capital OR common short UI words — reduce code
    // Actually "Add Photo" has space; "Loading" capitalized
    const looksUi =
      /\s/.test(text) ||
      /^[A-Z][a-z]/.test(text) ||
      /^(OK|Yes|No|Cancel|Error|Retry|Save|Edit|Delete|Back|Next|Done|Close|Submit|Continue|Skip)$/i.test(text);
    if (!looksUi) continue;

    addFinding(findings, file, lineOf(src, gt), text, 'jsx-text');
  }
}

const findings = [];
const files = ROOTS.flatMap((r) => walk(r));

for (const filePath of files) {
  const rel = path.relative('E:/SkillAd-Full-Origina/mobile-app', filePath).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(filePath, 'utf8'));
  const lines = src.split(/\n/);
  const styleRanges = findStyleRanges(src);
  const inStyle = (idx) => styleRanges.some(([a, b]) => idx >= a && idx < b);

  // placeholder / label / accessibility*
  {
    const re = /\b(placeholder|label|accessibilityLabel|accessibilityHint|headerTitle|headerBackTitle)\s*=\s*(?:\{\s*)?(["'`])([\s\S]*?)\2/g;
    let m;
    while ((m = re.exec(src))) {
      if (inStyle(m.index)) continue;
      const val = m[3];
      if (/^\s*(t\.|translate\()/.test(val)) continue;
      if (m[2] === '`' && !HAS_ENGLISH_WORD.test(val.replace(/\$\{[^}]+\}/g, ''))) continue;
      addFinding(findings, rel, lineOf(src, m.index), val.replace(/\$\{[^}]+\}/g, '{…}'), m[1]);
    }
  }

  // Alert.alert
  {
    const re = /Alert\.alert\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      const open = m.index + m[0].length - 1;
      const strs = collectAlertUiStrings(src, open);
      for (const s of strs) {
        if (s.quote === '`' && !HAS_ENGLISH_WORD.test(s.val.replace(/\$\{[^}]+\}/g, ''))) continue;
        addFinding(findings, rel, lineOf(src, s.start), s.val.replace(/\$\{[^}]+\}/g, '{…}'), 'Alert.alert');
      }
    }
  }

  // title: / headerTitle: / label: in objects (options, plans, etc.)
  {
    const re = /\b(title|headerTitle|headerBackTitle|tabBarLabel|label|message|description|placeholder|confirmLabel|cancelLabel|buttonLabel|emptyMessage|subtitle)\s*:\s*(["'`])([\s\S]*?)\2/g;
    let m;
    while ((m = re.exec(src))) {
      if (inStyle(m.index)) continue;
      const val = m[3];
      if (/^\s*(t\.|translate\()/.test(val)) continue;
      const before = src.slice(Math.max(0, m.index - 40), m.index);
      if (/\bt\.\w+\s*$/.test(before) || /translate\s*\(\s*$/.test(before)) continue;
      if (m[2] === '`' && !HAS_ENGLISH_WORD.test(val.replace(/\$\{[^}]+\}/g, ''))) continue;
      // skip logic comparisons on same line
      const lineTxt = lines[lineOf(src, m.index) - 1] || '';
      if (/\b(===|!==|==|!=)\b/.test(lineTxt) && /\b(status|type|role|kind|mode)\b/i.test(lineTxt)) continue;
      addFinding(findings, rel, lineOf(src, m.index), val.replace(/\$\{[^}]+\}/g, '{…}'), m[1] + ':');
    }
  }

  // Also text: "..." for Alert-like buttons outside Alert.alert already handled;
  // catch standalone UI text: in options
  {
    const re = /\btext\s*:\s*(["'`])([\s\S]*?)\1/g;
    let m;
    while ((m = re.exec(src))) {
      if (inStyle(m.index)) continue;
      const val = m[2];
      if (/^\s*(t\.|translate\()/.test(val)) continue;
      const before = src.slice(Math.max(0, m.index - 50), m.index);
      if (/\bt\.\w+\s*$/.test(before)) continue;
      if (/^(center|left|right|auto|none|bold|normal|cancel|destructive|default)$/i.test(val)) continue;
      // only if looks like button config near Alert or action sheet — require nearby braces with style: or onPress
      const window = src.slice(m.index, Math.min(src.length, m.index + 120));
      if (!/\b(onPress|style)\s*:/.test(window) && !/\b(onPress|style)\s*:/.test(before)) continue;
      addFinding(findings, rel, lineOf(src, m.index), val.replace(/\$\{[^}]+\}/g, '{…}'), 'text:');
    }
  }

  scanJsxText(src, rel, findings, inStyle);

  // >{"English"}<
  {
    const re = /\{\s*(["'])([^"'\\{]+)\1\s*\}/g;
    let m;
    while ((m = re.exec(src))) {
      if (inStyle(m.index)) continue;
      const val = m[2];
      if (!HAS_ENGLISH_WORD.test(val)) continue;
      const before = src.slice(Math.max(0, m.index - 5), m.index);
      if (!/>\s*$/.test(before)) continue;
      addFinding(findings, rel, lineOf(src, m.index), val, 'jsx-expr-string');
    }
  }
}

const seen = new Set();
const unique = [];
for (const f of findings) {
  const k = `${f.file}|${f.line}|${f.text}|${f.kind}`;
  if (seen.has(k)) continue;
  seen.add(k);
  unique.push(f);
}

unique.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

fs.writeFileSync(OUT, JSON.stringify(unique, null, 2), 'utf8');
console.log('Total findings:', unique.length);
const byKind = {};
for (const f of unique) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
console.log('By kind:', JSON.stringify(byKind, null, 2));
const byFile = {};
for (const f of unique) byFile[f.file] = (byFile[f.file] || 0) + 1;
console.log('Top files:');
Object.entries(byFile).sort((a, b) => b[1] - a[1]).forEach(([f, c]) => console.log(String(c).padStart(4), f));
console.log('\nAll findings:');
unique.forEach((x) => console.log(x.file + ':' + x.line, x.kind, JSON.stringify(x.text)));
