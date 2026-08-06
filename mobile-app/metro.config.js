/**
 * metro.config.js — SkillAd (Expo 54 / React Native 0.81.5)
 *
 * WHY THIS FILE EXISTS (read carefully before modifying)
 * ──────────────────────────────────────────────────────
 * @supabase/realtime-js >=2.8.0 contains:
 *
 *   otelModulePromise = import(/* webpackIgnore: true *\/ '@opentelemetry/api')
 *
 * hermesc (the Hermes compiler on EAS Android builds) cannot parse the
 * dynamic import() keyword and exits with code 2.  Metro does NOT apply
 * Babel to node_modules files that match transformIgnorePatterns, so the
 * raw import() passes verbatim into the bundle.
 *
 * FIX STRATEGY (three independent layers — ALL must remain in place)
 * ──────────────────────────────────────────────────────────────────
 *
 * LAYER 1 — Metro resolveRequest (this file, MOST RELIABLE)
 *   Runs at Metro BUNDLE TIME on the EAS server.  Completely independent of
 *   npm/yarn/pnpm, EAS caching, and package.json overrides.  Any attempt by
 *   any module to require('@supabase/realtime-js') is silently redirected to
 *   our local no-op stub which has zero dynamic imports.
 *
 * LAYER 2 — npm overrides (package.json)
 *   Replaces the installed copy of @supabase/realtime-js with our stub at
 *   npm-install time.  Works when EAS runs a fresh npm install.  Does NOT
 *   work when EAS restores a cached node_modules.
 *
 * LAYER 3 — postinstall patcher (stubs/patch-realtime.js)
 *   Rewrites any remaining import() call inside @supabase/realtime-js after
 *   npm install.  Catches cases where the npm override was skipped but the
 *   real package was still installed.
 */

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs   = require("fs");

const config = getDefaultConfig(__dirname);

// ─── Stub paths ───────────────────────────────────────────────────────────────
const REALTIME_STUB  = path.resolve(__dirname, "stubs/realtime-stub/index.js");
const EMPTY_STUB     = path.resolve(__dirname, "stubs/empty-module.js");

// Exact module names that must resolve to the empty stub (Node-only built-ins
// and WebSocket that have no React Native implementation).
const EXACT_EMPTY_STUBS = new Set([
  "ws",
  "stream",
  "net",
  "tls",
  "fs",
  "child_process",
  "readline",
  "http2",
]);

// ─── Project root for alias resolution ───────────────────────────────────────
//
// __dirname is always the absolute directory of THIS file (artifacts/skilladd-app/)
// regardless of process.cwd(). This is critical for EAS monorepo builds where
// EAS may run the build from the workspace root rather than the app subdirectory.
const PROJECT_ROOT = __dirname;

// ─── resolveRequest (LAYER 1 — highest-priority interceptor) ─────────────────
//
// Metro calls this hook BEFORE any node_modules lookup. Whatever version of
// @supabase/realtime-js npm installed (or cached) is irrelevant: Metro will
// always receive our stub.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {

  // ── @/* path alias (TypeScript baseUrl: "." / paths: { "@/*": ["./*"] }) ─
  //
  // WHY this approach (fs.existsSync + absolute filePath return):
  //   expo/metro-config does NOT set resolver.alias for @/* aliases.
  //   Calling context.resolveRequest() with a relative path is unreliable
  //   inside a custom hook because the Metro resolver context carries
  //   internal state that may not correctly anchor relative paths when
  //   running on EAS (different extraction path, different watchFolders).
  //
  //   Instead we find the real file ourselves using fs.existsSync against
  //   the absolute PROJECT_ROOT (__dirname — always correct, CWD-independent)
  //   and return { filePath, type: "sourceFile" } directly — the same
  //   pattern used for the realtime stub below.
  //
  // NOTE: The workspace root .easignore previously had `lib/` (unanchored),
  //   which caused EAS to exclude artifacts/skilladd-app/lib/ from the
  //   archive. Fixed to `/lib/` (root-anchored) so only the workspace-level
  //   lib/ packages are excluded, not the app's lib/ source directory.
  if (moduleName.startsWith("@/")) {
    const base = path.resolve(PROJECT_ROOT, moduleName.slice(2));
    const exts = [
      ".ts", ".tsx", ".js", ".jsx",
      "/index.ts", "/index.tsx", "/index.js", "/index.jsx",
    ];
    for (const ext of exts) {
      const candidate = base + ext;
      if (fs.existsSync(candidate)) {
        return { filePath: candidate, type: "sourceFile" };
      }
    }
    // No match — fall through so Metro reports a meaningful error
  }

  // ── Primary fix: redirect ALL realtime-js imports to our no-op stub ─────
  if (
    moduleName === "@supabase/realtime-js" ||
    moduleName.startsWith("@supabase/realtime-js/")
  ) {
    return { filePath: REALTIME_STUB, type: "sourceFile" };
  }

  // ── Secondary: redirect any remaining @opentelemetry/* to empty stub ────
  if (moduleName.startsWith("@opentelemetry/")) {
    return { filePath: EMPTY_STUB, type: "sourceFile" };
  }

  // ── Tertiary: stub out Node-only built-ins ───────────────────────────────
  if (EXACT_EMPTY_STUBS.has(moduleName)) {
    return { filePath: EMPTY_STUB, type: "sourceFile" };
  }

  // ── Fall through to default resolution ──────────────────────────────────
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
