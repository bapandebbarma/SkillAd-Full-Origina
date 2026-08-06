/**
 * stubs/patch-hermes.js — comprehensive Hermes-safe postinstall patcher (v22)
 *
 * WHAT THIS PATCHES
 * ─────────────────
 * @supabase/supabase-js >=2.106 inlines @supabase/realtime-js which itself
 * inlines an OpenTelemetry lazy-loader.  The dynamic import() keyword appears
 * in three different syntactic forms across the dist files:
 *
 * FORM A — CJS / ESM (index.cjs, index.mjs)  — multiline, uses a variable:
 *   import(
 *     /* webpackIgnore: true *\/
 *     /* @vite-ignore *\/
 *     OTEL_PKG            ← variable, NOT a string literal
 *   ).catch(() => null)
 *
 * FORM B — UMD (umd/supabase.js) — inline backtick template literal:
 *   import(`@opentelemetry/api`).catch(()=>null)
 *
 * FORM C — older realtime-js dist — single/double-quoted string:
 *   import('@opentelemetry/api')
 *   import(/* webpackIgnore: true *\/ '@opentelemetry/api')
 *
 * All three forms make hermesc exit with code 2.  Replacing them with
 * Promise.resolve({}) satisfies hermesc and keeps all non-realtime
 * Supabase features working (auth, database, storage, notifications, OTP).
 *
 * HARD FAILURE
 * ────────────
 * After patching, the script re-scans every file.  If any surviving import()
 * keyword is found in non-comment code, the script exits with code 1 and
 * prints the exact location.  This surfaces the failure during `npm install`
 * on EAS — not four minutes later in hermesc.
 *
 * NOTE on @opentelemetry string references
 * ─────────────────────────────────────────
 * After patching the import() calls, files still contain:
 *   const OTEL_PKG = "@opentelemetry/api";   ← harmless string constant
 * hermesc compiles this without errors.  The verify script intentionally
 * does NOT flag bare @opentelemetry string references.
 */

'use strict';

var fs   = require('fs');
var path = require('path');

var ROOT         = path.resolve(__dirname, '..');
var SUPABASE_DIR = path.join(ROOT, 'node_modules', '@supabase');

// ─── Replacement patterns (applied in order) ─────────────────────────────────

// FORM A: multiline webpackIgnore (CJS / ESM, supabase-js >=2.106)
// Anchored on "/* webpackIgnore" which is always present in this form.
// [\s\S]*? is lazy so it stops at the FIRST closing ).
var PATTERN_A = /import\s*\(\s*\/\*\s*webpackIgnore[\s\S]*?\)/g;

// FORM B: backtick template-literal (UMD bundle, supabase-js >=2.106)
// import(`@opentelemetry/api`)
var PATTERN_B = /import\s*\(\s*`@opentelemetry\/[^`]*`\s*\)/g;

// FORM C: single/double-quoted string literal (older realtime-js dist)
// import('@opentelemetry/api')  or  import("@opentelemetry/api")
// also handles: import(/* webpackIgnore */ '@opentelemetry/api')
var PATTERN_C = /import\s*\(\s*(?:\/\*[^*]*\*\/\s*)?['"]@opentelemetry\/[^'"]*['"]\s*\)/g;

// FORM D: bare variable form (belt-and-suspenders for future format changes)
// import(OTEL_PKG)
var PATTERN_D = /import\s*\(\s*OTEL_PKG\s*\)/g;

var REPLACEMENT = 'Promise.resolve({})';

// ─── File walker ─────────────────────────────────────────────────────────────

function walkJs(dir, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  var entries;
  try { entries = fs.readdirSync(dir); } catch (e) { return out; }
  for (var i = 0; i < entries.length; i++) {
    var name = entries[i];
    var full = path.join(dir, name);
    var stat;
    try { stat = fs.statSync(full); } catch (e) { continue; }
    if (stat.isDirectory()) {
      walkJs(full, out);
    } else if (name.endsWith('.js') || name.endsWith('.cjs') || name.endsWith('.mjs')) {
      out.push(full);
    }
  }
  return out;
}

// ─── Phase 1: patch ───────────────────────────────────────────────────────────

console.log('[patch-hermes] scanning: ' + SUPABASE_DIR);

if (!fs.existsSync(SUPABASE_DIR)) {
  console.log('[patch-hermes] node_modules/@supabase not found — skipping (pre-install).');
  process.exit(0);
}

var allFiles     = walkJs(SUPABASE_DIR);
var patchedFiles = 0;
var totalPatches = 0;
var writeErrors  = [];

console.log('[patch-hermes] ' + allFiles.length + ' JS files to check...');

for (var fi = 0; fi < allFiles.length; fi++) {
  var file = allFiles[fi];
  var src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }

  // Quick skip: none of our patterns can match without import( being present
  if (src.indexOf('import(') === -1 && src.indexOf('import (') === -1) continue;

  var count = 0;

  var out = src;
  out = out.replace(PATTERN_A, function () { count++; return REPLACEMENT; });
  out = out.replace(PATTERN_B, function () { count++; return REPLACEMENT; });
  out = out.replace(PATTERN_C, function () { count++; return REPLACEMENT; });
  out = out.replace(PATTERN_D, function () { count++; return REPLACEMENT; });

  if (count > 0) {
    try {
      fs.writeFileSync(file, out, 'utf8');
      patchedFiles++;
      totalPatches += count;
      console.log('[patch-hermes] patched (' + count + 'x): ' + path.relative(ROOT, file));
    } catch (e) {
      writeErrors.push(path.relative(ROOT, file) + ' — ' + e.message);
    }
  }
}

if (writeErrors.length > 0) {
  for (var ei = 0; ei < writeErrors.length; ei++) {
    console.error('[patch-hermes] WRITE ERROR: ' + writeErrors[ei]);
  }
  process.exit(1);
}

if (totalPatches > 0) {
  console.log(
    '[patch-hermes] replaced ' + totalPatches +
    ' import() expression(s) across ' + patchedFiles + ' file(s).'
  );
} else {
  console.log('[patch-hermes] no dynamic import() found — clean install or already patched.');
}

// ─── Phase 2: verify (hard failure if any import() keyword survives) ──────────
//
// NOTE: we check ONLY for the import() keyword in non-comment code lines.
// The string constant  const OTEL_PKG = "@opentelemetry/api"  is harmless —
// hermesc compiles string literals without errors.

console.log('[patch-hermes] verifying — re-scanning for surviving import() ...');

function hasDynamicImport(line) {
  // Skip pure comment lines
  var stripped = line.replace(/^\s+/, '');
  if (stripped.startsWith('//') || stripped.startsWith('*') || stripped.startsWith('/*')) {
    return false;
  }
  return /\bimport\s*\(/.test(line);
}

var survivors  = 0;
var checkFiles = walkJs(SUPABASE_DIR);

for (var ci = 0; ci < checkFiles.length; ci++) {
  var cFile = checkFiles[ci];
  var content;
  try { content = fs.readFileSync(cFile, 'utf8'); } catch (e) { continue; }

  if (content.indexOf('import(') === -1 && content.indexOf('import (') === -1) continue;

  var cLines = content.split('\n');
  for (var li = 0; li < cLines.length; li++) {
    if (hasDynamicImport(cLines[li])) {
      survivors++;
      if (survivors <= 20) {
        console.error(
          '[patch-hermes] SURVIVOR: ' +
          path.relative(ROOT, cFile) + ':' + (li + 1)
        );
        console.error('  ' + cLines[li].trim().slice(0, 160));
      }
    }
  }
}

if (survivors > 0) {
  console.error('');
  console.error(
    '[patch-hermes] FATAL: ' + survivors +
    ' dynamic import() expression(s) remain — hermesc WILL fail.'
  );
  console.error('[patch-hermes] Update the patterns in stubs/patch-hermes.js to match');
  console.error('[patch-hermes] the new dist format, then re-run: npm run verify:hermes');
  process.exit(1);
}

console.log('[patch-hermes] ✓ PASS — zero dynamic import() found in node_modules/@supabase.');
console.log('[patch-hermes] Safe to run: eas build -p android --profile preview --clear-cache');
