import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

function readNotifications(): any[] {
  try {
    const f = resolve(DATA_DIR, "notifications.json");
    if (!existsSync(f)) return [];
    return JSON.parse(readFileSync(f, "utf-8")) as any[];
  } catch { return []; }
}

function writeNotifications(data: any[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, "notifications.json"), JSON.stringify(data, null, 2), "utf-8");
}

// ── POST /api/reviews ─────────────────────────────────────────────────────────
// Submit a review for a provider. Uses service role key — bypasses RLS.
router.post("/reviews", async (req, res) => {
  const { providerId, reviewerId, reviewerName, rating, comment } = req.body as {
    providerId?: string;
    reviewerId?: string;
    reviewerName?: string;
    rating?: number;
    comment?: string;
  };

  if (!providerId || !reviewerId || !reviewerName || typeof rating !== "number") {
    res.status(400).json({ error: "providerId, reviewerId, reviewerName, and rating are required" });
    return;
  }
  if (rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating must be between 1 and 5" });
    return;
  }
  if (!supabase) {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  // Prevent duplicate reviews from the same reviewer for the same provider
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("provider_id", providerId)
    .eq("reviewer_id", reviewerId)
    .maybeSingle();

  if (existing) {
    res.status(409).json({ error: "You have already reviewed this provider." });
    return;
  }

  const initials = reviewerName
    .split(" ")
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const { error: insertError } = await supabase.from("reviews").insert({
    provider_id: providerId,
    reviewer_id: reviewerId,
    reviewer_name: reviewerName,
    reviewer_initials: initials,
    rating,
    comment: comment ?? "",
  });

  if (insertError) {
    logger.warn({ insertError }, "reviews: insert failed");
    res.status(500).json({ error: insertError.message });
    return;
  }

  // Recalculate average rating and review count for the provider
  const { data: allReviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("provider_id", providerId);

  if (allReviews && allReviews.length > 0) {
    const avg = allReviews.reduce((sum: number, r: any) => sum + (r.rating ?? 0), 0) / allReviews.length;
    await supabase
  .from("providers")
  .update({
    rating: parseFloat(avg.toFixed(1)),
    review_count: allReviews.length
  })
  .eq("user_id", providerId);
  }

  // ── Notify the provider about the new review ──────────────────────────────
  // This runs after responding so it never blocks the API caller.
  (async () => {
    try {
      // Find provider's auth user_id and name
      const { data: provRow } = await supabase!
        .from("providers")
        .select("user_id, name")
        .eq("user_id", providerId)
        .maybeSingle();

      const providerUserId = provRow?.user_id as string | null;
      if (!providerUserId) return;

      const stars = "⭐".repeat(Math.min(Math.round(rating), 5));
      const snippet = (comment ?? "").slice(0, 60);
      const notifTitle = `New Review ${stars}`;
      const notifBody = snippet
        ? `${reviewerName} gave you ${rating} stars — "${snippet}"`
        : `${reviewerName} gave you ${rating} stars`;
      const notifId = `review-${providerId.slice(0, 8)}-${Date.now()}`;

      // Always persist to notifications.json so it shows on Notification page
      try {
        const all = readNotifications();
        if (!all.some((n: any) => n.id === notifId)) {
          all.unshift({
            id: notifId,
            title: notifTitle,
            body: notifBody,
            type: "review",
            targetUserId: providerUserId,
            data: { type: "review", providerId, reviewerName, rating },
            sentAt: new Date().toISOString(),
            read: false,
          });
          writeNotifications(all.slice(0, 500));
        }
      } catch { /* non-fatal */ }

      // Push notification if provider has a registered token
      const { data: profRow } = await supabase!
        .from("profiles")
        .select("push_token")
        .eq("id", providerUserId)
        .maybeSingle();

      const pushToken = profRow?.push_token as string | undefined;
      if (pushToken?.startsWith("ExponentPushToken")) {
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to:        pushToken,
            sound:     "default",
            title:     notifTitle,
            body:      notifBody,
            data:      { type: "review", providerId, reviewerName, rating },
            priority:  "high",
            channelId: "default",
          }),
        }).catch(() => {});
      }

      logger.info({ providerId: providerId.slice(0, 8), reviewerName }, "reviews: provider notified");
    } catch (e) {
      logger.warn({ e }, "reviews: provider notification failed (non-fatal)");
    }
  })().catch(() => {});

  res.json({ success: true });
});

export default router;
