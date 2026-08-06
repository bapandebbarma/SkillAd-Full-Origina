/**
 * stubs/patch-realtime.js — postinstall patcher (LAYER 3)
 *
 * Runs after `npm install` via the "postinstall" script in package.json.
 *
 * Purpose:
 *   If the npm "overrides" key was bypassed (EAS cached node_modules, or
 *   wrong package manager), the REAL @supabase/realtime-js may land in
 *   node_modules.  This script finds every .js file inside that package and
 *   replaces any dynamic import() call with Promise.resolve({}) so hermesc
 *   can compile the bundle.
 *
 * Safe to run multiple times (idempotent).
 * If the stub is installed instead of the real package, there is nothing to
 * patch and the script exits cleanly.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ─── Directories to scan ─────────────────────────────────────────────────────
// We scan both the top-level copy and any nested copy that npm might create
// inside @supabase/supabase-js/node_modules.
const SEARCH_DIRS = [
  path.join(ROOT, 'node_modules', '@supabase', 'realtime-js'),
  path.join(ROOT, 'node_modules', '@supabase', 'supabase-js', 'node_modules', '@supabase', 'realtime-js'),
  path.join(ROOT, 'node_modules', '@supabase', 'supabase-js'),
];

// Matches the offending expression in all its forms:
//   import(/* webpackIgnore: true */ '@opentelemetry/api')
//   import('@opentelemetry/api')
//   import( /* any comment */ "@opentelemetry/api" )
const DYNAMIC_IMPORT_RE = /import\s*\(\s*(?:\/\*[^*]*\*\/\s*)?['"]@opentelemetry\/[^'"]*['"]\s*\)/g;

// Also catch any bare dynamic import() of any module (belt-and-suspenders):
const ANY_IMPORT_RE = /\bimport\s*\(\s*(?:\/\*[^*]*\*\/\s*)?['"][^'"]+['"]\s*\)/g;

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
      // Don't recurse into our own stub to avoid modifying it
      if (name !== 'realtime-stub' && name !== 'otel-stub') walkJs(full, out);
    } else if (name.endsWith('.js') || name.endsWith('.cjs') || name.endsWith('.mjs')) {
      out.push(full);
    }
  }
  return out;
}

var patchedFiles = 0;
var totalPatches = 0;

for (var di = 0; di < SEARCH_DIRS.length; di++) {
  var dir = SEARCH_DIRS[di];
  var files = walkJs(dir);
  for (var fi = 0; fi < files.length; fi++) {
    var file = files[fi];
    var original;
    try { original = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }

    var count = 0;
    // First, targeted OTEL patch
    var patched = original.replace(DYNAMIC_IMPORT_RE, function() { count++; return 'Promise.resolve({})'; });
    // Second pass: any remaining dynamic import() (catches non-OTEL cases too)
    // Only apply if we're inside the realtime-js package to avoid false positives
    if (file.indexOf(path.join('realtime-js')) !== -1) {
      patched = patched.replace(ANY_IMPORT_RE, function(match) {
        // Don't double-count what we already replaced
        if (match === 'Promise.resolve({})') return match;
        count++;
        return 'Promise.resolve({})';
      });
    }

    if (count > 0) {
      try {
        fs.writeFileSync(file, patched, 'utf8');
        patchedFiles++;
        totalPatches += count;
        console.log('[patch-realtime] patched (' + count + 'x): ' + path.relative(ROOT, file));
      } catch (e) {
        console.warn('[patch-realtime] WARNING: could not write ' + file + ': ' + e.message);
      }
    }
  }
}

if (totalPatches > 0) {
  console.log('[patch-realtime] replaced ' + totalPatches + ' dynamic import() call(s) in ' + patchedFiles + ' file(s).');
} else {
  console.log('[patch-realtime] nothing to patch — stub is correctly installed or no import() found. OK.');
}
