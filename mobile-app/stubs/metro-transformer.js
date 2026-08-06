/**
 * Custom Metro transformer that patches @supabase files before hermesc compilation.
 *
 * WHY THIS EXISTS
 * ---------------
 * @supabase/supabase-js >=2.106 inlines @supabase/realtime-js which itself
 * inlines an OpenTelemetry lazy-loader. The dynamic import() keyword appears
 * in four syntactic forms across the dist files (see patch-hermes.js for details).
 *
 * hermesc (the Hermes compiler used in Android Gradle builds) cannot compile
 * the dynamic import() keyword. Metro does NOT apply Babel to node_modules
 * files by default, so transformIgnorePatterns alone has no effect — the
 * import() keyword passes through verbatim into the bundle and hermesc fails.
 *
 * This file is wired as babelTransformerPath in metro.config.js so it runs
 * for EVERY file Metro processes. It intercepts @supabase/* files and strips
 * all four known dynamic-import patterns before handing off to the real transformer.
 *
 * PATTERNS HANDLED
 * ----------------
 * FORM A — multiline webpackIgnore (supabase-js >=2.106):
 *   import( /* webpackIgnore: true *\/ /* @vite-ignore *\/ OTEL_PKG ).catch(…)
 *
 * FORM B — backtick template literal (UMD bundle):
 *   import(`@opentelemetry/api`).catch(…)
 *
 * FORM C — single/double-quoted string (older realtime-js):
 *   import('@opentelemetry/api')
 *   import(/* webpackIgnore *\/ '@opentelemetry/api')
 *
 * FORM D — bare variable form (future-proofing):
 *   import(OTEL_PKG)
 *
 * CACHE BUSTING
 * -------------
 * Bump the version suffix in getCacheKey() whenever the patch logic changes
 * so Metro invalidates its transform cache.
 */

'use strict';

const REPLACEMENT = 'Promise.resolve({})';

// FORM A: multiline webpackIgnore — anchored on /* webpackIgnore, lazy match to first )
const FORM_A_RE = /import\s*\(\s*\/\*\s*webpackIgnore[\s\S]*?\)/g;

// FORM B: backtick template literal
const FORM_B_RE = /import\s*\(\s*`@opentelemetry\/[^`]*`\s*\)/g;

// FORM C: single or double quoted string, optional leading block comment
const FORM_C_RE = /import\s*\(\s*(?:\/\*[^*]*\*\/\s*)?['"]@opentelemetry\/[^'"]*['"]\s*\)/g;

// FORM D: bare OTEL_PKG variable
const FORM_D_RE = /import\s*\(\s*OTEL_PKG\s*\)/g;

function patchSource(src) {
  let out = src;
  out = out.replace(FORM_A_RE, REPLACEMENT);
  out = out.replace(FORM_B_RE, REPLACEMENT);
  out = out.replace(FORM_C_RE, REPLACEMENT);
  out = out.replace(FORM_D_RE, REPLACEMENT);
  return out;
}

function isSupabaseFile(filename) {
  return filename && (
    filename.includes('@supabase') ||
    filename.includes('realtime-js') ||
    filename.includes('realtime_js')
  );
}

// Discover the upstream Expo/RN transformer in priority order
const UPSTREAM_CANDIDATES = [
  '@expo/metro-config/build/babel-transformer',
  '@expo/metro-config/src/babel-transformer',
  'metro-react-native-babel-transformer',
];

let upstream;
for (const candidate of UPSTREAM_CANDIDATES) {
  try {
    upstream = require(candidate);
    break;
  } catch (_) {}
}
if (!upstream) {
  throw new Error(
    '[skilladd metro-transformer] Could not find upstream transformer. Tried:\n' +
      UPSTREAM_CANDIDATES.join('\n')
  );
}

module.exports = {
  ...upstream,

  getCacheKey() {
    const base = upstream.getCacheKey ? upstream.getCacheKey() : '';
    // Bump this version when the patch logic changes to bust Metro's transform cache
    return base + ':otel-patch-v5';
  },

  async transform(params) {
    if (isSupabaseFile(params.filename)) {
      const original = params.src || '';
      const patched = patchSource(original);
      if (patched !== original) {
        params = { ...params, src: patched };
      }
    }
    return upstream.transform(params);
  },
};
