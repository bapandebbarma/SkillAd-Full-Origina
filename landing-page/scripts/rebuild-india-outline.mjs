#!/usr/bin/env node
/**
 * Rebuild ONLY the national outline in indiaStatesPaths.json from
 * a local datameet india-composite GeoJSON file, keeping denser northern
 * vertices so J&K / Ladakh claim is not lost to simplification.
 *
 * Prerequisite: place the composite GeoJSON at
 *   landing-page/tmp-india-composite.geojson
 *
 * Usage: node scripts/rebuild-india-outline.mjs
 * Does not change bounds, viewBox, states, or marker projection.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JSON_PATH = path.join(ROOT, "src/data/indiaStatesPaths.json");
const COMPOSITE = path.join(ROOT, "tmp-india-composite.geojson");

const j = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const { bounds, viewBox } = j;

function proj(lng, lat) {
  const x =
    ((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * viewBox.w;
  const y =
    ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * viewBox.h;
  return [x, y];
}

/** Keep more points near the northern claim (lat >= 32). */
function simplifyRing(ring) {
  if (ring.length < 4) return ring;
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    const isNorth = lat >= 32;
    const isExtreme =
      lat >= 35.5 || lat <= 8.5 || lng <= 69.5 || lng >= 96.5;
    // Target ~900 pts for large rings; denser in north/extremes
    const keepEvery = isExtreme ? 1 : isNorth ? 2 : Math.max(3, Math.ceil(ring.length / 900));
    if (i === 0 || i === ring.length - 1 || i % keepEvery === 0) {
      out.push(ring[i]);
    }
  }
  // Ensure closed ring endpoint
  const a = out[0];
  const b = out[out.length - 1];
  if (a && b && (a[0] !== b[0] || a[1] !== b[1])) out.push([...a]);
  return out;
}

function ringToPath(ring) {
  const simp = simplifyRing(ring);
  let d = "";
  let started = false;
  for (const pt of simp) {
    const lng = pt[0];
    const lat = pt[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const [x, y] = proj(lng, lat);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const xs = x.toFixed(1);
    const ys = y.toFixed(1);
    if (!started) {
      d += `M${xs} ${ys}`;
      started = true;
    } else {
      d += `L${xs} ${ys}`;
    }
  }
  return started ? `${d}Z` : "";
}

function geomToPath(g) {
  const parts = [];
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
    if (p.length > 20) parts.push(p);
  }
  return parts.join("");
}

function bboxPath(d) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const re = /[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g;
  let m;
  while ((m = re.exec(d))) {
    const x = +m[1];
    const y = +m[2];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

if (!fs.existsSync(COMPOSITE)) {
  console.error("Missing", COMPOSITE);
  process.exit(1);
}

const geo = JSON.parse(fs.readFileSync(COMPOSITE, "utf8"));
const features = geo.features || [geo];
// Prefer the largest polygon feature (mainland composite)
let best = "";
for (const f of features) {
  const p = geomToPath(f.geometry);
  if (p.length > best.length) best = p;
}

if (!best) {
  console.error("Failed to build outline");
  process.exit(1);
}

const oldB = bboxPath(j.outline);
const newB = bboxPath(best);

j.outline = best;
j.attribution =
  "Outer boundary: datameet india-composite (Survey of India style, CC0). States: open India admin GeoJSON.";

fs.writeFileSync(JSON_PATH, JSON.stringify(j));
console.log(
  JSON.stringify(
    {
      oldOutlineLen: j.outline.length,
      newOutlineLen: best.length,
      oldBBox: oldB,
      newBBox: newB,
      viewBox,
      padTop: newB.minY,
      padBottom: viewBox.h - newB.maxY,
      fits:
        newB.minX >= -0.5 &&
        newB.minY >= -0.5 &&
        newB.maxX <= viewBox.w + 0.5 &&
        newB.maxY <= viewBox.h + 0.5,
    },
    null,
    2,
  ),
);
