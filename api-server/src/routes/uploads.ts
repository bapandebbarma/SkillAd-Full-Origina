import { Router, type Request, type Response } from "express";
import { multerUpload, processAndSaveImage } from "../middlewares/upload.js";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Shared: upload buffer to Supabase Storage (primary) or local disk (fallback) ──
async function uploadToStorage(
  buffer: Buffer,
  bucket: string,
  filename: string,
  req: Request,
): Promise<string> {
  // Primary: Supabase Storage — permanent, CDN-hosted, works on all hosts
  if (supabase) {
    try {
      await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});
      const { data, error: upErr } = await supabase.storage
        .from(bucket)
        .upload(filename, buffer, { contentType: "image/webp", upsert: true });
      if (data) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
        return urlData.publicUrl;
      }
      if (upErr) logger.warn({ upErr }, "Supabase storage upload failed");
    } catch (e: any) {
      logger.warn({ e }, "Supabase storage error");
    }
  }
  // Fallback: local disk
  const relativePath = await processAndSaveImage(buffer, bucket);
  const base = (process.env["API_BASE_URL"] ?? "").replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
  return `${base}${relativePath}`;
}

// ── POST /api/upload/profile ─────────────────────────────────────────────────
// Accepts multipart/form-data with:
//   image  — the image file (required)
//   userId — Supabase user UUID (required for profiles.avatar_url sync)
//
// Flow: storage upload → profiles.avatar_url update → return fileUrl.
// The DB update is server-side (service role key) so client JWT expiry cannot
// cause a silent desync between storage and profiles.avatar_url.
router.post(
  "/upload/profile",
  multerUpload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "No image file provided. Use field name 'image'." }); return; }
    if (req.file.size > 2 * 1024 * 1024) { res.status(400).json({ error: "Profile image must be under 2 MB." }); return; }

    const userId = (req.body as Record<string, string | undefined>).userId?.trim() || null;

    try {
      // Step 1: Read current avatar_url so we can delete the old file after uploading the new one
      let oldAvatarUrl: string | null = null;
      if (userId && supabase) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", userId)
          .maybeSingle();
        oldAvatarUrl = existingProfile?.avatar_url ?? null;
      }

      // Step 2: Upload new image
      const sharp = (await import("sharp")).default;
      const webp = await sharp(req.file.buffer).resize(400, 400, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
      const filename = `${Date.now()}.webp`;
      const url = await uploadToStorage(webp, "profiles", filename, req);

      // Step 3: Update profiles.avatar_url (service-role key — bypasses client JWT expiry)
      if (userId && supabase) {
        const { error: dbErr } = await supabase
          .from("profiles")
          .update({ avatar_url: url })
          .eq("id", userId);

        if (dbErr) {
          logger.error(
            { userId, url, dbErr: dbErr.message },
            "[upload/profile] profiles.avatar_url sync failed — file uploaded but profile not updated",
          );
          res.status(500).json({
            error: "Photo uploaded but profile could not be updated. Please try again.",
          });
          return;
        }

        logger.info({ userId, url }, "[upload/profile] profiles.avatar_url updated ✓");

        // Step 4: Delete the previous file from Supabase Storage (non-blocking, non-fatal)
        // This prevents orphaned files accumulating every time a user changes their photo.
        if (oldAvatarUrl) {
          const PROFILES_PATH = "/storage/v1/object/public/profiles/";
          if (oldAvatarUrl.includes(PROFILES_PATH)) {
            const oldFilename = oldAvatarUrl.split(PROFILES_PATH)[1];
            if (oldFilename) {
              supabase.storage.from("profiles").remove([oldFilename]).then(({ error: delErr }) => {
                if (delErr) logger.warn({ oldFilename, err: delErr.message }, "[upload/profile] old avatar cleanup failed (non-fatal)");
                else logger.info({ oldFilename }, "[upload/profile] old avatar deleted from storage ✓");
              });
            }
          }
        }
      } else if (!userId) {
        logger.warn({ url }, "[upload/profile] no userId in request — skipping profiles.avatar_url sync");
      } else {
        logger.warn({ userId, url }, "[upload/profile] Supabase not configured — skipping profiles.avatar_url sync");
      }

      res.json({ success: true, fileUrl: url });
    } catch (e: any) {
      logger.error({ err: e?.message }, "[upload/profile] image processing failed");
      res.status(500).json({ error: e.message ?? "Image processing failed" });
    }
  },
);

// ── POST /api/upload/service ─────────────────────────────────────────────────
router.post(
  "/upload/service",
  multerUpload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "No image file provided. Use field name 'image'." }); return; }
    if (req.file.size > 5 * 1024 * 1024) { res.status(400).json({ error: "Service image must be under 5 MB." }); return; }
    try {
      const sharp = (await import("sharp")).default;
      const webp = await sharp(req.file.buffer).resize(800, 600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      const filename = `${Date.now()}.webp`;
      const url = await uploadToStorage(webp, "services", filename, req);
      res.json({ success: true, fileUrl: url });
    } catch (e: any) { res.status(500).json({ error: e.message ?? "Image processing failed" }); }
  },
);

// ── POST /api/upload/banner ──────────────────────────────────────────────────
router.post(
  "/upload/banner",
  multerUpload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "No image file provided. Use field name 'image'." }); return; }
    if (req.file.size > 5 * 1024 * 1024) { res.status(400).json({ error: "Banner image must be under 5 MB." }); return; }
    try {
      const sharp = (await import("sharp")).default;
      const webp = await sharp(req.file.buffer).resize(1200, 400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      const filename = `${Date.now()}.webp`;
      const url = await uploadToStorage(webp, "banners", filename, req);
      res.json({ success: true, fileUrl: url });
    } catch (e: any) { res.status(500).json({ error: e.message ?? "Image processing failed" }); }
  },
);

// ── POST /api/upload/document ────────────────────────────────────────────────
router.post(
  "/upload/document",
  multerUpload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "No image file provided. Use field name 'image'." }); return; }
    if (req.file.size > 8 * 1024 * 1024) { res.status(400).json({ error: "Document image must be under 8 MB." }); return; }
    try {
      const sharp = (await import("sharp")).default;
      const webp = await sharp(req.file.buffer).resize(1600, 2000, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      const filename = `${Date.now()}.webp`;
      const url = await uploadToStorage(webp, "documents", filename, req);
      res.json({ success: true, fileUrl: url });
    } catch (e: any) { res.status(500).json({ error: e.message ?? "Image processing failed" }); }
  },
);

export default router;
