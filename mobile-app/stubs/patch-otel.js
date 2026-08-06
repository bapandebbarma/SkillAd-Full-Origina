/**
 * Postinstall patch: replaces every dynamic import('@opentelemetry/...') call
 * inside @supabase packages with Promise.resolve({}).
 *
 * Why: hermesc (the Hermes JS compiler used on EAS Android builds) cannot
 * compile dynamic `import()` expressions.  @supabase/realtime-js >=2.9 uses
 *   otelModulePromise = import(/* webpackIgnore: true *\/ '@opentelemetry/api')
 * Metro's resolveRequest hook does NOT intercept this call when the
 * /* webpackIgnore * / comment is present — the bundler leaves the raw
 * import() syntax in the output, and hermesc then fails.
 *
 * This script runs after `npm install` (via the "postinstall" npm script) and
 * directly patches the installed source files so Metro never sees import().
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// All supabase sub-package dist dirs that might contain the offending call
const SEARCH_DIRS = [
  'node_modules/@supabase/realtime-js/dist/main',
  'node_modules/@supabase/realtime-js/dist/module',
  'node_modules/@supabase/supabase-js/dist/main',
  'node_modules/@supabase/supabase-js/dist/module',
  'node_modules/@supabase/supabase-js/dist/cjs',
];

// Matches any dynamic import() whose specifier starts with @opentelemetry/
// including optional /* ... */ comments between import and (
const OTEL_IMPORT_RE = /import\s*\(\s*(?:\/\*[^*]*\*\/\s*)?['"]@opentelemetry\/[^'"]*['"]\s*\)/g;

function getAllJsFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...getAllJsFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

let patchedFiles = 0;
let totalReplacements = 0;

for (const relDir of SEARCH_DIRS) {
  const absDir = path.join(ROOT, relDir);
  for (const file of getAllJsFiles(absDir)) {
    const original = fs.readFileSync(file, 'utf8');
    let count = 0;
    const patched = original.replace(OTEL_IMPORT_RE, () => {
      count++;
      return 'Promise.resolve({})';
    });
    if (count > 0) {
      fs.writeFileSync(file, patched, 'utf8');
      patchedFiles++;
      totalReplacements += count;
      console.log(`  patched (${count}x): ${path.relative(ROOT, file)}`);
    }
  }
}

if (totalReplacements > 0) {
  console.log(`\notel-patch: replaced ${totalReplacements} dynamic import() call(s) across ${patchedFiles} file(s).`);
} else {
  console.log('otel-patch: nothing to patch (OTEL imports not found — OK).');
}
