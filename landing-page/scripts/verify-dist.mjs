/**
 * Post-build checks for landing-page/dist.
 * Ensures production API origin is absolute and Hostinger deploy files exist.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "../dist");
const EXPECTED_ORIGIN = "https://api.skillad.in";

function fail(msg) {
  console.error(`❌ verify-dist: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

if (!existsSync(dist)) {
  fail(`dist/ not found at ${dist}. Run pnpm build first.`);
}

const assetsDir = join(dist, "assets");
if (!existsSync(assetsDir)) {
  fail("dist/assets/ missing");
}

const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
if (jsFiles.length === 0) {
  fail("No JS files in dist/assets/");
}

const combined = jsFiles
  .map((f) => readFileSync(join(assetsDir, f), "utf8"))
  .join("\n");

// 1) Absolute API origin baked in
if (!combined.includes(`"${EXPECTED_ORIGIN}"`) && !combined.includes(`'${EXPECTED_ORIGIN}'`)) {
  fail(`Bundle must contain string literal "${EXPECTED_ORIGIN}"`);
}
ok(`Bundle contains "${EXPECTED_ORIGIN}"`);

// 2) __API_BASE__ must be replaced by Vite define (no bare identifier left)
if (/\b__API_BASE__\b/.test(combined)) {
  fail("Bundle still contains unreplaced __API_BASE__ identifier — define() did not run");
}
ok("__API_BASE__ fully replaced by Vite define");

// 3) Must not bake empty string as the only API origin (old broken dist)
// Broken pattern kept the identifier; after fix the origin string is present (checked above).
// Also reject explicit empty-origin assign used as API base alone.
if (
  combined.includes(`API_ORIGIN=""`) ||
  combined.includes(`API_ORIGIN=''`) ||
  /return""\+/.test(combined) && !combined.includes(EXPECTED_ORIGIN)
) {
  fail("Bundle appears to use empty string as API origin");
}
ok("API origin is not empty / relative");

// 4) Full request shape: origin + /api/... path segments
const sampleEndpoints = ["/api/stats", "/api/categories", "/api/settings", "/api/content"];
for (const ep of sampleEndpoints) {
  if (!combined.includes(`"${ep}"`) && !combined.includes(`'${ep}'`)) {
    fail(`Expected path segment ${ep} in bundle`);
  }
}
ok(`Path segments present → runtime URLs = ${EXPECTED_ORIGIN}/api/...`);

// 5) Hostinger files (copied from public/)
const requiredFiles = [".htaccess", "provider-og.php", "index.html", "robots.txt", "favicon.svg"];
for (const name of requiredFiles) {
  if (!existsSync(join(dist, name))) {
    fail(`Missing deploy file: dist/${name}`);
  }
  ok(`Found dist/${name}`);
}

const og = readFileSync(join(dist, "provider-og.php"), "utf8");
if (!og.includes("api.skillad.in") && !og.includes("SKILLAD_API_URL")) {
  fail("provider-og.php does not reference API host");
}
ok("provider-og.php references API host");

const ht = readFileSync(join(dist, ".htaccess"), "utf8");
if (!ht.includes("provider-og.php") || !ht.includes("index.html")) {
  fail(".htaccess missing provider-og / SPA rewrite rules");
}
ok(".htaccess has crawler + SPA rewrites");

console.log("\nverify-dist: all checks passed");
console.log(`Deploy folder: ${dist}`);
