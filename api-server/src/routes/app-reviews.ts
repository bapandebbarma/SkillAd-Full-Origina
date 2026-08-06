/**
 * Platform app reviews — feedback about SkillAd itself (NOT provider reviews).
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger.js";
import {
  appReviewsRepo,
  findRecentActiveReview,
  REVIEW_COOLDOWN_DAYS,
  type AppReview,
  type AppReviewStatus,
  type AppReviewUserType,
} from "../lib/appReviewsStore.js";

const router = Router();

const COOLDOWN_MESSAGE =
  "You recently submitted feedback. Thank you. You can submit another review after 90 days.";

function initialsFrom(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

function publicShape(r: AppReview) {
  return {
    id: r.id,
    rating: r.rating,
    text: r.text,
    suggestion: r.suggestion || undefined,
    displayName: r.displayName || "SkillAd user",
    city: r.city || undefined,
    initials: initialsFrom(r.displayName || "U"),
    featured: r.featured,
    createdAt: r.createdAt,
  };
}

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env["ADMIN_KEY"] ?? "skillad-admin";
  const provided = req.headers["x-admin-key"];
  if (provided !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function parseUserType(raw: unknown): AppReviewUserType | null {
  const s = String(raw ?? "").trim();
  if (s === "Customer" || s === "Provider") return s;
  if (s.toLowerCase() === "customer") return "Customer";
  if (s.toLowerCase() === "provider") return "Provider";
  return null;
}

// ── GET /api/app-reviews — approved only ──────────────────────────────────────
router.get("/app-reviews", (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "24"), 10) || 24, 100);
  const featuredOnly =
    String(req.query.featured ?? "") === "1" || String(req.query.featured ?? "") === "true";
  let list = appReviewsRepo.list().filter((r) => r.status === "approved");
  if (featuredOnly) list = list.filter((r) => r.featured);
  list.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
  res.json({ reviews: list.slice(0, limit).map(publicShape), total: list.length });
});

// ── GET /api/app-reviews/stats ────────────────────────────────────────────────
router.get("/app-reviews/stats", (_req, res) => {
  const approved = appReviewsRepo.list().filter((r) => r.status === "approved");
  const count = approved.length;
  const average =
    count === 0 ? 0 : Math.round((approved.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
  const featured = approved.filter((r) => r.featured).length;
  res.json({ average, count, featured });
});

// ── GET /api/app-reviews/eligibility — 90-day cooldown check ──────────────────
router.get("/app-reviews/eligibility", (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) {
    res.json({ eligible: true });
    return;
  }
  const recent = findRecentActiveReview(appReviewsRepo.list(), userId);
  if (!recent) {
    res.json({ eligible: true });
    return;
  }
  const nextEligibleAt = new Date(
    new Date(recent.createdAt).getTime() + REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  res.json({
    eligible: false,
    nextEligibleAt,
    message: COOLDOWN_MESSAGE,
  });
});

// ── POST /api/app-reviews — submit (pending until admin approves) ─────────────
router.post("/app-reviews", (req, res) => {
  const {
    rating,
    text,
    suggestion,
    displayName,
    userId,
    userType,
    city,
    appVersion,
    platform,
  } = req.body as {
    rating?: number;
    text?: string;
    suggestion?: string;
    displayName?: string;
    userId?: string;
    userType?: string;
    city?: string;
    appVersion?: string;
    platform?: string;
  };

  const ratingNum = typeof rating === "number" ? rating : Number(rating);
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    res.status(400).json({ error: "rating must be between 1 and 5" });
    return;
  }
  const body = String(text ?? "").trim();
  if (body.length < 5) {
    res.status(400).json({ error: "Please write at least a short review (5+ characters)." });
    return;
  }
  if (body.length > 2000) {
    res.status(400).json({ error: "Review text is too long." });
    return;
  }

  const uid = userId ? String(userId).slice(0, 120) : null;
  const all = appReviewsRepo.list();

  // One active (pending/approved) review per user every 90 days
  if (uid) {
    const recent = findRecentActiveReview(all, uid);
    if (recent) {
      res.status(409).json({ error: COOLDOWN_MESSAGE });
      return;
    }
  }

  const now = new Date().toISOString();
  const review: AppReview = {
    id: `ar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rating: Math.round(ratingNum),
    text: body.slice(0, 2000),
    suggestion: String(suggestion ?? "").trim().slice(0, 1000),
    displayName: String(displayName ?? "SkillAd user").trim().slice(0, 80) || "SkillAd user",
    userId: uid,
    userType: parseUserType(userType),
    city: city ? String(city).trim().slice(0, 80) : null,
    appVersion: appVersion ? String(appVersion).trim().slice(0, 40) : null,
    platform: platform ? String(platform).trim().slice(0, 40) : null,
    status: "pending",
    featured: false,
    createdAt: now,
    updatedAt: now,
  };

  all.unshift(review);
  appReviewsRepo.save(all.slice(0, 2000));
  logger.info({ id: review.id, userType: review.userType }, "app-review: submitted");
  res.status(201).json({ success: true, id: review.id, status: review.status });
});

// ── Admin: list all ───────────────────────────────────────────────────────────
router.get("/admin/app-reviews", adminAuth, (_req, res) => {
  const reviews = appReviewsRepo.list().sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  res.json({ reviews });
});

// ── Admin: update status / featured ───────────────────────────────────────────
router.patch("/admin/app-reviews/:id", adminAuth, (req, res) => {
  const id = req.params["id"];
  const { status, featured, text, rating } = req.body as {
    status?: AppReviewStatus;
    featured?: boolean;
    text?: string;
    rating?: number;
  };
  const reviews = appReviewsRepo.list();
  const idx = reviews.findIndex((r) => r.id === id);
  if (idx < 0) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  const current = reviews[idx]!;
  if (status && ["pending", "approved", "hidden"].includes(status)) {
    current.status = status;
  }
  if (typeof featured === "boolean") current.featured = featured;
  if (typeof text === "string") current.text = text.trim().slice(0, 2000);
  if (typeof rating === "number" && rating >= 1 && rating <= 5) current.rating = Math.round(rating);
  current.updatedAt = new Date().toISOString();
  reviews[idx] = current;
  appReviewsRepo.save(reviews);
  res.json({ success: true, review: current });
});

// ── Admin: delete ─────────────────────────────────────────────────────────────
router.delete("/admin/app-reviews/:id", adminAuth, (req, res) => {
  const id = req.params["id"];
  const before = appReviewsRepo.list();
  const after = before.filter((r) => r.id !== id);
  if (after.length === before.length) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  appReviewsRepo.save(after);
  res.json({ success: true });
});

export default router;
