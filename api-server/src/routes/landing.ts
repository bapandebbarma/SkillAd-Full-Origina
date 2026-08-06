/**
 * Landing-page public endpoints.
 * Aggregates real data only — no fabricated stats/reviews/cities.
 */
import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { CACHE_KEYS, getOrSetTtlAsync } from "../lib/ttlCache.js";

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

function readJson<T>(name: string, fallback: T): T {
  try {
    const f = resolve(DATA_DIR, `${name}.json`);
    if (!existsSync(f)) return fallback;
    return JSON.parse(readFileSync(f, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(name: string, data: unknown): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), "utf-8");
}

async function fetchSbProviders(): Promise<any[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from("providers").select("*");
    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id ?? row.user_id,
      name: row.name,
      category: row.category,
      location: row.location,
      latitude: row.latitude,
      longitude: row.longitude,
      rating: row.rating ?? 0,
      reviewCount: row.review_count ?? 0,
      suspended: row.suspended ?? false,
      blocked: row.blocked ?? false,
      verified: row.verified ?? true,
      available: row.available ?? true,
      experience: row.experience ?? 0,
      serviceRadius: row.service_radius ?? row.serviceRadius ?? 10,
      avatarUrl: row.avatar_url ?? row.avatarUrl,
      initials: row.initials,
      avatarColor: row.avatar_color ?? row.avatarColor,
      registeredAt: row.registered_at ?? row.created_at ?? row.registeredAt,
      subscriptionActive: row.subscription_active ?? row.subscriptionActive,
    }));
  } catch {
    return [];
  }
}

async function mergeProviders(): Promise<any[]> {
  const sb = await fetchSbProviders();
  const local = readJson<any[]>("providers", []);
  const ids = new Set(sb.map((p) => p.id));
  return [...sb, ...local.filter((p) => !ids.has(p.id))].filter(
    (p) => !p.suspended && !p.blocked,
  );
}

function cityName(location: string | undefined): string {
  if (!location) return "";
  return location.split(",")[0].trim();
}

// ── GET /api/cities — real coverage from provider locations ───────────────────
router.get("/cities", async (_req, res) => {
  try {
    const payload = await getOrSetTtlAsync(CACHE_KEYS.CITIES, async () => {
      const providers = await mergeProviders();
      const map = new Map<
        string,
        {
          name: string;
          providerCount: number;
          categories: Set<string>;
          latSum: number;
          lngSum: number;
          coordCount: number;
        }
      >();

      for (const p of providers) {
        const name = cityName(p.location);
        if (!name) continue;
        let entry = map.get(name);
        if (!entry) {
          entry = {
            name,
            providerCount: 0,
            categories: new Set(),
            latSum: 0,
            lngSum: 0,
            coordCount: 0,
          };
          map.set(name, entry);
        }
        entry.providerCount += 1;
        if (p.category) entry.categories.add(String(p.category));
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
          entry.latSum += lat;
          entry.lngSum += lng;
          entry.coordCount += 1;
        }
      }

      const cities = [...map.values()]
        .map((c) => ({
          name: c.name,
          providerCount: c.providerCount,
          categories: [...c.categories].sort(),
          categoryCount: c.categories.size,
          latitude: c.coordCount ? c.latSum / c.coordCount : null,
          longitude: c.coordCount ? c.lngSum / c.coordCount : null,
        }))
        .sort((a, b) => b.providerCount - a.providerCount);

      return { cities, total: cities.length };
    });
    res.json(payload);
  } catch (e) {
    logger.warn({ e }, "landing/cities failed");
    res.json({ cities: [], total: 0 });
  }
});

// ── GET /api/reviews/public — real reviews only ───────────────────────────────
router.get("/reviews/public", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "12"), 10) || 12, 50);
  try {
    const providers = await mergeProviders();
    const byId = new Map(providers.map((p) => [String(p.id), p]));
    const byUserId = new Map(
      providers.filter((p) => p.userId).map((p) => [String(p.userId), p]),
    );

    let rows: any[] = [];
    if (supabase) {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, provider_id, reviewer_name, reviewer_initials, rating, comment, created_at")
        .order("created_at", { ascending: false })
        .limit(limit * 2);
      if (!error && data) rows = data;
    }

    // Also collect embedded reviews from local/json providers
    const embedded: any[] = [];
    for (const p of providers) {
      if (!Array.isArray(p.reviews)) continue;
      for (const r of p.reviews) {
        embedded.push({
          id: r.id ?? `local-${p.id}-${r.createdAt ?? r.date ?? Math.random()}`,
          provider_id: p.id,
          reviewer_name: r.reviewerName ?? r.reviewer_name ?? r.name,
          reviewer_initials: r.reviewerInitials ?? r.reviewer_initials,
          rating: r.rating,
          comment: r.comment ?? r.text ?? "",
          created_at: r.createdAt ?? r.created_at ?? r.date,
          _provider: p,
        });
      }
    }

    const mapped = rows.map((r) => {
      const p = byId.get(String(r.provider_id)) ?? byUserId.get(String(r.provider_id));
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment ?? "",
        reviewerName: r.reviewer_name ?? "Customer",
        reviewerInitials:
          r.reviewer_initials ??
          String(r.reviewer_name ?? "C")
            .split(" ")
            .map((w: string) => w[0] ?? "")
            .join("")
            .toUpperCase()
            .slice(0, 2),
        city: cityName(p?.location) || null,
        providerName: p?.name ?? null,
        providerCategory: p?.category ?? null,
        createdAt: r.created_at,
      };
    });

    const fromEmbedded = embedded.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? "",
      reviewerName: r.reviewer_name ?? "Customer",
      reviewerInitials: r.reviewer_initials ?? "C",
      city: cityName(r._provider?.location) || null,
      providerName: r._provider?.name ?? null,
      providerCategory: r._provider?.category ?? null,
      createdAt: r.created_at,
    }));

    const seen = new Set<string>();
    const all = [...mapped, ...fromEmbedded]
      .filter((r) => r.rating >= 1 && (r.comment || "").trim().length > 0)
      .filter((r) => {
        const k = `${r.reviewerName}-${r.comment}-${r.createdAt}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, limit);

    res.json({ reviews: all, total: all.length });
  } catch (e) {
    logger.warn({ e }, "landing/reviews/public failed");
    res.json({ reviews: [], total: 0 });
  }
});

// ── GET /api/activity/live — real recent public-safe activity ─────────────────
router.get("/activity/live", async (_req, res) => {
  try {
    const payload = await getOrSetTtlAsync(CACHE_KEYS.ACTIVITY_LIVE, async () => {
      const providers = await mergeProviders();
      const earnings = readJson<any[]>("earnings", []);
      const subscriptions = readJson<any[]>("subscriptions", []);
      const categories = readJson<any[]>("categories", []);
      const users = readJson<any[]>("users", []);
      const appReviewsStore = readJson<{ reviews?: any[] } | any[]>("app_reviews", { reviews: [] });
      const appReviews = Array.isArray(appReviewsStore)
        ? appReviewsStore
        : (appReviewsStore.reviews ?? []);

      type Item = {
        type: string;
        id: string;
        title: string;
        subtitle?: string;
        at: string;
      };
      const items: Item[] = [];

      // New providers joined (public profile names are OK)
      for (const p of [...providers]
        .filter((p) => p.registeredAt || p.createdAt)
        .sort((a, b) =>
          String(b.registeredAt ?? b.createdAt ?? "").localeCompare(
            String(a.registeredAt ?? a.createdAt ?? ""),
          ),
        )
        .slice(0, 10)) {
        const city = cityName(p.location);
        items.push({
          type: "provider_joined",
          id: `pj-${p.id}`,
          title: "New provider joined",
          subtitle: [p.category, city].filter(Boolean).join(" · ") || undefined,
          at: String(p.registeredAt ?? p.createdAt),
        });
      }

      // Provider verified
      for (const p of [...providers]
        .filter((p) => p.verified && (p.verifiedAt || p.registeredAt))
        .sort((a, b) =>
          String(b.verifiedAt ?? b.registeredAt ?? "").localeCompare(
            String(a.verifiedAt ?? a.registeredAt ?? ""),
          ),
        )
        .slice(0, 8)) {
        items.push({
          type: "provider_verified",
          id: `pv-${p.id}`,
          title: "Provider verified",
          subtitle: [p.category, cityName(p.location)].filter(Boolean).join(" · ") || undefined,
          at: String(p.verifiedAt ?? p.registeredAt ?? p.updatedAt ?? ""),
        });
      }

      // Bookings completed — never expose customer names
      for (const e of [...earnings]
        .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
        .slice(0, 12)) {
        if (!e.createdAt) continue;
        items.push({
          type: "booking_completed",
          id: `bc-${e.id}`,
          title: "Booking completed",
          subtitle: e.service ? String(e.service).slice(0, 80) : "Service completed successfully",
          at: String(e.createdAt),
        });
      }

      // Subscriptions renewed / activated — no provider PII beyond plan name
      for (const s of [...subscriptions]
        .sort((a, b) =>
          String(b.startDate ?? b.updatedAt ?? "").localeCompare(
            String(a.startDate ?? a.updatedAt ?? ""),
          ),
        )
        .slice(0, 10)) {
        const at = s.startDate ?? s.updatedAt ?? s.createdAt;
        if (!at) continue;
        const plan = String(s.plan ?? "subscription").replace(/_/g, " ");
        items.push({
          type: "subscription_renewed",
          id: `sub-${s.id}`,
          title: s.status === "active" ? "Subscription activated" : "Subscription updated",
          subtitle: `${plan} plan`,
          at: String(at),
        });
      }

      // New customers joined — anonymized
      for (const u of [...users]
        .filter((u) => !u.isProvider && (u.createdAt || u.registeredAt))
        .sort((a, b) =>
          String(b.createdAt ?? b.registeredAt ?? "").localeCompare(
            String(a.createdAt ?? a.registeredAt ?? ""),
          ),
        )
        .slice(0, 8)) {
        items.push({
          type: "customer_joined",
          id: `cj-${u.id}`,
          title: "New customer joined",
          subtitle: "Welcome to SkillAd",
          at: String(u.createdAt ?? u.registeredAt),
        });
      }

      // Cities with providers (activation = earliest provider registration in that city)
      const cityFirst = new Map<string, string>();
      for (const p of providers) {
        const city = cityName(p.location);
        const at = String(p.registeredAt ?? p.createdAt ?? "");
        if (!city || !at) continue;
        const prev = cityFirst.get(city);
        if (!prev || at < prev) cityFirst.set(city, at);
      }
      for (const [city, at] of [...cityFirst.entries()]
        .sort((a, b) => String(b[1]).localeCompare(String(a[1])))
        .slice(0, 6)) {
        items.push({
          type: "city_activated",
          id: `city-${city.toLowerCase().replace(/\s+/g, "-")}`,
          title: "New city activated",
          subtitle: city,
          at,
        });
      }

      // Categories added
      for (const c of [...categories]
        .filter((c) => c.createdAt || c.updatedAt)
        .sort((a, b) =>
          String(b.createdAt ?? b.updatedAt ?? "").localeCompare(
            String(a.createdAt ?? a.updatedAt ?? ""),
          ),
        )
        .slice(0, 6)) {
        items.push({
          type: "category_added",
          id: `cat-${c.id}`,
          title: "New category added",
          subtitle: c.name ? String(c.name) : undefined,
          at: String(c.createdAt ?? c.updatedAt),
        });
      }

      // Provider reviews submitted — anonymized (no reviewer names)
      if (supabase) {
        const { data } = await supabase
          .from("reviews")
          .select("id, rating, created_at")
          .order("created_at", { ascending: false })
          .limit(10);
        for (const r of data ?? []) {
          items.push({
            type: "review_submitted",
            id: `rev-${r.id}`,
            title: "New review submitted",
            subtitle: `${r.rating}★ rating on a provider`,
            at: String(r.created_at),
          });
        }
      }

      // Platform app reviews (approved only for public feed)
      for (const r of appReviews.filter((x: any) => x.status === "approved" && x.createdAt).slice(0, 8)) {
        items.push({
          type: "app_review",
          id: `ar-${r.id}`,
          title: "New SkillAd app review",
          subtitle: `${r.rating}★ platform feedback`,
          at: String(r.createdAt),
        });
      }

      const seen = new Set<string>();
      const sorted = items
        .filter((i) => i.at && !Number.isNaN(new Date(i.at).getTime()))
        .filter((i) => {
          const k = `${i.type}-${i.id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .slice(0, 24);

      return { items: sorted };
    });
    res.json(payload);
  } catch (e) {
    logger.warn({ e }, "landing/activity/live failed");
    res.json({ items: [] });
  }
});

export default router;
