import multer from "multer";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { processUploadImage } from "../lib/imageProcess.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// All source is bundled into dist/index.mjs — __dirname is always dist/ at runtime
export const DATA_DIR = resolve(__dirname, "../data");

// ── Auto-create all upload subdirectories ─────────────────────────────────────
const UPLOAD_SUBDIRS = ["profile", "services", "banners", "documents"];
for (const sub of UPLOAD_SUBDIRS) {
  const p = resolve(DATA_DIR, "uploads", sub);
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}
if (!existsSync(resolve(DATA_DIR, "uploads"))) {
  mkdirSync(resolve(DATA_DIR, "uploads"), { recursive: true });
}

// ── Multer: in-memory storage so we can process with sharp before saving ──────
export const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB raw max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (jpg, png, webp, gif) are allowed"));
    }
  },
});

// ── Image processing presets ─────────────────────────────────────────────────
interface ImagePreset {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

const PRESETS: Record<string, ImagePreset> = {
  profile:   { maxWidth: 400,  maxHeight: 400,  quality: 80 },
  services:  { maxWidth: 800,  maxHeight: 600,  quality: 82 },
  banners:   { maxWidth: 1200, maxHeight: 400,  quality: 85 },
  documents: { maxWidth: 1600, maxHeight: 2000, quality: 88 },
};

const SUBDIR_VARIANT: Record<string, "profile" | "service" | "banner" | "document"> = {
  profile: "profile",
  profiles: "profile",
  services: "service",
  banners: "banner",
  documents: "document",
};

// ── Core image processor: resize + convert to WebP when sharp is available ───
export async function processAndSaveImage(
  buffer: Buffer,
  subdir: keyof typeof PRESETS | string,
  contentType = "image/jpeg",
): Promise<string> {
  const variant = SUBDIR_VARIANT[String(subdir)] ?? "service";
  const processed = await processUploadImage(buffer, contentType, variant);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${processed.extension}`;
  const destDir = resolve(DATA_DIR, "uploads", subdir as string);
  const destPath = resolve(destDir, filename);
  writeFileSync(destPath, processed.buffer);
  return `/api/uploads/${subdir}/${filename}`;
}

// ── Base64 image processor (used by existing admin upload endpoint) ───────────
export async function processBase64Image(
  base64Data: string,
  subdir: keyof typeof PRESETS,
): Promise<string> {
  const cleaned = base64Data.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(cleaned, "base64");
  return processAndSaveImage(buffer, subdir);
}
