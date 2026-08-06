/**
 * Regenerates src/data/indiaStatesPaths.json from public India state GeoJSON.
 * Source: https://github.com/geohacker/india (state/india_telengana.geojson)
 *
 * Usage (from landing-page/):
 *   node scripts/generate-india-map.mjs
 */
import https from "https";
import fs from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/data/indiaStatesPaths.json");
const SRC =
  "https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson";

const LNG = { min: 68.0, max: 97.5 };
const LAT = { min: 6.5, max: 37.5 };
const W = 560;
const H = 640;

function get(url) {
  return new Promise((resolveP, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location).then(resolveP, reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolveP({ status: res.statusCode, buf: Buffer.concat(chunks) }),
        );
      })
      .on("error", reject);
  });
}

function proj(lng, lat) {
  return [
    ((lng - LNG.min) / (LNG.max - LNG.min)) * W,
    ((LAT.max - lat) / (LAT.max - LAT.min)) * H,
  ];
}

function simplifyRing(ring, maxPts) {
  if (ring.length <= maxPts) return ring;
  const step = Math.ceil(ring.length / maxPts);
  const out = [];
  for (let i = 0; i < ring.length - 1; i += step) out.push(ring[i]);
  out.push(ring[ring.length - 1]);
  return out;
}

function ringToPath(ring) {
  const maxPts = ring.length > 5000 ? 90 : ring.length > 1500 ? 120 : 140;
  const simp = simplifyRing(ring, maxPts);
  let d = "";
  let started = false;
  for (const pt of simp) {
    const lng = pt[0];
    const lat = pt[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < 66 || lng > 99 || lat < 5 || lat > 38.5) continue;
    const [x, y] = proj(lng, lat);
    const xs = x.toFixed(1);
    const ys = y.toFixed(1);
    if (!started) {
      d += `M${xs} ${ys}`;
      started = true;
    } else {
      d += `L${xs} ${ys}`;
    }
  }
  return started ? `${d}Z` : null;
}

function geomToPaths(g) {
  const paths = [];
  if (!g) return paths;
  const polys =
    g.type === "Polygon"
      ? [g.coordinates]
      : g.type === "MultiPolygon"
        ? g.coordinates
        : [];
  for (const poly of polys) {
    const outer = poly?.[0];
    if (!outer) continue;
    const p = ringToPath(outer);
    if (p && p.length > 15) paths.push(p);
  }
  return paths;
}

const { status, buf } = await get(SRC);
if (status !== 200) {
  console.error("Failed to download GeoJSON", status);
  process.exit(1);
}
const geo = JSON.parse(buf.toString("utf8"));
const states = [];
for (const f of geo.features || []) {
  const props = f.properties || {};
  const name =
    props.ST_NM || props.NAME_1 || props.name || props.st_nm || "State";
  const paths = geomToPaths(f.geometry);
  if (paths.length) states.push({ name: String(name), d: paths.join("") });
}

const payload = {
  bounds: { lngMin: LNG.min, lngMax: LNG.max, latMin: LAT.min, latMax: LAT.max },
  viewBox: { w: W, h: H },
  states,
};
fs.writeFileSync(OUT, JSON.stringify(payload));
console.log(`Wrote ${states.length} states → ${OUT} (${Buffer.byteLength(JSON.stringify(payload))} bytes)`);
