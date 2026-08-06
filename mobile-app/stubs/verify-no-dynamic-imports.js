/**
 * stubs/verify-no-dynamic-imports.js
 *
 * Run as:   node stubs/verify-no-dynamic-imports.js
 * npm alias: npm run verify:hermes
 *
 * Scans ALL JavaScript files under node_modules/@supabase/ for dynamic
 * import() expressions that hermesc cannot compile.
 *
 * WHAT IS FLAGGED
 * ───────────────
 * Only the dynamic import() KEYWORD in non-comment code lines:
 *   import(...)   ← hermesc fails here
 *
 * WHAT IS NOT FLAGGED (intentionally)
 * ────────────────────────────────────
 * String constants that mention @opentelemetry are harmless and are ignored:
 *   const OTEL_PKG = "@opentelemetry/api";  ← harmless, hermesc compiles fine
 *   // comment mentioning @opentelemetry     ← harmless comment
 *
 * Exit 0 = clean — safe to run EAS Android build
 * Exit 1 = dynamic import() found — run `npm install` (postinstall patches it)
 */

'use strict';

var fs   = require('fs');
var path = require('path');

var ROOT         = path.resolve(__dirname, '..');
var SUPABASE_DIR = path.join(ROOT, 'node_modules', '@supabase');

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

if (!fs.existsSync(SUPABASE_DIR)) {
  console.error('verify:hermes — node_modules/@supabase not found. Run `npm install` first.');
  process.exit(1);
}

var violations   = [];
var filesScanned = 0;
var files        = walkJs(SUPABASE_DIR);

for (var fi = 0; fi < files.length; fi++) {
  var file = files[fi];
  var content;
  try { content = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }

  // Fast skip: if no import( at all, nothing to check
  if (content.indexOf('import(') === -1 && content.indexOf('import (') === -1) continue;

  filesScanned++;
  var lines = content.split('\n');

  for (var li = 0; li < lines.length; li++) {
    var raw      = lines[li];
    var stripped = raw.replace(/^\s+/, '');

    // Skip comment-only lines — webpackIgnore and @opentelemetry in
    // comments or string constants are NOT hermesc-incompatible.
    if (
      stripped.startsWith('//') ||
      stripped.startsWith('*')  ||
      stripped.startsWith('/*')
    ) continue;

    // The ONLY thing hermesc cannot compile: dynamic import() keyword
    if (/\bimport\s*\(/.test(raw)) {
      violations.push({
        file: path.relative(ROOT, file),
        line: li + 1,
        text: raw.trim().slice(0, 140),
      });
    }
  }
}

console.log('');
console.log('verify:hermes — checked ' + files.length + ' files (' + filesScanned + ' contained import keyword)');
console.log('');

if (violations.length === 0) {
  console.log('✅  PASS — zero dynamic import() found in node_modules/@supabase/');
  console.log('');
  console.log('    Safe to run:');
  console.log('    eas build -p android --profile preview --clear-cache');
  console.log('');
  process.exit(0);
} else {
  console.error('❌  FAIL — ' + violations.length + ' dynamic import() expression(s) found:\n');
  for (var vi = 0; vi < violations.length; vi++) {
    var v = violations[vi];
    console.error('  ' + v.file + ':' + v.line);
    console.error('  ' + v.text);
    console.error('');
  }
  console.error('FIX: run  npm install  (the postinstall script patches these automatically)');
  console.error('Or:  node stubs/patch-hermes.js');
  process.exit(1);
}
