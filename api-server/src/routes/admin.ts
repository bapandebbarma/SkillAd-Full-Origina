import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { extname } from "path";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { countNewContactMessages } from "../lib/contactMessagesStore.js";
import {
  CACHE_KEYS,
  getCachedJsonFileClone,
  getOrSetTtlAsync,
  invalidateCategoryDependentCaches,
  invalidateLandingAggregates,
  isCachedJsonFile,
  setCachedJsonFile,
} from "../lib/ttlCache.js";

// Extract Supabase base URL (EXPO_PUBLIC_SUPABASE_URL may include /rest/v1/ path)
const SUPABASE_URL = (() => {
  const raw = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
  try { const u = new URL(raw); return `${u.protocol}//${u.host}`; } catch { return raw.replace(/\/rest\/v1.*$/, "").replace(/\/$/, ""); }
})();
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

function supabaseAdminHeaders() {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" };
}

const router: IRouter = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

function dataFile(name: string) {
  return resolve(DATA_DIR, `${name}.json`);
}

function readJson<T>(name: string, fallback: T): T {
  try {
    if (isCachedJsonFile(name)) {
      const cached = getCachedJsonFileClone<T>(name);
      if (cached !== undefined) return cached;
    }
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const f = dataFile(name);
    if (existsSync(f)) {
      const data = JSON.parse(readFileSync(f, "utf-8")) as T;
      if (isCachedJsonFile(name)) setCachedJsonFile(name, data);
      return isCachedJsonFile(name) ? (JSON.parse(JSON.stringify(data)) as T) : data;
    }
  } catch { /* fall through */ }
  return fallback;
}

function writeJson(name: string, data: unknown): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(dataFile(name), JSON.stringify(data, null, 2), "utf-8");
  if (isCachedJsonFile(name)) setCachedJsonFile(name, data);
  if (name === "categories") invalidateCategoryDependentCaches();
  if (name === "providers") invalidateLandingAggregates();
}

// ── Auth middleware ──────────────────────────────────────────────────────────
function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env["ADMIN_KEY"] ?? "skillad-admin";
  const provided = req.headers["x-admin-key"];
  if (provided !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use("/admin", adminAuth);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchSupabaseProviders(): Promise<any[]> {
  if (!supabase) return [];
  try {
    // No .order() — avoids failures if expected sort columns don't exist
    const { data, error } = await supabase
      .from("providers")
      .select("*");
    if (error) {
      console.error("fetchSupabaseProviders error:", error.message, error.details, error.hint);
      return [];
    }
    if (!data) return [];

    // Enrich with profiles.avatar_url — the providers table has no avatar column;
    // the single source of truth is profiles.avatar_url keyed on providers.user_id.
    const userIds = data.map((r: any) => r.user_id).filter(Boolean) as string[];
    const avatarMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      try {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .in("id", userIds);
        (profileRows ?? []).forEach((p: any) => avatarMap.set(p.id, p.avatar_url ?? null));
      } catch { /* best-effort */ }
    }

    return data.map((r: any) => ({
      id: r.id,
      userId: r.user_id ?? null,
      name: r.name,
      category: r.category,
      subcategory: r.subcategory ?? null,
      location: r.location ?? "",
      available: r.available ?? true,
      verified: r.verified ?? false,
      suspended: r.suspended ?? false,
      blocked: r.blocked ?? false,
      rating: r.rating ?? 0,
      reviewCount: r.review_count ?? r.reviews?.length ?? 0,
      experience: r.experience ?? 0,
      serviceRadius: r.service_radius ?? 50,
      serviceCharge: r.service_charge ?? null,
      workingHours: r.working_hours ?? "",
      phone: r.phone ?? "",
      description: r.description ?? "",
      latitude: r.latitude ?? 23.8315,
      longitude: r.longitude ?? 91.2868,
      initials: r.initials ?? r.name?.slice(0, 2).toUpperCase() ?? "PR",
      avatarColor: r.avatar_color ?? "#64748B",
      avatarUrl: avatarMap.get(r.user_id) ?? null,
      services: r.services ?? [],
      registeredAt: r.registered_at ?? r.created_at ?? new Date().toISOString(),
      subscriptionEndDate: r.subscription_end_date ?? null,
      _source: "supabase",
    }));
  } catch (err: any) {
    console.error("fetchSupabaseProviders exception:", err?.message ?? err);
    return [];
  }
}

async function fetchSupabaseUsers(): Promise<any[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return [];
  try {
    // List real auth users via admin HTTP API
    const authRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers: supabaseAdminHeaders() },
    );
    if (!authRes.ok) return [];
    const authData = await authRes.json() as { users?: any[] };
    const authUsers = (authData.users ?? []).filter(
      (u: any) => (u.email as string)?.endsWith("@users.skillad.in"),
    );

    if (authUsers.length === 0) return [];

    // Fetch profiles for supplemental data (name, phone, language, city, blocked, avatar)
    let profileMap = new Map<string, any>();
    if (supabase) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, phone, avatar_url, language, last_city, blocked, created_at");
      (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
    }

    // Fetch all provider user_ids so we can flag which users are providers
    let providerUserIds = new Set<string>();
    if (supabase) {
      const { data: providers } = await supabase
        .from("providers")
        .select("user_id")
        .not("user_id", "is", null);
      (providers ?? []).forEach((p: any) => {
        if (p.user_id) providerUserIds.add(p.user_id);
      });

      // Also check local JSON providers
      const localProviders = readJson<any[]>("providers", []);
      localProviders.forEach((p: any) => {
        if (p.userId) providerUserIds.add(p.userId);
      });
    }

    return authUsers.map((u: any) => {
      const profile = profileMap.get(u.id);
      const digits = (u.email as string).replace("@users.skillad.in", "");
      return {
        id: u.id,
        name: profile?.name ?? u.user_metadata?.name ?? "User",
        phone: profile?.phone ?? `+91${digits}`,
        isProvider: providerUserIds.has(u.id),
        avatarUrl: profile?.avatar_url ?? null,
        language: profile?.language ?? "English",
        city: profile?.last_city ?? "",
        blocked: profile?.blocked ?? false,
        createdAt: profile?.created_at ?? u.created_at,
        source: "supabase",
      };
    });
  } catch (err) {
    console.error("fetchSupabaseUsers error:", err);
    return [];
  }
}

// ── Stats ────────────────────────────────────────────────────────────────────
router.get("/admin/stats", async (_req, res) => {
  const ads = await readAds();

  // Merge Supabase providers with local JSON providers (same as /admin/providers)
  const sbProviders = await fetchSupabaseProviders();
  const localProviders = readJson<any[]>("providers", []);
  const sbIds = new Set(sbProviders.map((p: any) => p.id));
  const localOnly = localProviders.filter((p: any) => !sbIds.has(p.id));
  const providers = [
    ...sbProviders,
    ...localOnly.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? "",
      location: p.city ?? p.location ?? "",
      verified: p.verified ?? false,
      suspended: p.suspended ?? false,
      blocked: p.blocked ?? false,
      registeredAt: p.registeredAt ?? p.created_at ?? new Date().toISOString(),
    })),
  ];

  const sbUsers = await fetchSupabaseUsers();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

  const newToday = providers.filter((p) => (p.registeredAt ?? "").startsWith(today)).length;
  const newWeek = providers.filter((p) => (p.registeredAt ?? "") >= weekAgo).length;
  const newMonth = providers.filter((p) => (p.registeredAt ?? "") >= monthAgo).length;

  const catCounts: Record<string, number> = {};
  for (const p of providers) {
    catCounts[p.category] = (catCounts[p.category] ?? 0) + 1;
  }
  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const locationCounts: Record<string, number> = {};
  for (const p of providers) {
    const loc = (p.location ?? "Unknown").split(",")[0].trim();
    locationCounts[loc] = (locationCounts[loc] ?? 0) + 1;
  }
  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const activeProviders = providers.filter((p) => !p.suspended && !p.blocked).length;
  const verifiedProviders = providers.filter((p) => p.verified).length;
  const activeAds = ads.filter((a: any) => a.active).length;

  const totalUsers = sbUsers.length;

  // Registration trend — last 30 days
  const trend: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const count = providers.filter((p) => (p.registeredAt ?? "").startsWith(dateStr)).length;
    trend.push({ date: dateStr, count });
  }

  // ── Earnings aggregate from earnings.json ─────────────────────────────────
  const earningsAll = readJson<any[]>("earnings", []);
  const earningsNow = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const sevenDaysMs  =  7 * 24 * 60 * 60 * 1000;

  const totalEarningsAll   = earningsAll.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthlyEarningsAll = earningsAll
    .filter((e) => earningsNow - new Date(e.createdAt as string).getTime() <= thirtyDaysMs)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const weeklyEarningsAll  = earningsAll
    .filter((e) => earningsNow - new Date(e.createdAt as string).getTime() <= sevenDaysMs)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const completedJobs  = earningsAll.length;
  const avgJobValue    = completedJobs > 0 ? Math.round(totalEarningsAll / completedJobs) : 0;

  // Per-provider breakdown (top 10 by earnings)
  const earningsByProv = new Map<string, number>();
  for (const e of earningsAll) {
    const pid = String(e.providerId ?? "");
    if (pid) earningsByProv.set(pid, (earningsByProv.get(pid) ?? 0) + (Number(e.amount) || 0));
  }
  const topEarners = [...earningsByProv.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([providerId, amount]) => ({ providerId, amount }));

  let newContactMessages = 0;
  try {
    newContactMessages = await countNewContactMessages();
  } catch {
    newContactMessages = 0;
  }

  res.json({
    providers: {
      total: providers.length,
      active: activeProviders,
      verified: verifiedProviders,
      newToday,
      newWeek,
      newMonth,
    },
    users: {
      total: totalUsers,
      active: sbUsers.filter((u) => !u.blocked).length,
    },
    ads: { total: ads.length, active: activeAds },
    contactMessages: {
      new: newContactMessages,
    },
    topCategories,
    topLocations,
    registrationTrend: trend,
    earnings: {
      totalEarnings:   totalEarningsAll,
      monthlyEarnings: monthlyEarningsAll,
      weeklyEarnings:  weeklyEarningsAll,
      completedJobs,
      avgJobValue,
      topEarners,
    },
  });
});

// ── Rankings ──────────────────────────────────────────────────────────────────
// GET /api/admin/rankings
// Aggregates earnings, review counts, completed jobs, and accepted bookings
// per provider. All data from real sources only (earnings.json + providers + Supabase messages).
router.get("/admin/rankings", async (_req, res) => {
  // 1. Load merged providers
  const sbProviders = await fetchSupabaseProviders();
  const localProviders = readJson<any[]>("providers", []);
  const sbIds = new Set(sbProviders.map((p: any) => p.id));
  const allProviders: any[] = [
    ...sbProviders,
    ...localProviders
      .filter((p: any) => !sbIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        userId: p.userId ?? null,
        name: p.name,
        category: p.category ?? "",
        location: p.location ?? p.city ?? "",
        available: p.available ?? true,
        verified: p.verified ?? false,
        suspended: p.suspended ?? false,
        blocked: p.blocked ?? false,
        rating: p.rating ?? 0,
        reviewCount: p.reviewCount ?? 0,
        initials: p.initials ?? (p.name ?? "").slice(0, 2).toUpperCase(),
        avatarColor: p.avatarColor ?? "#64748B",
        avatarUrl: p.avatarUrl ?? null,
        photo: p.photo ?? null,
        registeredAt: p.registeredAt ?? p.created_at ?? null,
        _source: "local",
      })),
  ];

  // 2. Earnings.json → totalEarnings + completedJobs per providerId
  const earnings = readJson<any[]>("earnings", []);
  const earningsMap: Record<string, { total: number; count: number }> = {};
  for (const e of earnings) {
    const pid = String(e.providerId ?? "");
    if (!pid) continue;
    if (!earningsMap[pid]) earningsMap[pid] = { total: 0, count: 0 };
    earningsMap[pid].total += Number(e.amount ?? 0);
    earningsMap[pid].count += 1;
  }

  // 3. Supabase messages → accepted booking counts per provider
  const acceptedMap: Record<string, number> = {};
  if (supabase) {
    try {
      const { data: msgs } = await supabase
        .from("messages")
        .select("provider_id, booking_status")
        .eq("type", "booking")
        .not("booking_status", "is", null)
        .limit(5000);
      for (const m of (msgs ?? [])) {
        const pid = String(m.provider_id ?? "");
        if (!pid) continue;
        if (["accepted", "provider_completed", "customer_confirmed_completed", "disputed"].includes(m.booking_status)) {
          acceptedMap[pid] = (acceptedMap[pid] ?? 0) + 1;
        }
      }
    } catch { /* best-effort */ }
  }

  // 4. Build enriched rows
  const providers = allProviders.map((p: any) => {
    const pid = String(p.id);
    const emap = earningsMap[pid] ?? { total: 0, count: 0 };
    const accepted = acceptedMap[pid] ?? acceptedMap[String(p.userId ?? "")] ?? 0;
    const parts = (p.location ?? "").split(",");
    const state = parts.length > 1 ? parts[parts.length - 1].trim() : parts[0]?.trim() ?? "Unknown";
    return {
      id: pid,
      name: p.name ?? "Unknown",
      category: p.category ?? "",
      location: p.location ?? "",
      state,
      initials: p.initials ?? (p.name ?? "").slice(0, 2).toUpperCase() ?? "??",
      avatarColor: p.avatarColor ?? "#64748B",
      avatarUrl: p.avatarUrl ?? p.photo ?? null,
      rating: Number(p.rating ?? 0),
      reviewCount: Number(p.reviewCount ?? p.review_count ?? 0),
      completedJobs: emap.count,
      totalEarnings: emap.total,
      acceptedRequests: accepted,
      registeredAt: p.registeredAt ?? null,
      verified: Boolean(p.verified),
      available: Boolean(p.available),
    };
  });

  res.json({ providers });
});

// ── State Analytics ──────────────────────────────────────────────────────────
// GET /api/admin/state-analytics?state=All+India
// Returns list of real states extracted from provider locations, plus aggregated
// KPIs, category breakdown, and top providers for the selected state.
router.get("/admin/state-analytics", async (req, res) => {
  const { state } = req.query as { state?: string };

  function extractState(location: string): string {
    const parts = (location ?? "").split(",");
    const s = parts.length > 1 ? parts[parts.length - 1].trim() : parts[0]?.trim() ?? "";
    return s || "Unknown";
  }

  // 1. Load merged providers
  const sbProviders = await fetchSupabaseProviders();
  const localProviders = readJson<any[]>("providers", []);
  const sbIds = new Set(sbProviders.map((p: any) => p.id));
  const allProviders: any[] = [
    ...sbProviders,
    ...localProviders
      .filter((p: any) => !sbIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        userId: p.userId ?? null,
        name: p.name,
        category: p.category ?? "",
        location: p.location ?? p.city ?? "",
        available: p.available ?? true,
        verified: p.verified ?? false,
        suspended: p.suspended ?? false,
        blocked: p.blocked ?? false,
        rating: p.rating ?? 0,
        reviewCount: p.reviewCount ?? 0,
        initials: p.initials ?? (p.name ?? "").slice(0, 2).toUpperCase(),
        avatarColor: p.avatarColor ?? "#64748B",
        avatarUrl: p.avatarUrl ?? null,
        registeredAt: p.registeredAt ?? p.created_at ?? null,
      })),
  ];

  // 2. Unique states from real provider locations
  const stateSet = new Set<string>();
  for (const p of allProviders) {
    const s = extractState(p.location ?? "");
    if (s && s !== "Unknown") stateSet.add(s);
  }
  const states = ["All India", ...Array.from(stateSet).sort()];

  // 3. Filter providers by selected state
  const selectedState = state && state !== "All India" ? state : null;
  const filtered = selectedState
    ? allProviders.filter((p: any) => extractState(p.location ?? "") === selectedState)
    : allProviders;

  // 4. Earnings for filtered providers
  const earnings = readJson<any[]>("earnings", []);
  const filteredIds = new Set(filtered.map((p: any) => String(p.id)));
  const filteredEarnings = selectedState
    ? earnings.filter((e: any) => filteredIds.has(String(e.providerId ?? "")))
    : earnings;

  // 5. Aggregate KPIs
  const totalEarnings = filteredEarnings.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  const completedJobs = filteredEarnings.length;
  const avgRating = filtered.length > 0
    ? filtered.reduce((s: number, p: any) => s + Number(p.rating ?? 0), 0) / filtered.length
    : 0;
  const totalReviews = filtered.reduce((s: number, p: any) => s + Number(p.reviewCount ?? 0), 0);

  // 6. User count (customers, not providers) from Supabase profiles
  let totalCustomers = 0;
  if (supabase) {
    try {
      if (selectedState) {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_provider", false)
          .ilike("last_city", `%${selectedState}%`);
        totalCustomers = count ?? 0;
      } else {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_provider", false);
        totalCustomers = count ?? 0;
      }
    } catch { /* best-effort */ }
  }

  // 7. Category distribution
  const catMap: Record<string, number> = {};
  for (const p of filtered) {
    if (p.category) catMap[p.category] = (catMap[p.category] ?? 0) + 1;
  }
  const categoryBreakdown = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // 8. Top providers by earnings
  const earningsPerProvider: Record<string, number> = {};
  for (const e of filteredEarnings) {
    const pid = String(e.providerId ?? "");
    if (pid) earningsPerProvider[pid] = (earningsPerProvider[pid] ?? 0) + Number(e.amount ?? 0);
  }
  const topProviders = filtered
    .map((p: any) => ({
      id: String(p.id),
      name: p.name ?? "Unknown",
      category: p.category ?? "",
      rating: Number(p.rating ?? 0),
      reviewCount: Number(p.reviewCount ?? 0),
      totalEarnings: earningsPerProvider[String(p.id)] ?? 0,
      initials: p.initials ?? (p.name ?? "").slice(0, 2).toUpperCase(),
      avatarColor: p.avatarColor ?? "#64748B",
      avatarUrl: p.avatarUrl ?? null,
    }))
    .sort((a: any, b: any) => b.totalEarnings - a.totalEarnings || b.rating - a.rating)
    .slice(0, 15);

  res.json({
    states,
    selectedState: state ?? "All India",
    stats: {
      totalProviders: filtered.length,
      activeProviders: filtered.filter((p: any) => p.available && !p.suspended && !p.blocked).length,
      verifiedProviders: filtered.filter((p: any) => p.verified).length,
      totalEarnings,
      completedJobs,
      avgRating: parseFloat(avgRating.toFixed(1)),
      totalCustomers,
      totalReviews,
    },
    categoryBreakdown,
    topProviders,
  });
});

// ── Debug endpoint ────────────────────────────────────────────────────────────

// GET /admin/debug-supabase — tests Supabase connection and returns raw query info
router.get("/admin/debug-supabase", async (_req, res) => {
  if (!supabase) {
    res.json({ connected: false, reason: "supabase client is null — check EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars" });
    return;
  }
  try {
    const { data, error, count } = await supabase
      .from("providers")
      .select("id, user_id, name, verified", { count: "exact" });
    if (error) {
      res.json({ connected: true, queryError: error.message, details: error.details, hint: error.hint });
      return;
    }
    res.json({
      connected: true,
      totalRows: count ?? data?.length ?? 0,
      sample: (data ?? []).slice(0, 5).map((r: any) => ({ id: r.id, name: r.name, verified: r.verified })),
    });
  } catch (err: any) {
    res.json({ connected: true, exception: err?.message ?? String(err) });
  }
});

// ── Providers admin actions ──────────────────────────────────────────────────

// GET /admin/providers — returns ALL providers: local JSON + Supabase merged
router.get("/admin/providers", async (_req, res) => {
  const sbProviders = await fetchSupabaseProviders();
  const localProviders = readJson<any[]>("providers", []);

  // Merge: Supabase first (authoritative), then local JSON ones not already in Supabase
  // Deduplicate by BOTH id AND phone — prevents duplicates when same provider
  // exists in both providers.json and Supabase (e.g. after SQL backfill)
  const normPhone = (p: string) => (p ?? "").replace(/\D/g, "").slice(-10);
  const sbIds = new Set(sbProviders.map((p: any) => p.id));
  const sbPhones = new Set(sbProviders.map((p: any) => normPhone(p.phone ?? "")));
  const localOnly = localProviders.filter(
    (p: any) => !sbIds.has(p.id) && !sbPhones.has(normPhone(p.phone ?? "")),
  );

  // Normalise local providers to match the admin shape.
  // Keep avatar fields when present in JSON; profiles.avatar_url enrichment below
  // is still the source of truth (JSON-only / sparse real-user records often omit them).
  const normalisedLocal = localOnly.map((p: any) => ({
    id: p.id,
    userId: p.userId ?? null,
    name: p.name ?? "",
    category: p.category ?? "",
    subcategory: p.subcategory ?? "",
    location: p.location ?? "",
    phone: p.phone ?? "",
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    available: p.available ?? true,
    verified: p.verified ?? false,
    suspended: p.suspended ?? false,
    blocked: p.blocked ?? false,
    experience: p.experience ?? 0,
    description: p.description ?? "",
    serviceRadius: p.serviceRadius ?? 10,
    serviceCharge: p.serviceCharge ?? "",
    registeredAt: p.registeredAt ?? "",
    subscriptionEndDate: p.subscriptionEndDate ?? null,
    initials: p.initials ?? p.name?.slice(0, 2)?.toUpperCase?.() ?? "PR",
    avatarColor: p.avatarColor ?? "#64748B",
    avatarUrl: p.avatarUrl ?? null,
    source: "local",
  }));

  let all: any[] = [...sbProviders, ...normalisedLocal];

  // Enrich JSON/local providers with profiles.avatar_url (same Gap #1 pattern as GET /api/providers).
  // Real UUID users are stored as sparse JSON rows without avatarUrl; admin previously dropped
  // avatar fields entirely, so those providers always showed the default avatar.
  if (supabase) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const enrichIds = [
      ...new Set(
        all
          .map((p: any) => p.userId as string | null)
          .filter((id): id is string => !!id && uuidRe.test(id)),
      ),
    ];
    if (enrichIds.length > 0) {
      try {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .in("id", enrichIds);
        if (profileRows?.length) {
          const avatarMap = new Map<string, string | null>(
            (profileRows as any[]).map((r: any) => [r.id as string, r.avatar_url ?? null]),
          );
          all = all.map((p: any) =>
            p.userId && avatarMap.has(p.userId)
              ? { ...p, avatarUrl: avatarMap.get(p.userId) ?? p.avatarUrl ?? null }
              : p,
          );
        }
      } catch {
        /* non-fatal — admin list still returns without photo enrichment */
      }
    }
  }

  // ── Enrich with per-provider metrics ─────────────────────────────────────
  // Booking stats (from messages table) and last_seen_at (from profiles)
  if (supabase) {
    try {
      // Collect all record IDs and auth user IDs
      const allRecordIds = all.map((p: any) => p.id as string).filter(Boolean);
      const allUserIds   = all.map((p: any) => p.userId as string).filter(Boolean);

      // Subscription status from subscriptions.json
      const subsJson = readJson<any[]>("subscriptions", []);
      const subsByProvider = new Map<string, any>(subsJson.map((s: any) => [s.providerId as string, s]));

      // ── 1. Booking stats: conversations → messages ─────────────────────
      type BookingStat = { total: number; accepted: number; rejected: number; completed: number };
      const bookingMap = new Map<string, BookingStat>();

      if (allRecordIds.length > 0 || allUserIds.length > 0) {
        const lookupIds = [...new Set([...allRecordIds, ...allUserIds])];
        const { data: convRows } = await supabase
          .from("conversations")
          .select("id, provider_id")
          .in("provider_id", lookupIds);

        if (convRows && convRows.length > 0) {
          const convIds = (convRows as any[]).map((c: any) => c.id as string);

          // conv_id → provider record/user ID
          const convToProvider = new Map<string, string>(
            (convRows as any[]).map((c: any) => [c.id as string, c.provider_id as string]),
          );

          const { data: bookingMsgs } = await supabase
            .from("messages")
            .select("conversation_id, booking_status")
            .eq("type", "booking")
            .in("conversation_id", convIds);

          for (const msg of (bookingMsgs ?? []) as any[]) {
            const convProvId = convToProvider.get(msg.conversation_id as string);
            if (!convProvId) continue;
            const stat = bookingMap.get(convProvId) ?? { total: 0, accepted: 0, rejected: 0, completed: 0 };
            stat.total++;
            if (msg.booking_status === "accepted")  stat.accepted++;
            if (msg.booking_status === "declined")  stat.rejected++;
            if (
              msg.booking_status === "completed" ||
              msg.booking_status === "customer_confirmed_completed"
            ) stat.completed++;
            bookingMap.set(convProvId, stat);
          }
        }
      }

      // ── 2. last_seen_at from profiles ─────────────────────────────────
      const lastSeenMap = new Map<string, string | null>();
      if (allUserIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, last_seen_at")
          .in("id", allUserIds);
        for (const p of (profileRows ?? []) as any[]) {
          lastSeenMap.set(p.id as string, (p.last_seen_at as string | null) ?? null);
        }
      }

      // ── 3. Earnings from earnings.json ────────────────────────────────
      const earningsJson = readJson<any[]>("earnings", []);
      type EarningsStat = { total: number; monthly: number };
      const earningsByProvider = new Map<string, EarningsStat>();
      const earningsNowMs   = Date.now();
      const earningsMonthMs = 30 * 24 * 60 * 60 * 1000;
      for (const e of earningsJson) {
        const pid = e.providerId as string;
        if (!pid) continue;
        const entry = earningsByProvider.get(pid) ?? { total: 0, monthly: 0 };
        entry.total += Number(e.amount) || 0;
        if (earningsNowMs - new Date(e.createdAt as string).getTime() <= earningsMonthMs) {
          entry.monthly += Number(e.amount) || 0;
        }
        earningsByProvider.set(pid, entry);
      }

      // ── 4. Attach all metrics to each provider ──────────────────────────
      all = all.map((p: any) => {
        const stat = bookingMap.get(p.id) ?? bookingMap.get(p.userId) ?? { total: 0, accepted: 0, rejected: 0, completed: 0 };
        const lastSeen = (p.userId ? lastSeenMap.get(p.userId) : null) ?? null;
        const sub = subsByProvider.get(p.id);
        const subStatus: string = (() => {
          if (!p.subscriptionEndDate && !sub) return "none";
          const endDateStr = p.subscriptionEndDate ?? sub?.endDate;
          if (!endDateStr) return "none";
          const daysLeft = Math.ceil((new Date(endDateStr).getTime() - Date.now()) / 86400000);
          if (daysLeft <= 0) return "expired";
          if (daysLeft <= 7) return "expiring";
          return "active";
        })();
        const earningsStat = earningsByProvider.get(p.id as string) ?? earningsByProvider.get(p.userId as string) ?? { total: 0, monthly: 0 };
        // Resolve the best available subscription end-date string
        // (Supabase providers may have subscriptionEndDate=null even when a sub record exists)
        const subscriptionExpiry: string | null = p.subscriptionEndDate ?? sub?.endDate ?? null;
        const subscriptionDaysLeft: number | null = (() => {
          if (!subscriptionExpiry) return null;
          const dl = Math.ceil((new Date(subscriptionExpiry).getTime() - Date.now()) / 86400000);
          return Math.max(0, dl);
        })();
        return {
          ...p,
          totalBookings:     stat.total,
          acceptedBookings:  stat.accepted,
          rejectedBookings:  stat.rejected,
          completedBookings: stat.completed,
          lastLogin:         lastSeen,
          subscriptionStatus: subStatus,
          subscriptionExpiry,
          subscriptionDaysLeft,
          totalEarnings:    earningsStat.total,
          monthlyEarnings:  earningsStat.monthly,
        };
      });
    } catch (enrichErr: any) {
      logger.warn({ enrichErr: enrichErr?.message }, "admin/providers: metric enrichment failed (non-fatal)");
    }
  }

  res.json({ providers: all });
});

router.put("/admin/providers/:id", async (req, res) => {
  const id = req.params["id"] as string;

  const updates = req.body as any;
  // Build Supabase update payload (snake_case column names)
  const sbUpdates: any = {};
  if ("verified"      in updates) sbUpdates.verified       = updates.verified;
  if ("suspended"     in updates) sbUpdates.suspended      = updates.suspended;
  if ("blocked"       in updates) sbUpdates.blocked        = updates.blocked;
  if ("available"     in updates) sbUpdates.available      = updates.available;
  if ("name"          in updates) sbUpdates.name           = updates.name;
  if ("category"      in updates) sbUpdates.category       = updates.category;
  if ("subcategory"   in updates) sbUpdates.subcategory    = updates.subcategory;
  if ("location"      in updates) sbUpdates.location       = updates.location;
  if ("latitude"      in updates) sbUpdates.latitude       = updates.latitude;
  if ("longitude"     in updates) sbUpdates.longitude      = updates.longitude;
  if ("phone"         in updates) sbUpdates.phone          = updates.phone;
  if ("description"   in updates) sbUpdates.description    = updates.description;
  if ("serviceCharge" in updates) sbUpdates.service_charge = updates.serviceCharge;
  if ("avatarColor"   in updates) sbUpdates.avatar_color   = updates.avatarColor;
  if ("services"      in updates) sbUpdates.services       = updates.services;
  if ("experience"    in updates) sbUpdates.experience     = updates.experience;
  if ("serviceRadius" in updates) sbUpdates.service_radius = updates.serviceRadius;
  if ("workingHours"  in updates) sbUpdates.working_hours  = updates.workingHours;

  // Update local JSON — only structural/flag fields to avoid re-introducing stale display data.
  // For real providers, display fields are served from Supabase; JSON only needs the flags.
  const localProviders = readJson<any[]>("providers", []);
  const localIdx = localProviders.findIndex((p: any) => p.id === id);
  if (localIdx !== -1) {
    const jsonUpdates: any = {};
    for (const f of ["verified", "suspended", "blocked", "available", "name", "category", "phone"]) {
      if (f in updates) jsonUpdates[f] = (updates as any)[f];
    }
    localProviders[localIdx] = { ...localProviders[localIdx], ...jsonUpdates };
    writeJson("providers", localProviders);
  }

  // Try Supabase — use .select() without .single() to avoid "coerce" error
  // when the row count is 0 or >1
  let sbProvider: any = null;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("providers")
        .update(sbUpdates)
        .eq("id", id)
        .select();

      if (!error && data && data.length > 0) {
        sbProvider = data[0];
      }

      // When blocking/unblocking a provider, also sync to profiles.blocked
      // so the login check in auth.ts correctly rejects blocked users
      if ("blocked" in updates && sbProvider?.user_id) {
        await supabase
          .from("profiles")
          .update({ blocked: updates.blocked })
          .eq("id", sbProvider.user_id);
      }
    } catch (_) { /* non-fatal — local JSON already updated */ }
  }

  const result = sbProvider ?? (localIdx !== -1 ? localProviders[localIdx] : null);
  if (!result) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  res.json({ success: true, provider: result });
});

router.delete("/admin/providers/:id", async (req, res) => {
  const id = req.params["id"] as string;

  // Always remove from local JSON first (works even without Supabase)
  const localProviders = readJson<any[]>("providers", []);
  const filtered = localProviders.filter((p: any) => p.id !== id);
  if (filtered.length !== localProviders.length) {
    writeJson("providers", filtered);
  }

  // Also remove from Supabase if connected
  if (supabase) {
    try {
      const { data: target } = await supabase.from("providers").select("user_id").eq("id", id).single();
      await supabase.from("providers").delete().eq("id", id);
      if (target?.user_id) {
        await supabase.from("providers").delete().eq("user_id", target.user_id);
      }
    } catch (err: any) {
      console.error("Supabase provider delete error:", err?.message ?? err);
    }
  }

  res.json({ success: true });
});

// GET /admin/providers/duplicates — find providers that share the same phone number
router.get("/admin/providers/duplicates", async (_req, res) => {
  // Collect from both sources
  const [sbProviders, jsonProviders] = await Promise.all([
    fetchSupabaseProviders(),
    Promise.resolve(readJson<any[]>("providers", [])),
  ]);

  // Normalize phone helper
  const norm = (p: string) => (p ?? "").replace(/\D/g, "").replace(/^91/, "").slice(-10);

  // Merge, dedup by id
  const seen = new Set<string>();
  const all: any[] = [];
  for (const p of [...jsonProviders, ...sbProviders]) {
    if (!seen.has(p.id)) { seen.add(p.id); all.push(p); }
  }

  // Group by normalized phone
  const groups: Record<string, any[]> = {};
  for (const p of all) {
    const key = norm(p.phone ?? "");
    if (!key || key.length < 10) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  // Only return groups with more than one entry
  const duplicates = Object.entries(groups)
    .filter(([, list]) => list.length > 1)
    .map(([phone, providers]) => ({ phone, count: providers.length, providers }));

  res.json({ duplicates, totalDuplicateAccounts: duplicates.reduce((s, g) => s + g.count - 1, 0) });
});

// POST /admin/providers/merge — keep one provider ID, delete the rest
router.post("/admin/providers/merge", async (req, res) => {
  const { keepId, deleteIds } = req.body as { keepId: string; deleteIds: string[] };
  if (!keepId || !Array.isArray(deleteIds) || deleteIds.length === 0) {
    res.status(400).json({ error: "keepId and deleteIds[] required" });
    return;
  }

  const deleted: string[] = [];
  const errors: string[] = [];

  // Delete from JSON file
  const jsonProviders = readJson<any[]>("providers", []);
  const filtered = jsonProviders.filter((p: any) => !deleteIds.includes(p.id));
  if (filtered.length !== jsonProviders.length) {
    writeJson("providers", filtered);
  }

  // Delete from Supabase
  if (supabase) {
    for (const id of deleteIds) {
      try {
        const { data: target } = await supabase.from("providers").select("user_id").eq("id", id).maybeSingle();
        await supabase.from("providers").delete().eq("id", id);
        if (target?.user_id) {
          await supabase.from("providers").delete().eq("user_id", target.user_id);
        }
        deleted.push(id);
      } catch (err: any) {
        errors.push(`${id}: ${err?.message ?? "delete failed"}`);
      }
    }
  } else {
    deleted.push(...deleteIds);
  }

  res.json({ success: true, kept: keepId, deleted, errors });
});

// ── Cascade delete helper ─────────────────────────────────────────────────────
// Deletes ALL data associated with a user in the correct dependency order:
// messages → conversations → reviews → providers → profiles → storage → auth
//
// Returns { success, steps, hardErrors }.
// success = false if any critical step (messages/conversations/providers/profiles/auth) fails.
// Storage failures are non-fatal (orphaned file is better than a broken delete).

type StepResult = { step: string; ok: boolean; note?: string };

async function cascadeDeleteUser(userId: string): Promise<{
  success: boolean;
  steps: StepResult[];
  hardErrors: string[];
}> {
  const steps: StepResult[] = [];
  const hardErrors: string[] = [];

  // Supabase only accepts UUID-format IDs. Local-only users (e.g. `usr-123`) are
  // never in Supabase, so skip all DB operations for them gracefully.
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  // ── Pre-flight: collect avatar URL + all provider IDs for this user ───────
  let avatarUrl: string | null = null;
  let providerIds: string[] = [];

  if (supabase && isUUID) {
    try {
      const { data: profile } = await supabase
        .from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
      avatarUrl = profile?.avatar_url ?? null;
    } catch { /* non-fatal */ }

    try {
      const { data: provRows } = await supabase
        .from("providers").select("id").eq("user_id", userId);
      providerIds = (provRows ?? []).map((r: any) => r.id as string);
    } catch { /* non-fatal */ }
  }

  // Also collect provider IDs from JSON file (covers local-only providers)
  try {
    const jsonProviders = readJson<any[]>("providers", []);
    const jsonIds = jsonProviders
      .filter((p: any) => p.userId === userId)
      .map((p: any) => p.id as string);
    providerIds = [...new Set([...providerIds, ...jsonIds])];
  } catch { /* non-fatal */ }

  // ── Step 1: Find all conversation IDs the user is party to ───────────────
  let allConvIds: string[] = [];
  if (supabase && isUUID) {
    try {
      const [customerConvs, providerConvs] = await Promise.all([
        supabase.from("conversations").select("id").eq("customer_id", userId),
        providerIds.length > 0
          ? supabase.from("conversations").select("id").in("provider_id", providerIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      allConvIds = [
        ...(customerConvs.data ?? []).map((c: any) => c.id as string),
        ...(providerConvs.data ?? []).map((c: any) => c.id as string),
      ];
      allConvIds = [...new Set(allConvIds)];
    } catch (e: any) {
      hardErrors.push(`find_conversations: ${e?.message ?? e}`);
      steps.push({ step: "find_conversations", ok: false, note: e?.message ?? String(e) });
    }
  }

  // ── Step 2: Delete messages ───────────────────────────────────────────────
  if (supabase && isUUID) {
    if (allConvIds.length > 0) {
      try {
        const { error } = await supabase
          .from("messages").delete().in("conversation_id", allConvIds);
        if (error) {
          hardErrors.push(`messages: ${error.message}`);
          steps.push({ step: "delete_messages", ok: false, note: error.message });
        } else {
          steps.push({ step: "delete_messages", ok: true, note: `${allConvIds.length} conversation(s) cleared` });
        }
      } catch (e: any) {
        hardErrors.push(`messages: ${e?.message ?? e}`);
        steps.push({ step: "delete_messages", ok: false, note: e?.message ?? String(e) });
      }
    } else {
      steps.push({ step: "delete_messages", ok: true, note: "none" });
    }

    // ── Step 3: Delete conversations ─────────────────────────────────────────
    if (allConvIds.length > 0) {
      try {
        const { error } = await supabase
          .from("conversations").delete().in("id", allConvIds);
        if (error) {
          hardErrors.push(`conversations: ${error.message}`);
          steps.push({ step: "delete_conversations", ok: false, note: error.message });
        } else {
          steps.push({ step: "delete_conversations", ok: true, note: `${allConvIds.length} deleted` });
        }
      } catch (e: any) {
        hardErrors.push(`conversations: ${e?.message ?? e}`);
        steps.push({ step: "delete_conversations", ok: false, note: e?.message ?? String(e) });
      }
    } else {
      steps.push({ step: "delete_conversations", ok: true, note: "none" });
    }

    // ── Step 4: Delete reviews (non-fatal — table may not exist) ─────────────
    try {
      await supabase.from("reviews").delete().eq("reviewer_id", userId);
      if (providerIds.length > 0) {
        await supabase.from("reviews").delete().in("provider_id", providerIds);
      }
      steps.push({ step: "delete_reviews", ok: true });
    } catch (e: any) {
      steps.push({ step: "delete_reviews", ok: false, note: `${e?.message ?? "non-fatal"}` });
    }

    // ── Step 5: Delete provider rows ─────────────────────────────────────────
    try {
      const { error } = await supabase.from("providers").delete().eq("user_id", userId);
      if (error) {
        hardErrors.push(`providers: ${error.message}`);
        steps.push({ step: "delete_providers", ok: false, note: error.message });
      } else {
        steps.push({ step: "delete_providers", ok: true });
      }
    } catch (e: any) {
      hardErrors.push(`providers: ${e?.message ?? e}`);
      steps.push({ step: "delete_providers", ok: false, note: e?.message ?? String(e) });
    }
  } else if (!isUUID) {
    // Local-only user (non-UUID ID) — no Supabase rows to delete
    steps.push({ step: "delete_messages", ok: true, note: "local-only user" });
    steps.push({ step: "delete_conversations", ok: true, note: "local-only user" });
    steps.push({ step: "delete_reviews", ok: true, note: "local-only user" });
    steps.push({ step: "delete_providers", ok: true, note: "local-only user" });
  }

  // ── Step 6: Remove from providers.json ───────────────────────────────────
  try {
    const providers = readJson<any[]>("providers", []);
    const before = providers.length;
    const filtered = providers.filter(
      (p: any) => p.userId !== userId && !providerIds.includes(p.id),
    );
    writeJson("providers", filtered);
    steps.push({ step: "remove_providers_json", ok: true, note: `${before - filtered.length} removed` });
  } catch (e: any) {
    steps.push({ step: "remove_providers_json", ok: false, note: e?.message ?? "non-fatal" });
  }

  // ── Step 7: Remove from users.json ───────────────────────────────────────
  try {
    const users = readJson<any[]>("users", []);
    const before = users.length;
    const filtered = users.filter((u: any) => u.id !== userId);
    writeJson("users", filtered);
    steps.push({ step: "remove_users_json", ok: true, note: `${before - filtered.length} removed` });
  } catch (e: any) {
    steps.push({ step: "remove_users_json", ok: false, note: e?.message ?? "non-fatal" });
  }

  // ── Step 8: Delete profiles row ──────────────────────────────────────────
  if (supabase && isUUID) {
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) {
        hardErrors.push(`profiles: ${error.message}`);
        steps.push({ step: "delete_profile", ok: false, note: error.message });
      } else {
        steps.push({ step: "delete_profile", ok: true });
      }
    } catch (e: any) {
      hardErrors.push(`profiles: ${e?.message ?? e}`);
      steps.push({ step: "delete_profile", ok: false, note: e?.message ?? String(e) });
    }
  } else if (!isUUID) {
    steps.push({ step: "delete_profile", ok: true, note: "local-only user" });
  }

  // ── Step 9: Delete avatar file from Supabase Storage (non-fatal) ─────────
  if (supabase && avatarUrl) {
    try {
      const STORAGE_PREFIX = "/storage/v1/object/public/profiles/";
      if (avatarUrl.includes(STORAGE_PREFIX)) {
        const filename = avatarUrl.split(STORAGE_PREFIX)[1];
        if (filename) {
          const { error } = await supabase.storage.from("profiles").remove([filename]);
          if (error) {
            steps.push({ step: "delete_avatar_storage", ok: false, note: `${error.message} (non-fatal)` });
          } else {
            steps.push({ step: "delete_avatar_storage", ok: true, note: filename });
          }
        } else {
          steps.push({ step: "delete_avatar_storage", ok: true, note: "no filename extractable" });
        }
      } else {
        steps.push({ step: "delete_avatar_storage", ok: true, note: "external URL — skipped" });
      }
    } catch (e: any) {
      steps.push({ step: "delete_avatar_storage", ok: false, note: `${e?.message ?? "non-fatal"}` });
    }
  } else {
    steps.push({
      step: "delete_avatar_storage",
      ok: true,
      note: !supabase ? "supabase not configured" : "no avatar on file",
    });
  }

  // ── Step 10: Delete from Supabase Auth (irreversible — always last) ───────
  if (!isUUID) {
    steps.push({ step: "delete_auth_user", ok: true, note: "local-only user — no auth record" });
  } else if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: supabaseAdminHeaders(),
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        if (r.status === 404) {
          // User never existed in Supabase Auth (local-only user) — not an error
          steps.push({ step: "delete_auth_user", ok: true, note: "not found in auth (local-only)" });
        } else {
          hardErrors.push(`auth_user: HTTP ${r.status} ${body}`);
          steps.push({ step: "delete_auth_user", ok: false, note: `HTTP ${r.status}: ${body}` });
        }
      } else {
        steps.push({ step: "delete_auth_user", ok: true });
      }
    } catch (e: any) {
      hardErrors.push(`auth_user: ${e?.message ?? e}`);
      steps.push({ step: "delete_auth_user", ok: false, note: e?.message ?? String(e) });
    }
  } else {
    steps.push({ step: "delete_auth_user", ok: true, note: "supabase not configured" });
  }

  logger.info({ userId, hardErrors, steps }, "cascadeDeleteUser complete");

  return { success: hardErrors.length === 0, steps, hardErrors };
}

// ── Self-delete account (called by the user from the mobile app) ─────────────
// Requires a valid Supabase session token; the token's user ID must match the
// requested :id so users can only delete their own account.
router.delete("/users/:id/delete", async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    const authHeader = req.headers["authorization"] as string | undefined;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: "Authorization header required" });
      return;
    }
    const { data: callerData, error: callerErr } = await supabase.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    if (callerData.user.id !== id) {
      res.status(403).json({ error: "You can only delete your own account" });
      return;
    }
  }

  const result = await cascadeDeleteUser(id);
  if (!result.success) {
    res.status(500).json({
      success: false,
      error: result.hardErrors.join("; "),
      errors: result.hardErrors,
      steps: result.steps,
    });
    return;
  }
  res.json({ success: true, steps: result.steps });
});

// ── Users ────────────────────────────────────────────────────────────────────
router.get("/admin/users", async (_req, res) => {
  const localUsers = readJson<any[]>("users", []);
  const allSbUsers = await fetchSupabaseUsers();

  // Separate customers from providers
  // Customers = users who have NOT registered as a provider
  const sbCustomers = allSbUsers.filter((u) => !u.isProvider);
  const sbProviders = allSbUsers.filter((u) => u.isProvider);

  // Merge local-only users (avoid duplicates with Supabase users)
  const sbIds = new Set(allSbUsers.map((u) => u.id));
  // Only include local users who are NOT already in Supabase AND are NOT providers
  const localOnly = localUsers.filter(
    (u: any) => !sbIds.has(u.id) && !u.isProvider,
  );

  // All customers + local-only non-provider users
  const customers = [...sbCustomers, ...localOnly];

  res.json({
    users: customers,
    // Extra counts for dashboard awareness
    totalRegistered: allSbUsers.length + localOnly.length,
    totalCustomers: customers.length,
    totalProviders: sbProviders.length,
  });
});

router.post("/admin/users", (req, res) => {
  const users = readJson<any[]>("users", []);
  const user = { ...req.body, id: req.body.id ?? `usr-${Date.now()}`, createdAt: new Date().toISOString() };
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) { users[idx] = user; } else { users.unshift(user); }
  writeJson("users", users);
  res.json({ success: true, user });
});

router.put("/admin/users/:id", async (req, res) => {
  const id = req.params["id"] as string;
  const users = readJson<any[]>("users", []);
  const idx = users.findIndex((u) => u.id === id);

  if (idx < 0) {
    // It's a Supabase user — sync block/unblock to Supabase profiles
    if (supabase && req.body.blocked !== undefined) {
      try {
        await supabase.from("profiles").update({ blocked: req.body.blocked }).eq("id", id);
      } catch { /* non-fatal */ }
    }
    res.json({ success: true });
    return;
  }

  users[idx] = { ...users[idx], ...req.body, id: users[idx].id };
  writeJson("users", users);
  res.json({ success: true, user: users[idx] });
});

router.delete("/admin/users/:id", async (req, res) => {
  const id = req.params["id"] as string;
  const result = await cascadeDeleteUser(id);
  if (!result.success) {
    res.status(500).json({
      success: false,
      error: result.hardErrors.join("; "),
      errors: result.hardErrors,
      steps: result.steps,
    });
    return;
  }
  res.json({ success: true, steps: result.steps });
});

// ── Categories ───────────────────────────────────────────────────────────────
router.get("/admin/categories", (_req, res) => {
  const categories = readJson<any[]>("categories", []);
  res.json({ categories });
});

router.post("/admin/categories", (req, res) => {
  const categories = readJson<any[]>("categories", []);
  const cat = {
    ...req.body,
    id: req.body.id ?? req.body.name?.toLowerCase().replace(/\s+/g, "_") ?? `cat-${Date.now()}`,
    active: req.body.active ?? true,
    order: req.body.order ?? categories.length + 1,
    subcategories: req.body.subcategories ?? [],
  };
  const idx = categories.findIndex((c) => c.id === cat.id);
  if (idx >= 0) { categories[idx] = cat; } else { categories.push(cat); }
  writeJson("categories", categories);
  res.json({ success: true, category: cat });
});

router.put("/admin/categories/:id", (req, res) => {
  const categories = readJson<any[]>("categories", []);
  const idx = categories.findIndex((c) => c.id === req.params["id"]);
  if (idx < 0) { res.status(404).json({ error: "Not found" }); return; }
  categories[idx] = { ...categories[idx], ...req.body, id: categories[idx].id };
  writeJson("categories", categories);
  res.json({ success: true, category: categories[idx] });
});

router.delete("/admin/categories/:id", (req, res) => {
  const categories = readJson<any[]>("categories", []);
  writeJson("categories", categories.filter((c) => c.id !== req.params["id"]));
  res.json({ success: true });
});

// Public categories endpoint for mobile app (all active, popularity-sorted)
router.get("/categories", async (_req, res) => {
  const payload = await getOrSetTtlAsync(CACHE_KEYS.CATEGORIES, async () => {
    const all = readJson<any[]>("categories", []);
    const active = all.filter((c: any) => c.active !== false);

    // Real provider counts per category (for landing / analytics) — additive field only
    let providerCountByCategory = new Map<string, number>();
    try {
      const sbProviders = await fetchSupabaseProviders();
      const localProviders = readJson<any[]>("providers", []);
      const sbIds = new Set(sbProviders.map((p: any) => p.id));
      const merged = [
        ...sbProviders,
        ...localProviders.filter((p: any) => !sbIds.has(p.id)),
      ].filter((p: any) => !p.suspended && !p.blocked);
      for (const p of merged) {
        const cat = String(p.category ?? "").trim();
        if (!cat) continue;
        providerCountByCategory.set(cat, (providerCountByCategory.get(cat) ?? 0) + 1);
      }
    } catch { /* non-fatal */ }

    active.sort((a: any, b: any) => {
      // Admin manual order takes highest priority
      if (a.homeOrder != null && b.homeOrder != null) return a.homeOrder - b.homeOrder;
      if (a.homeOrder != null) return -1;
      if (b.homeOrder != null) return 1;
      // Then by search popularity
      const sc = (b.searchCount ?? 0) - (a.searchCount ?? 0);
      if (sc !== 0) return sc;
      // Then by default order
      return (a.order ?? 99) - (b.order ?? 99);
    });

    const withCounts = active.map((c: any) => ({
      ...c,
      providerCount: providerCountByCategory.get(String(c.name)) ?? 0,
    }));
    return { categories: withCounts };
  });
  res.json(payload);
});

// Increment search count when a category is tapped in the app
router.post("/categories/:id/search", (req, res) => {
  const categories = readJson<any[]>("categories", []);
  const idx = categories.findIndex((c) => c.id === req.params["id"]);
  if (idx >= 0) {
    categories[idx] = { ...categories[idx], searchCount: (categories[idx].searchCount ?? 0) + 1 };
    writeJson("categories", categories);
  }
  res.json({ success: true });
});

// ── Advertisements — Supabase-backed (falls back to JSON if Supabase unavailable) ─
function dbAdToJson(r: any) {
  return {
    id: r.id,
    title: r.title ?? "",
    subtitle: r.subtitle ?? "",
    bgColor: r.bg_color ?? r.bgColor ?? "#FF6B35",
    textColor: r.text_color ?? r.textColor ?? "#FFFFFF",
    imageUrl: r.image_url ?? r.imageUrl ?? "",
    linkUrl: r.link_url ?? r.linkUrl ?? "",
    targetCategory: r.target_category ?? r.targetCategory ?? "",
    startDate: r.start_date ?? r.startDate ?? "",
    endDate: r.end_date ?? r.endDate ?? "",
    active: r.active ?? true,
    createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
  };
}

function jsonAdToDb(ad: any) {
  // Supabase ads table uses camelCase column names (created before snake_case migration)
  return {
    id: ad.id,
    title: ad.title ?? "",
    subtitle: ad.subtitle ?? "",
    bgColor: ad.bgColor ?? "#FF6B35",
    textColor: ad.textColor ?? "#FFFFFF",
    imageUrl: ad.imageUrl ?? "",
    linkUrl: ad.linkUrl ?? "",
    targetCategory: ad.targetCategory ?? "",
    startDate: ad.startDate ?? "",
    endDate: ad.endDate ?? "",
    active: ad.active ?? true,
    createdAt: ad.createdAt ?? new Date().toISOString(),
  };
}

async function readAds(): Promise<any[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("ads").select("*");
      if (!error && data) return data.map(dbAdToJson);
    } catch { /* non-fatal */ }
  }
  return []; // Never fall back to demo JSON data
}

router.get("/admin/ads", async (_req, res) => {
  res.json({ ads: await readAds() });
});

router.post("/admin/ads", async (req, res) => {
  const ad = {
    ...req.body,
    id: req.body.id ?? `ad-${Date.now()}`,
    createdAt: new Date().toISOString(),
    active: req.body.active ?? true,
  };
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }
  try {
    const { error } = await supabase.from("ads").upsert(jsonAdToDb(ad));
    if (error) throw new Error(error.message);
    res.json({ success: true, ad });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to create ad" });
  }
});

router.put("/admin/ads/:id", async (req, res) => {
  const id = req.params["id"]!;
  if (!supabase) { res.status(503).json({ error: "Supabase not configured" }); return; }
  try {
    const { data: existing } = await supabase.from("ads").select("*").eq("id", id).single();
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const merged = dbAdToJson({ ...existing, ...jsonAdToDb({ ...dbAdToJson(existing), ...req.body }), id });
    await supabase.from("ads").update(jsonAdToDb(merged)).eq("id", id);
    res.json({ success: true, ad: merged });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Update failed" });
  }
});

router.delete("/admin/ads/:id", async (req, res) => {
  const id = req.params["id"]!;
  if (!supabase) { res.status(503).json({ error: "Supabase not configured" }); return; }
  try {
    await supabase.from("ads").delete().eq("id", id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Delete failed" });
  }
});

// ── Plans ─────────────────────────────────────────────────────────────────────
const DEFAULT_PLANS = [
  { key: "monthly",    label: "Monthly",     price: 199,  billedAs: "Billed every month",      badge: null,         badgeColor: null       },
  { key: "quarterly",  label: "Quarterly",   price: 499,  billedAs: "Billed every 3 months",   badge: "Save 16%",   badgeColor: "#FF6B35"  },
  { key: "halfYearly", label: "Half Yearly", price: 899,  billedAs: "Billed every 6 months",   badge: "Save 25%",   badgeColor: "#10B981"  },
  { key: "yearly",     label: "Yearly",      price: 1499, billedAs: "Billed once a year",      badge: "Best Value", badgeColor: "#8B5CF6"  },
];

router.get("/plans", (_req, res) => {
  res.json({ plans: readJson("plans", DEFAULT_PLANS) });
});

router.put("/admin/plans", (req, res) => {
  const plans = Array.isArray(req.body.plans) ? req.body.plans : req.body;
  if (!Array.isArray(plans)) { res.status(400).json({ error: "plans array required" }); return; }
  writeJson("plans", plans);
  res.json({ success: true, plans });
});

// Public stats endpoint for mobile app login screen
router.get("/stats", async (_req, res) => {
  const payload = await getOrSetTtlAsync(CACHE_KEYS.STATS, async () => {
    // Merge Supabase providers + local JSON providers (deduplicated by id)
    const sbProviders = await fetchSupabaseProviders();
    const localProviders = readJson<any[]>("providers", []);
    const sbIds = new Set(sbProviders.map((p) => p.id));
    const merged = [...sbProviders, ...localProviders.filter((p: any) => !sbIds.has(p.id))];
    const activeProviders = merged.filter((p) => !p.suspended && !p.blocked);

    const categories = readJson<any[]>("categories", []);
    const activeCategories = categories.filter((c: any) => c.active !== false);

    const citySet = new Set<string>();
    for (const p of activeProviders) {
      const city = (p.location ?? "").split(",")[0].trim();
      if (city) citySet.add(city);
    }

    // Merge Supabase users + unique local provider phones as user count
    const sbUsers = await fetchSupabaseUsers();
    const totalUsers = Math.max(sbUsers.length, activeProviders.length);

    return {
      workers: activeProviders.length,
      services: activeCategories.length,
      cities: citySet.size || 1,
      users: totalUsers,
      // Extended fields for landing (real counts only) — additive, does not remove legacy fields
      providers: activeProviders.length,
      customers: totalUsers,
      bookings: (() => {
        const earnings = readJson<any[]>("earnings", []);
        return earnings.length;
      })(),
      categories: activeCategories.length,
      averageRating: (() => {
        const rated = activeProviders.filter((p: any) => Number(p.rating) > 0);
        if (rated.length === 0) return 0;
        const sum = rated.reduce((s: number, p: any) => s + Number(p.rating || 0), 0);
        return parseFloat((sum / rated.length).toFixed(1));
      })(),
    };
  });
  res.json(payload);
});

// Public ads endpoint for mobile app
router.get("/ads", async (_req, res) => {
  const ads = await readAds();
  const now = new Date().toISOString();
  const active = ads.filter((a) => {
    if (!a.active) return false;
    if (a.startDate && a.startDate > now) return false;
    if (a.endDate && a.endDate < now) return false;
    return true;
  });
  res.json({ ads: active });
});

// ── Settings ─────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  paymentGatewayEnabled: false,
  registrationOpen: true,
  maintenanceMode: false,
  appName: "SkillAd",
  supportEmail: "support@skillad.in",
  supportPhone: "+91-9999999999",
  defaultCity: "Agartala",
  maxServiceRadius: 50,
  freeTrialDays: 30,
  appStoreLink: "",
  playStoreLink: "",
  websiteUrl: "https://skillad.in",
};

router.get("/admin/settings", (_req, res) => {
  res.json({ settings: readJson("settings", DEFAULT_SETTINGS) });
});

router.put("/admin/settings", (req, res) => {
  const current = readJson("settings", DEFAULT_SETTINGS);
  // Accept either the full object or a wrapped { settings: {...} } shape
  const patch = req.body?.settings && typeof req.body.settings === "object" ? req.body.settings : req.body;
  const updated = { ...current, ...patch };
  // Never allow a nested 'settings' key to be persisted
  delete updated.settings;
  writeJson("settings", updated);
  res.json({ success: true, settings: updated });
});

// Public settings endpoint for mobile app (only exposes safe fields)
router.get("/settings", (_req, res) => {
  const s = readJson<any>("settings", DEFAULT_SETTINGS);
  res.json({
    appStoreLink: s.appStoreLink ?? "",
    playStoreLink: s.playStoreLink ?? "",
    appName: s.appName ?? "SkillAd",
    supportEmail: s.supportEmail ?? "",
    supportPhone: s.supportPhone ?? "",
    defaultCity: s.defaultCity ?? "Agartala",
    maxServiceRadius: s.maxServiceRadius ?? 50,
    freeTrialDays: s.freeTrialDays ?? 30,
    enabledLanguages: s.enabledLanguages ?? ["English", "Bengali", "Hindi", "Kokborok", "Manipuri"],
    paymentGatewayEnabled: s.paymentGatewayEnabled ?? false,
    websiteUrl: s.websiteUrl ?? "https://skillad.in",
    // Landing / footer socials (optional)
    socialFacebook: s.socialFacebook ?? "",
    socialInstagram: s.socialInstagram ?? "",
    socialTwitter: s.socialTwitter ?? "",
    socialYoutube: s.socialYoutube ?? "",
    socialLinkedin: s.socialLinkedin ?? "",
    officeAddress: s.officeAddress ?? "",
  });
});

// ── Content / CMS ─────────────────────────────────────────────────────────────
const DEFAULT_CONTENT = {
  aboutUs: "",
  termsOfService: "",
  privacyPolicy: "",
  helpCentre: "",
  refundPolicy: "",
  faqs: [] as { id: string; question: string; answer: string }[],
  announcements: [] as { id: string; text: string; createdAt: string }[],
  landing: {
    heroHeading: "Nearby Skills.\nRight When You Need Them.",
    heroSubtitle: "Find verified electricians, plumbers, tutors, beauticians, drivers and hundreds of skilled professionals near you.",
    heroAnnouncement: "",
    uspTitle: "No more asking for contact numbers.",
    uspSubtitle: "No more asking friends, neighbours or relatives for phone numbers. SkillAd puts trusted local professionals right in your pocket.",
    providerCtaTitle: "Offer your skills. Get discovered nearby.",
    providerCtaSubtitle: "Register as a provider, activate a subscription, and start receiving booking requests from customers in your service area.",
    providerCtaPrimaryLabel: "Register as Provider",
    providerCtaSecondaryLabel: "View Subscription Plans",
    featureCards: [
      { id: "verified", title: "Verified Providers", description: "Profiles with mobile OTP verification and admin moderation." },
      { id: "gps", title: "GPS Matching", description: "See professionals whose service radius covers your location." },
      { id: "languages", title: "24 Languages", description: "Use SkillAd in languages spoken across India." },
      { id: "otp", title: "OTP Login", description: "Secure phone-based sign-in without passwords." },
      { id: "chat", title: "Real-time Chat", description: "Message providers, share booking details, and coordinate work." },
      { id: "booking", title: "Booking", description: "Request services, track status, and complete jobs in-app." },
      { id: "secure", title: "Secure Platform", description: "Moderation, reporting, and subscription-backed provider access." },
    ],
    appScreenshots: [] as { id: string; label: string; url: string }[],
    howItWorks: [
      { id: "open", title: "Open SkillAd", description: "Download the app and sign in securely with your mobile number via OTP." },
      { id: "walk", title: "Walk anywhere", description: "Your location updates as you move — you never set a search radius." },
      { id: "appear", title: "Nearby professionals appear automatically", description: "Providers whose service area covers you show up in Nearby — instantly." },
      { id: "hire", title: "Chat, Call and Hire", description: "Message, call, book, and review verified professionals in one place." },
    ],
  },
};

router.get("/admin/content", (_req, res) => {
  const content = readJson<any>("content", DEFAULT_CONTENT);
  // Merge landing defaults without wiping admin edits
  content.landing = { ...DEFAULT_CONTENT.landing, ...(content.landing ?? {}) };
  if (!Array.isArray(content.landing.featureCards) || content.landing.featureCards.length === 0) {
    content.landing.featureCards = DEFAULT_CONTENT.landing.featureCards;
  }
  if (!Array.isArray(content.landing.howItWorks) || content.landing.howItWorks.length === 0) {
    content.landing.howItWorks = DEFAULT_CONTENT.landing.howItWorks;
  }
  res.json({ content });
});

router.put("/admin/content", (req, res) => {
  const current = readJson<any>("content", DEFAULT_CONTENT);
  const body = req.body ?? {};
  const updated = { ...current, ...body };
  if (body.landing && typeof body.landing === "object") {
    updated.landing = { ...(current.landing ?? {}), ...body.landing };
  }
  writeJson("content", updated);
  res.json({ success: true, content: updated });
});

// Public content endpoint for mobile app + landing
router.get("/content", (_req, res) => {
  const content = readJson<any>("content", DEFAULT_CONTENT);
  content.landing = { ...DEFAULT_CONTENT.landing, ...(content.landing ?? {}) };
  if (!Array.isArray(content.landing.featureCards) || content.landing.featureCards.length === 0) {
    content.landing.featureCards = DEFAULT_CONTENT.landing.featureCards;
  }
  if (!Array.isArray(content.landing.howItWorks) || content.landing.howItWorks.length === 0) {
    content.landing.howItWorks = DEFAULT_CONTENT.landing.howItWorks;
  }
  res.json({ content });
});

// ── Notifications ─────────────────────────────────────────────────────────────
router.post("/admin/notifications", async (req, res) => {
  const notifications = readJson<any[]>("notifications", []);
  const body = req.body as any;

  // For "expiring_soon" audience, resolve which providers are expiring within 7 days
  let resolvedAudience = body.audience as string;
  let expiringCount = 0;
  if (body.audience === "expiring_soon") {
    resolvedAudience = "expiring_soon";
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const sbProviders = await fetchSupabaseProviders();
    const localProviders = readJson<any[]>("providers", []);
    const allProviders = [
      ...sbProviders,
      ...localProviders.filter((p: any) => !sbProviders.some((s: any) => s.id === p.id)),
    ];
    expiringCount = allProviders.filter((p: any) => {
      if (!p.subscriptionEndDate) return false;
      const end = new Date(p.subscriptionEndDate as string);
      return end > now && end <= in7;
    }).length;
  }

  const notif = {
    id: `notif-${Date.now()}`,
    ...body,
    audience: resolvedAudience,
    sentAt: new Date().toISOString(),
    status: "sent",
    ...(expiringCount > 0 ? { targetCount: expiringCount } : {}),
  };
  notifications.unshift(notif);
  if (notifications.length > 200) notifications.splice(200);
  writeJson("notifications", notifications);

  // Send real OS push notifications via Expo Push API to all registered devices
  if (supabase) {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("push_token")
        .not("push_token", "is", null);
      const tokens = (profiles ?? [])
        .map((p: any) => p.push_token as string)
        .filter((t: string) => t && t.startsWith("ExponentPushToken"));
      if (tokens.length > 0) {
        const messages = tokens.map((token: string) => ({
          to: token,
          sound: "default",
          title: notif.title ?? "SkillAd",
          body: notif.message ?? notif.body ?? "",
          data: { type: notif.type ?? "admin", notifId: notif.id },
          priority: "high",
          channelId: "default",
        }));
        // Expo push API accepts up to 100 messages per request
        for (let i = 0; i < messages.length; i += 100) {
          const chunk = messages.slice(i, i + 100);
          fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chunk),
          }).catch((err: Error) => logger.warn({ err }, "Expo push send failed"));
        }
        logger.info({ tokenCount: tokens.length }, "Admin notification: Expo push sent");
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, "Admin notification: push token fetch failed");
    }
  }

  res.json({ success: true, notification: notif });
});

router.get("/admin/notifications", (_req, res) => {
  res.json({ notifications: readJson<any[]>("notifications", []) });
});

router.delete("/admin/notifications/:id", (req, res) => {
  const { id } = req.params;
  const notifications = readJson<any[]>("notifications", []);
  const filtered = notifications.filter((n) => n.id !== id);
  if (filtered.length === notifications.length) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  writeJson("notifications", filtered);
  res.json({ success: true });
});

// Public notifications endpoint for mobile app
// ?userId=xxx — returns broadcast notifications + notifications targeted at that user
// No userId — returns only broadcast (untargeted) notifications
router.get("/notifications", (req, res) => {
  const all = readJson<any[]>("notifications", []);
  const userId = (req.query["userId"] as string | undefined)?.trim();
  let filtered: any[];
  if (userId) {
    filtered = all.filter(
      (n: any) => !n.targetUserId || n.targetUserId === userId,
    );
  } else {
    filtered = all.filter((n: any) => !n.targetUserId);
  }
  res.json({ notifications: filtered.slice(0, 100) });
});

// ── Upload config — returns Supabase URL + anon key so browser uploads directly ──
// The anon key is intentionally public (same as baked into the mobile APK).
// Protected by admin key to avoid public exposure.
router.get("/admin/upload-config", (_req, res) => {
  const raw = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
  const supabaseUrl = raw ? ((): string => {
    try { const u = new URL(raw); return `${u.protocol}//${u.host}`; } catch { return raw.replace(/\/rest\/v1.*$/, "").replace(/\/$/, ""); }
  })() : "";
  const supabaseAnonKey = process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: "Supabase not configured on server" });
    return;
  }
  res.json({ supabaseUrl, supabaseAnonKey, bucket: "ads" });
});

// ── Upload presign — returns a Supabase signed URL so the browser uploads directly ──
// This avoids cross-origin issues: the browser PUTs straight to Supabase CDN.
router.post("/admin/upload-presign", async (req, res) => {
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured — use /admin/upload instead" });
    return;
  }
  try {
    await supabase.storage.createBucket("ads", { public: true }).catch(() => {});
    const name = `${Date.now()}.webp`;
    const { data, error } = await supabase.storage.from("ads").createSignedUploadUrl(name);
    if (error || !data) {
      res.status(500).json({ error: error?.message ?? "Could not create signed URL" });
      return;
    }
    const { data: urlData } = supabase.storage.from("ads").getPublicUrl(name);
    res.json({ signedUrl: data.signedUrl, publicUrl: urlData.publicUrl, token: data.token });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Presign failed" });
  }
});

// ── Image Upload (admin panel — base64, auto-compressed to WebP) ─────────────
// Used as fallback when presign endpoint is unavailable.
router.post("/admin/upload", async (req, res) => {
  const { data, mimeType } = req.body as { filename?: string; data?: string; mimeType?: string };

  if (!data) {
    res.status(400).json({ error: "data (base64) is required" });
    return;
  }

  try {
    const base64 = data.replace(/^data:[^;]+;base64,/, "");
    if (!base64) {
      res.status(400).json({ error: "Invalid image data" });
      return;
    }
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length < 100) {
      res.status(400).json({ error: "Image data is too small or invalid" });
      return;
    }
    if (buffer.length > 20 * 1024 * 1024) {
      res.status(400).json({ error: "Image too large — please use an image under 15 MB" });
      return;
    }

    const { processUploadImage } = await import("../lib/imageProcess.js");
    const processed = await processUploadImage(buffer, mimeType, "adminAd");
    const name = `${Date.now()}.${processed.extension}`;

    // ── Primary: Supabase Storage ─────────────────────────────────────────────
    if (supabase) {
      try {
        await supabase.storage.createBucket("ads", { public: true }).catch(() => {});
        const { data: upData, error: upErr } = await supabase.storage
          .from("ads")
          .upload(name, processed.buffer, { contentType: processed.contentType, upsert: true });
        if (upData) {
          const { data: urlData } = supabase.storage.from("ads").getPublicUrl(name);
          res.json({ success: true, url: urlData.publicUrl });
          return;
        }
        if (upErr) logger.warn({ upErr }, "Supabase storage upload failed, falling back to disk");
      } catch (storageErr: any) {
        logger.warn({ storageErr }, "Supabase storage error, falling back to disk");
      }
    }

    // ── Fallback: local disk ──────────────────────────────────────────────────
    const UPLOADS_DIR = resolve(DATA_DIR, "uploads");
    if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
    const destPath = resolve(UPLOADS_DIR, name);
    const { writeFileSync: wfs } = await import("fs");
    wfs(destPath, processed.buffer);
    const apiBase =
      (process.env["API_BASE_URL"] ?? "").replace(/\/$/, "") ||
      `${req.protocol}://${req.get("host")}`;
    res.json({ success: true, url: `${apiBase}/api/uploads/${name}` });
  } catch (e: any) {
    const raw = (e?.message ?? "") as string;
    const msg = raw.toLowerCase().includes("unsupported image format")
      ? "Unsupported image format — please upload a JPG, PNG, WebP, or GIF"
      : "Image upload failed. Please try again.";
    res.status(500).json({ error: msg });
  }
});

// ── Booking status notifications ──────────────────────────────────────────────
// Called by the provider's mobile app after accepting / declining / completing
// a booking. Looks up the customer's Expo push token and fires a push notification.
// No admin key required — this is an app-to-server call, not an admin call.

const BOOKING_NOTIFY_CFG: Record<string, { title: string; body: (svc: string, name: string) => string }> = {
  accepted:  {
    title: "Booking Accepted ✅",
    body:  (svc, name) => `${name} accepted your booking for "${svc}".`,
  },
  declined:  {
    title: "Booking Declined",
    body:  (svc, name) => `${name} is unavailable for "${svc}". Try another provider.`,
  },
  completed: {
    title: "Service Completed ⭐",
    body:  (svc, name) => `${name} marked your "${svc}" booking as complete. Leave a review!`,
  },
  provider_completed: {
    title: "Work Completed 🔔",
    body:  (svc, name) => `${name} completed "${svc}". Please confirm to finalise.`,
  },
  customer_confirmed_completed: {
    title: "Job Confirmed ✅",
    body:  (svc, _name) => `Customer confirmed "${svc}" is complete. Your earnings have been recorded!`,
  },
};

router.post("/bookings/notify-customer", async (req, res) => {
  // Require a valid Supabase session token from the caller (must be an authenticated provider)
  const authHeader = req.headers["authorization"] as string | undefined;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Authorization header required" });
    return;
  }
  if (supabase) {
    const { data: callerData, error: callerErr } = await supabase.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    // Confirm caller is a provider (is_provider flag on their profile)
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("is_provider")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (!callerProfile?.is_provider) {
      res.status(403).json({ error: "Only providers can trigger booking notifications" });
      return;
    }
  }

  const { customerId, status, providerName, service } = req.body as {
    customerId?: string;
    status?:     string;
    providerName?: string;
    service?:    string;
  };

  if (!customerId || !status) {
    res.status(400).json({ error: "customerId and status are required" });
    return;
  }

  const cfg = BOOKING_NOTIFY_CFG[status];
  if (!cfg) {
    res.status(400).json({ error: `Unknown status: ${status}` });
    return;
  }

  if (!supabase) {
    res.json({ sent: false, reason: "supabase_not_configured" });
    return;
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", customerId)
      .maybeSingle();

    const token = profile?.push_token as string | undefined;

    const name = providerName || "Your provider";
    const svc  = service     || "service";

    const notifTitle = cfg.title;
    const notifBody  = cfg.body(svc, name);
    const notifData  = { type: "booking", source: "booking_update", status };

    // Always persist the in-app notification — even when device has no push token.
    // This ensures the Notification page shows the entry regardless of push permissions.
    try {
      const all = readJson<any[]>("notifications", []);
      const notifId = `booking-${status}-${customerId.slice(0, 8)}-${Date.now()}`;
      if (!all.some((n: any) => n.id === notifId)) {
        all.unshift({
          id: notifId,
          title: notifTitle,
          body: notifBody,
          type: "booking",
          targetUserId: customerId,
          data: notifData,
          sentAt: new Date().toISOString(),
          read: false,
        });
        writeJson("notifications", all.slice(0, 500));
      }
    } catch { /* non-fatal */ }

    if (!token || !token.startsWith("ExponentPushToken")) {
      logger.info({ customerId: `${customerId.slice(0, 8)}…`, status }, "bookings: in-app persisted (no push token)");
      res.json({ sent: false, reason: "no_push_token" });
      return;
    }

    fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to:        token,
        sound:     "default",
        title:     notifTitle,
        body:      notifBody,
        data:      notifData,
        priority:  "high",
        channelId: "default",
      }),
    }).catch((err: Error) => logger.warn({ err }, "bookings/notify-customer: push send failed"));

    logger.info({ customerId: `${customerId.slice(0, 8)}…`, status }, "bookings: customer notified");
    res.json({ sent: true });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "bookings/notify-customer error");
    res.json({ sent: false, reason: err?.message ?? "unknown" });
  }
});

// ── Helper: build merged provider list ───────────────────────────────────────
async function buildAllProviders(): Promise<any[]> {
  const sbProviders = await fetchSupabaseProviders();
  const localProviders = readJson<any[]>("providers", []);
  const sbIds = new Set(sbProviders.map((p: any) => p.id));
  return [
    ...sbProviders,
    ...localProviders
      .filter((p: any) => !sbIds.has(p.id))
      .map((p: any) => ({
        id: p.id, userId: p.userId ?? null, name: p.name,
        category: p.category ?? "", location: p.location ?? p.city ?? "",
        available: p.available ?? true, verified: p.verified ?? false,
        suspended: p.suspended ?? false, blocked: p.blocked ?? false,
        rating: p.rating ?? 0, reviewCount: p.reviewCount ?? 0,
        registeredAt: p.registeredAt ?? p.created_at ?? null,
      })),
  ];
}

// ── GET /api/admin/demand-analytics ──────────────────────────────────────────
// Real category demand, monthly booking activity, auto-generated insights.
router.get("/admin/demand-analytics", async (_req, res) => {
  try {
    const allProviders = await buildAllProviders();

    let bookingMsgs: any[] = [];
    let reviewMsgs: any[] = [];

    if (supabase) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("type, booking_status, created_at, provider_id")
        .limit(10000);
      bookingMsgs = (msgs ?? []).filter((m: any) => m.type === "booking");
      reviewMsgs  = (msgs ?? []).filter((m: any) => m.type  === "review");
    }

    const provIdToCat: Record<string, string> = {};
    allProviders.forEach((p: any) => { if (p.id) provIdToCat[String(p.id)] = p.category || "Unknown"; });

    // Category demand aggregation
    const catMap: Record<string, { providers: number; bookings: number; reviews: number }> = {};
    allProviders.forEach((p: any) => {
      const cat = p.category || "Unknown";
      if (!catMap[cat]) catMap[cat] = { providers: 0, bookings: 0, reviews: 0 };
      catMap[cat].providers++;
      catMap[cat].reviews += Number(p.reviewCount ?? 0);
    });
    bookingMsgs.forEach((m: any) => {
      const cat = provIdToCat[String(m.provider_id ?? "")] ?? "Unknown";
      if (!catMap[cat]) catMap[cat] = { providers: 0, bookings: 0, reviews: 0 };
      catMap[cat].bookings++;
    });

    // YoY growth per category
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;
    const catThisYear: Record<string, number> = {};
    const catLastYear: Record<string, number> = {};
    allProviders.forEach((p: any) => {
      const cat = p.category || "Unknown";
      const reg = p.registeredAt ? new Date(p.registeredAt) : null;
      if (reg) {
        if (reg.getFullYear() === thisYear) catThisYear[cat] = (catThisYear[cat] ?? 0) + 1;
        if (reg.getFullYear() === lastYear) catLastYear[cat] = (catLastYear[cat] ?? 0) + 1;
      }
    });

    const categoryDemand = Object.entries(catMap)
      .map(([name, s]) => ({
        name,
        providers: s.providers,
        bookings: s.bookings,
        reviews: s.reviews,
        yoyGrowth: (catLastYear[name] ?? 0) > 0
          ? Math.round(((catThisYear[name] ?? 0) - catLastYear[name]) / catLastYear[name] * 100)
          : (catThisYear[name] ?? 0) > 0 ? 100 : 0,
      }))
      .sort((a, b) => (b.providers + b.bookings) - (a.providers + a.bookings));

    // Monthly booking activity (last 12 months)
    const monthKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const monthBookings: Record<string, number> = {};
    monthKeys.forEach((k) => (monthBookings[k] = 0));
    bookingMsgs.forEach((m: any) => {
      if (m.created_at) {
        const k = m.created_at.slice(0, 7);
        if (k in monthBookings) monthBookings[k]++;
      }
    });
    const monthlyActivity = monthKeys.map((key) => ({
      month: new Date(key + "-01").toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      bookings: monthBookings[key],
    }));

    // Auto-generated insights from real data
    const insights: any[] = [];
    const topCat = categoryDemand[0];
    if (topCat) {
      insights.push({
        icon: "📊", color: "#FF6B35",
        title: `${topCat.name} is your top category (${topCat.providers} provider${topCat.providers !== 1 ? "s" : ""})`,
        detail: topCat.bookings > 0
          ? `${topCat.bookings} booking request${topCat.bookings !== 1 ? "s" : ""} recorded. ${topCat.reviews} review${topCat.reviews !== 1 ? "s" : ""}.`
          : "No booking requests recorded yet. Promote this category to attract customers.",
        urgency: topCat.providers >= 2 ? "medium" : "low",
      });
    }
    const totalBookingsCount = bookingMsgs.length;
    const completedCount = bookingMsgs.filter((m: any) =>
      ["customer_confirmed_completed", "provider_completed"].includes(m.booking_status ?? "")).length;
    if (totalBookingsCount > 0) {
      const rate = Math.round((completedCount / totalBookingsCount) * 100);
      insights.push({
        icon: "✅", color: "#10B981",
        title: `Booking completion rate: ${rate}% (${completedCount} of ${totalBookingsCount})`,
        detail: rate >= 80
          ? "Healthy completion rate. Keep encouraging providers to respond promptly."
          : "Completion rate needs improvement. Follow up with providers on pending bookings.",
        urgency: rate >= 80 ? "low" : "high",
      });
    }
    const unverified = allProviders.filter((p: any) => !p.verified).length;
    if (unverified > 0) {
      insights.push({
        icon: "🔵", color: "#3B82F6",
        title: `${unverified} provider${unverified !== 1 ? "s" : ""} awaiting verification`,
        detail: "Verified providers get higher visibility and more booking requests. Review them in the Providers panel.",
        urgency: unverified > 3 ? "high" : "medium",
      });
    }
    const avgRating = allProviders.length
      ? allProviders.reduce((s: number, p: any) => s + Number(p.rating ?? 0), 0) / allProviders.length
      : 0;
    if (avgRating > 0) {
      insights.push({
        icon: "⭐", color: "#F59E0B",
        title: `Platform average rating: ${avgRating.toFixed(1)} / 5.0`,
        detail: `Based on ${allProviders.filter((p: any) => p.rating > 0).length} rated providers with ${
          allProviders.reduce((s: number, p: any) => s + Number(p.reviewCount ?? 0), 0)} total reviews.`,
        urgency: avgRating >= 4.5 ? "low" : avgRating >= 4 ? "medium" : "high",
      });
    }
    const cities = new Set(allProviders.map((p: any) => (p.location ?? "").split(",")[0].trim()).filter(Boolean));
    if (cities.size > 0) {
      insights.push({
        icon: "📍", color: "#8B5CF6",
        title: `Operating in ${cities.size} city area${cities.size !== 1 ? "s" : ""}`,
        detail: `Current coverage: ${Array.from(cities).join(", ")}. Expand provider network to new cities to grow the platform.`,
        urgency: "low",
      });
    }
    const recent30 = allProviders.filter((p: any) => {
      if (!p.registeredAt) return false;
      return (now.getTime() - new Date(p.registeredAt).getTime()) < 30 * 86400000;
    }).length;
    if (recent30 > 0) {
      insights.push({
        icon: "📈", color: "#10B981",
        title: `${recent30} new provider${recent30 !== 1 ? "s" : ""} registered in the last 30 days`,
        detail: "Platform is growing. Keep sharing the provider onboarding link to accelerate acquisition.",
        urgency: "medium",
      });
    }
    if (insights.length < 3) {
      insights.push({
        icon: "💡", color: "#6366F1",
        title: "Build your provider network",
        detail: "With more providers across categories, your analytics will reflect real demand patterns. Share the app link to invite skilled workers.",
        urgency: "low",
      });
    }

    res.json({ categoryDemand, monthlyActivity, autoInsights: insights });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "demand-analytics error");
    res.json({ categoryDemand: [], monthlyActivity: [], autoInsights: [] });
  }
});

// ── GET /api/admin/behavior-analytics ────────────────────────────────────────
// Real peak hours from message timestamps, category engagement, completion rate.
router.get("/admin/behavior-analytics", async (_req, res) => {
  try {
    const allProviders = await buildAllProviders();

    let allMessages: any[] = [];
    if (supabase) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("type, booking_status, created_at, provider_id")
        .limit(10000);
      allMessages = msgs ?? [];
    }

    const bookings  = allMessages.filter((m: any) => m.type === "booking");
    const completed = bookings.filter((m: any) =>
      ["customer_confirmed_completed", "provider_completed"].includes(m.booking_status ?? ""));
    const completionRate = bookings.length > 0 ? Math.round((completed.length / bookings.length) * 100) : 0;

    // Peak hours: group into 3-hour bands
    const BANDS = ["12–3 AM", "3–6 AM", "6–9 AM", "9–12 PM", "12–3 PM", "3–6 PM", "6–9 PM", "9–12 AM"];
    const bandCount: Record<string, number> = {};
    BANDS.forEach((b) => (bandCount[b] = 0));
    allMessages.forEach((m: any) => {
      if (!m.created_at) return;
      const h = new Date(m.created_at).getHours();
      const band =
        h < 3 ? "12–3 AM" : h < 6 ? "3–6 AM" : h < 9 ? "6–9 AM" : h < 12 ? "9–12 PM" :
        h < 15 ? "12–3 PM" : h < 18 ? "3–6 PM" : h < 21 ? "6–9 PM" : "9–12 AM";
      bandCount[band]++;
    });
    const maxBand = Math.max(...Object.values(bandCount), 1);
    const peakHours = BANDS.map((hour) => ({
      hour,
      activity: Math.round((bandCount[hour] / maxBand) * 100),
      count: bandCount[hour],
    }));

    // Most booked categories
    const provIdToCat: Record<string, string> = {};
    allProviders.forEach((p: any) => { if (p.id) provIdToCat[String(p.id)] = p.category || "Unknown"; });
    const catBookings: Record<string, number> = {};
    bookings.forEach((m: any) => {
      const cat = provIdToCat[String(m.provider_id ?? "")] ?? "Unknown";
      catBookings[cat] = (catBookings[cat] ?? 0) + 1;
    });
    const mostContacted = Object.entries(catBookings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, count]) => ({ category, count }));

    // Category engagement radar (normalised 0–100)
    const catEng: Record<string, { providers: number; bookings: number; reviews: number }> = {};
    allProviders.forEach((p: any) => {
      const cat = p.category || "Unknown";
      if (!catEng[cat]) catEng[cat] = { providers: 0, bookings: 0, reviews: 0 };
      catEng[cat].providers++;
      catEng[cat].reviews += Number(p.reviewCount ?? 0);
    });
    bookings.forEach((m: any) => {
      const cat = provIdToCat[String(m.provider_id ?? "")] ?? "Unknown";
      if (!catEng[cat]) catEng[cat] = { providers: 0, bookings: 0, reviews: 0 };
      catEng[cat].bookings++;
    });
    const maxP = Math.max(...Object.values(catEng).map((c) => c.providers), 1);
    const maxB = Math.max(...Object.values(catEng).map((c) => c.bookings), 1);
    const maxR = Math.max(...Object.values(catEng).map((c) => c.reviews), 1);
    const categoryEngagement = Object.entries(catEng).map(([category, s]) => ({
      category,
      providers: Math.round((s.providers / maxP) * 100),
      bookings:  Math.round((s.bookings  / maxB) * 100),
      reviews:   Math.round((s.reviews   / maxR) * 100),
      rawProviders: s.providers, rawBookings: s.bookings, rawReviews: s.reviews,
    }));

    res.json({
      totalMessages: allMessages.length,
      totalBookings: bookings.length,
      completedBookings: completed.length,
      completionRate,
      peakHours,
      mostContacted,
      categoryEngagement,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "behavior-analytics error");
    res.json({ totalMessages: 0, totalBookings: 0, completedBookings: 0, completionRate: 0, peakHours: [], mostContacted: [], categoryEngagement: [] });
  }
});

// ── GET /api/admin/time-analytics ─────────────────────────────────────────────
// Real monthly/quarterly provider registrations + booking + earnings trends.
router.get("/admin/time-analytics", async (_req, res) => {
  try {
    const allProviders = await buildAllProviders();

    let bookings: any[] = [];
    if (supabase) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("type, booking_status, created_at, booking_price")
        .eq("type", "booking")
        .limit(10000);
      bookings = msgs ?? [];
    }
    const earningsData = readJson<any[]>("earnings", []);

    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const mReg: Record<string, number> = {};
    const mBook: Record<string, number> = {};
    const mDone: Record<string, number> = {};
    const mEarn: Record<string, number> = {};
    monthKeys.forEach((k) => { mReg[k] = 0; mBook[k] = 0; mDone[k] = 0; mEarn[k] = 0; });

    allProviders.forEach((p: any) => {
      if (p.registeredAt) {
        const k = String(p.registeredAt).slice(0, 7);
        if (k in mReg) mReg[k]++;
      }
    });
    bookings.forEach((m: any) => {
      if (m.created_at) {
        const k = m.created_at.slice(0, 7);
        if (k in mBook) {
          mBook[k]++;
          if (["customer_confirmed_completed", "provider_completed"].includes(m.booking_status ?? "")) {
            mDone[k]++;
            mEarn[k] += Number(m.booking_price ?? 0);
          }
        }
      }
    });
    earningsData.forEach((e: any) => {
      if (e.date) {
        const k = String(e.date).slice(0, 7);
        if (k in mEarn) mEarn[k] += Number(e.amount ?? 0);
      }
    });

    const monthly = monthKeys.map((key) => {
      const d = new Date(key + "-01");
      return {
        label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
        month: d.toLocaleString("en-IN", { month: "short" }),
        year: d.getFullYear(),
        registrations: mReg[key],
        bookings: mBook[key],
        completedBookings: mDone[key],
        earnings: mEarn[key],
      };
    });

    // Aggregate into quarters
    const qMap: Record<string, { registrations: number; bookings: number; completedBookings: number; earnings: number }> = {};
    monthly.forEach((m) => {
      const monthNum = new Date(`${m.year}-${m.label.replace(/\s.*/,"")}-01`).getMonth() + 1;
      const q = `Q${Math.ceil(monthNum / 3)} ${m.year}`;
      if (!qMap[q]) qMap[q] = { registrations: 0, bookings: 0, completedBookings: 0, earnings: 0 };
      qMap[q].registrations     += m.registrations;
      qMap[q].bookings          += m.bookings;
      qMap[q].completedBookings += m.completedBookings;
      qMap[q].earnings          += m.earnings;
    });
    const quarterly = Object.entries(qMap).map(([quarter, d]) => ({ quarter, ...d }));

    res.json({ monthly, quarterly });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "time-analytics error");
    res.json({ monthly: [], quarterly: [] });
  }
});

// ── GET /api/admin/revenue-analytics ─────────────────────────────────────────
// Real plan pricing from plans.json + real ad counts from ads.json.
router.get("/admin/revenue-analytics", async (_req, res) => {
  try {
    const rawPlans = readJson<any[]>("plans", []);
    const rawAds   = readJson<any[]>("ads",   []);

    const PLAN_COLORS: Record<string, string> = { monthly: "#94A3B8", quarterly: "#3B82F6", yearly: "#FF6B35", annual: "#FF6B35" };
    const plans = rawPlans.map((p: any) => ({
      key:   p.key   ?? p.id ?? "plan",
      name:  p.label ?? p.name ?? "Plan",
      price: Number(p.price ?? p.monthlyPrice ?? 0),
      subscribers: Number(p.subscribers ?? 0),
      revenue: Number(p.price ?? 0) * Number(p.subscribers ?? 0),
      color: PLAN_COLORS[p.key ?? ""] ?? "#64748B",
    }));

    // Ads bucketed by month (last 12 months)
    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const adsPerMonth: Record<string, number> = {};
    monthKeys.forEach((k) => (adsPerMonth[k] = 0));
    rawAds.forEach((ad: any) => {
      const ds = ad.createdAt ?? ad.startDate ?? ad.created_at ?? "";
      if (ds) {
        const k = String(ds).slice(0, 7);
        if (k in adsPerMonth) adsPerMonth[k]++;
      }
    });
    const adsMonthly = monthKeys.map((key) => ({
      month: new Date(key + "-01").toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      count: adsPerMonth[key],
    }));

    res.json({
      plans,
      adsMonthly,
      totalAds:    rawAds.length,
      activeAds:   rawAds.filter((a: any) => a.active !== false).length,
      totalPlanRevenue: plans.reduce((s: number, p: any) => s + p.revenue, 0),
      subscriptionsEnabled: false,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "revenue-analytics error");
    res.json({ plans: [], adsMonthly: [], totalAds: 0, activeAds: 0, totalPlanRevenue: 0, subscriptionsEnabled: false });
  }
});

export default router;
