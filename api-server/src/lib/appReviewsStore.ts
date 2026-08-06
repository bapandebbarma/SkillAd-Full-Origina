/**
 * App reviews storage abstraction.
 * JSON file today — swap `appReviewsRepo` for a Supabase implementation later
 * without changing route handlers.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

export type AppReviewStatus = "pending" | "approved" | "hidden";
export type AppReviewUserType = "Customer" | "Provider";

export interface AppReview {
  id: string;
  rating: number;
  text: string;
  suggestion: string;
  displayName: string;
  userId: string | null;
  userType: AppReviewUserType | null;
  city: string | null;
  appVersion: string | null;
  platform: string | null;
  status: AppReviewStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppReviewsRepository {
  list(): AppReview[];
  save(reviews: AppReview[]): void;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");
const FILE = "app_reviews";

function normalize(raw: Partial<AppReview> & { id: string }): AppReview {
  return {
    id: raw.id,
    rating: Number(raw.rating) || 0,
    text: String(raw.text ?? ""),
    suggestion: String(raw.suggestion ?? ""),
    displayName: String(raw.displayName ?? "SkillAd user"),
    userId: raw.userId ?? null,
    userType: raw.userType === "Customer" || raw.userType === "Provider" ? raw.userType : null,
    city: raw.city ? String(raw.city) : null,
    appVersion: raw.appVersion ? String(raw.appVersion) : null,
    platform: raw.platform ? String(raw.platform) : null,
    status: (raw.status as AppReviewStatus) || "pending",
    featured: Boolean(raw.featured),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? new Date().toISOString()),
  };
}

class JsonAppReviewsRepository implements AppReviewsRepository {
  list(): AppReview[] {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const f = resolve(DATA_DIR, `${FILE}.json`);
      if (!existsSync(f)) return [];
      const raw = JSON.parse(readFileSync(f, "utf-8")) as { reviews?: Partial<AppReview>[] } | Partial<AppReview>[];
      const arr = Array.isArray(raw) ? raw : (raw.reviews ?? []);
      return arr.filter((r) => r && r.id).map((r) => normalize(r as Partial<AppReview> & { id: string }));
    } catch {
      return [];
    }
  }

  save(reviews: AppReview[]): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(
      resolve(DATA_DIR, `${FILE}.json`),
      JSON.stringify({ reviews }, null, 2),
      "utf-8",
    );
  }
}

/** Active repository — replace with SupabaseAppReviewsRepository when migrating. */
export const appReviewsRepo: AppReviewsRepository = new JsonAppReviewsRepository();

export const REVIEW_COOLDOWN_DAYS = 90;
export const REVIEW_COOLDOWN_MS = REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export function findRecentActiveReview(
  reviews: AppReview[],
  userId: string,
  withinMs: number = REVIEW_COOLDOWN_MS,
): AppReview | undefined {
  const cutoff = Date.now() - withinMs;
  return reviews.find((r) => {
    if (r.userId !== userId) return false;
    if (r.status !== "pending" && r.status !== "approved") return false;
    const created = new Date(r.createdAt).getTime();
    return Number.isFinite(created) && created >= cutoff;
  });
}
