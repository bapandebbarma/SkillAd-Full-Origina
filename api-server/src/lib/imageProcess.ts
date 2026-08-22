import { logger } from "./logger.js";

export type UploadImageVariant = "profile" | "service" | "banner" | "document" | "adminAd";

export interface ProcessedUploadImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default;
  } catch {
    return null;
  }
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

function normalizeMime(mimeType: string | undefined): string {
  const m = (mimeType ?? "").trim().toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  return m || "image/jpeg";
}

/**
 * Prefer sharp resize/WebP when available; otherwise return the original upload unchanged.
 */
export async function processUploadImage(
  buffer: Buffer,
  mimeType: string | undefined,
  variant: UploadImageVariant,
): Promise<ProcessedUploadImage> {
  const normalizedMime = normalizeMime(mimeType);
  const sharp = await loadSharp();

  if (!sharp) {
    logger.warn({ variant }, "sharp unavailable; storing original uploaded image");
    const extension = extensionForMime(normalizedMime);
    return { buffer, contentType: normalizedMime, extension };
  }

  try {
    let pipeline = sharp(buffer);
    switch (variant) {
      case "profile":
        pipeline = pipeline.resize(400, 400, { fit: "cover" });
        break;
      case "service":
        pipeline = pipeline.resize(800, 600, { fit: "inside", withoutEnlargement: true });
        break;
      case "banner":
        pipeline = pipeline.resize(1200, 400, { fit: "inside", withoutEnlargement: true });
        break;
      case "document":
        pipeline = pipeline.resize(1600, 2000, { fit: "inside", withoutEnlargement: true });
        break;
      case "adminAd":
        pipeline = pipeline.resize(1200, 800, { fit: "inside", withoutEnlargement: true });
        break;
    }

    const webp = await pipeline.webp({ quality: 85 }).toBuffer();
    return { buffer: webp, contentType: "image/webp", extension: "webp" };
  } catch (err: unknown) {
    logger.warn(
      { variant, err: err instanceof Error ? err.message : String(err) },
      "sharp processing failed; storing original uploaded image",
    );
    const extension = extensionForMime(normalizedMime);
    return { buffer, contentType: normalizedMime, extension };
  }
}
