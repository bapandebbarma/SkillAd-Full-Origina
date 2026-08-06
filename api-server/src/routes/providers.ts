import { Router, type IRouter } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import {
  buildProviderOgHtml,
  getProviderPhoneDigits,
  getPublicUnavailability,
  toPublicProviderDTO,
} from "../lib/publicProvider.js";

function readSettings(): any {
  try {
    const f = resolve(__dirname, "../data/settings.json");
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8")) as any;
  } catch { /* fall through */ }
  return {};
}

function readSubs(): any[] {
  try {
    const f = resolve(__dirname, "../data/subscriptions.json");
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8")) as any[];
  } catch { /* fall through */ }
  return [];
}

function writeSubs(subs: any[]): void {
  const f = resolve(__dirname, "../data/subscriptions.json");
  writeFileSync(f, JSON.stringify(subs, null, 2), "utf-8");
}

const router: IRouter = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");
const DATA_FILE = resolve(DATA_DIR, "providers.json");

function readProviders(): any[] {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw) as any[];
    }
  } catch {
    // fall through
  }
  return [];
}

function writeProviders(providers: any[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(providers, null, 2), "utf-8");
}

// Normalize phone to last 10 digits (handles +91 prefix etc.)
function normalizePhone(raw: string): string {
  return (raw ?? "").toString().replace(/\D/g, "").replace(/^91/, "").slice(-10);
}

// Map a Supabase row to the same shape as providers.json
function mapSbRow(row: any): any {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    name: row.name,
    category: row.category,
    subcategory: row.subcategory ?? null,
    rating: row.rating ?? 0,
    reviewCount: row.review_count ?? row.reviews?.length ?? 0,
    distance: 0,
    available: row.available ?? true,
    experience: row.experience ?? 0,
    description: row.description ?? "",
    phone: row.phone ?? "",
    location: row.location ?? "",
    serviceRadius: row.service_radius ?? 50,
    serviceCharge: row.service_charge ?? null,
    serviceArea: row.service_area ?? row.serviceArea ?? row.working_hours ?? "",
    workingHours: row.working_hours ?? "",
    latitude: row.latitude ?? 23.8315,
    longitude: row.longitude ?? 91.2868,
    verified: row.verified ?? false,
    initials: row.initials ?? "PR",
    avatarColor: row.avatar_color ?? "#64748B",
    avatarUrl: (Array.isArray(row.profiles) ? row.profiles[0]?.avatar_url : row.profiles?.avatar_url) ?? row.avatar_url ?? null,
    services: row.services ?? [],
    reviews: (row.reviews ?? []).map((r: any) => ({
      id: r.id,
      reviewerName: r.reviewer_name,
      reviewerInitials: r.reviewer_initials,
      rating: r.rating,
      comment: r.comment,
      date: r.created_at,
    })),
    registeredAt: row.created_at ?? new Date().toISOString(),
    // Derive subscription status from the DB column so Supabase-only providers
    // are correctly hidden when their trial/plan expires.
    // undefined = no end date set = not subject to expiry filtering.
    subscriptionActive: row.subscription_end_date
      ? new Date(row.subscription_end_date) > new Date()
      : undefined,
    subscriptionEndDate: row.subscription_end_date ?? null,
    _source: "supabase",
  };
}

/**
 * Build a provider API object using the same merge rules for list and detail endpoints.
 * - Dual-store: full Supabase row is the base; JSON contributes only structural metadata.
 * - JSON-only (mock/seed): served from JSON unchanged when no Supabase counterpart exists.
 */
function buildProviderResponse(sbProvider: any | null, jsonProvider?: any | null): any | null {
  if (!sbProvider && !jsonProvider) return null;
  if (!sbProvider) return jsonProvider ?? null;

  const base = sbProvider._source === "supabase" ? sbProvider : mapSbRow(sbProvider);
  if (!jsonProvider) return base;

  return {
    ...base,
    verified:            jsonProvider.verified === true || base.verified === true,
    suspended:           jsonProvider.suspended  ?? false,
    blocked:             jsonProvider.blocked    ?? false,
    subscriptionEndDate: jsonProvider.subscriptionEndDate ?? base.subscriptionEndDate,
    subscriptionActive:  jsonProvider.subscriptionEndDate
      ? new Date(jsonProvider.subscriptionEndDate) > new Date()
      : base.subscriptionActive,
  };
}

function mapDetailReviews(sbReviews: any[]): any[] {
  return sbReviews.map((r: any) => ({
    id: r.id,
    reviewerName: r.reviewer_name ?? r.reviewer ?? "Anonymous",
    reviewerInitials: r.reviewer_initials ?? (r.reviewer_name ?? "A")[0].toUpperCase(),
    rating: r.rating,
    comment: r.comment ?? "",
    date: r.created_at,
    avatarUrl: (r.profiles as any)?.avatar_url ?? null,
  }));
}

async function fetchSupabaseProviders(category?: string): Promise<any[]> {
  if (!supabase) return [];
  try {
    // NOTE: do NOT join reviews(*) — no FK relationship exists in the schema.
    // Reviews are loaded separately on the provider detail screen.
    let q = supabase
      .from("providers")
      .select("*, profiles(avatar_url)")
      .order("rating", { ascending: false });
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error || !data) {
      // Fallback: simple select without any joins
      const r2 = await supabase.from("providers").select("*");
      if (r2.error || !r2.data) return [];
      const filtered = category ? r2.data.filter((r: any) => r.category === category) : r2.data;
      return filtered.map((r: any) => mapSbRow({ ...r, reviews: [] }));
    }
    return data.map(mapSbRow);
  } catch {
    return [];
  }
}

// Haversine formula — returns distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/providers?category=Electrician&lat=23.8&lng=91.2
router.get("/providers", async (req, res) => {
  const { category } = req.query as { category?: string };
  const customerLat = req.query["lat"] ? parseFloat(req.query["lat"] as string) : null;
  const customerLng = req.query["lng"] ? parseFloat(req.query["lng"] as string) : null;
  const hasLocation = customerLat !== null && customerLng !== null && !isNaN(customerLat) && !isNaN(customerLng);

  const [jsonProviders, sbProviders] = await Promise.all([
    Promise.resolve(readProviders()),
    fetchSupabaseProviders(category),
  ]);

  // Merge strategy:
  // - Supabase-only providers (Ajoy, Minakshi): served directly from Supabase.
  // - JSON-only providers (mock/seed): served from JSON unchanged.
  // - Dual-store providers (real user who registered via app): Supabase wins for all
  //   display fields (rating, reviewCount, location, serviceCharge, avatarColor, available,
  //   and all profile data). JSON contributes only the structural flags that it exclusively
  //   manages: verified, suspended, blocked, subscriptionEndDate.
  const sbById = new Map(sbProviders.map((p: any) => [p.id, p]));
  const jsonIds = new Set(jsonProviders.map((p: any) => p.id));
  const sbOnly = sbProviders.filter((p: any) => !jsonIds.has(p.id));
  const mergedJson = jsonProviders.map((p: any) => buildProviderResponse(sbById.get(p.id) ?? null, p));
  let all = [...mergedJson, ...sbOnly];

  // Gap #1 fix: enrich JSON-file providers with profiles.avatar_url.
  // Supabase providers already have it via the profiles(avatar_url) JOIN in fetchSupabaseProviders.
  // JSON-file providers have no Supabase query — batch-fetch their profiles here.
  if (supabase) {
    const jsonUserIds = [...new Set(
      all
        .filter((p: any) => p._source !== "supabase" && p.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.userId))
        .map((p: any) => p.userId as string),
    )];
    if (jsonUserIds.length > 0) {
      try {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .in("id", jsonUserIds);
        if (profileRows) {
          const avatarMap = new Map<string, string | null>(
            (profileRows as any[]).map((r: any) => [r.id as string, r.avatar_url ?? null]),
          );
          all = all.map((p: any) =>
            p._source !== "supabase" && p.userId && avatarMap.has(p.userId)
              ? { ...p, avatarUrl: avatarMap.get(p.userId) ?? p.avatarUrl ?? null }
              : p,
          );
        }
      } catch { /* non-fatal — Supabase unreachable, continue without enrichment */ }
    }
  }

  if (category) all = all.filter((p: any) => p.category === category);

  // Optional city filter for landing (additive — does not change lat/lng radius logic)
  const cityQ = typeof req.query["city"] === "string" ? req.query["city"].trim() : "";
  if (cityQ) {
    const needle = cityQ.toLowerCase();
    all = all.filter((p: any) => String(p.location ?? "").toLowerCase().includes(needle));
  }

  // Only show verified providers on the public (mobile app) feed
  all = all.filter((p: any) => p.verified === true);

  // Never show blocked or suspended providers to customers
  all = all.filter((p: any) => !p.blocked && !p.suspended);

  // Filter out providers whose subscription has expired.
  // Mirrors isSubscriptionExpired(): checks both the flag AND the raw end date so
  // providers whose date has passed but flag was never explicitly set to false are
  // also hidden (e.g. JSON-file providers that pre-date the expiry-checker run).
  all = all.filter((p: any) => {
    if (p.subscriptionActive === false) return false;
    if (p.subscriptionEndDate && new Date(p.subscriptionEndDate as string) <= new Date()) return false;
    return true;
  });

  // Strict radius filter: only show providers whose service radius covers the customer's location.
  if (hasLocation) {
    const withDist = all.map((p: any) => {
      const provLat: number = p.latitude ?? 23.8315;
      const provLng: number = p.longitude ?? 91.2868;
      const dist = parseFloat(haversineKm(customerLat!, customerLng!, provLat, provLng).toFixed(1));
      return { ...p, distance: dist };
    });

    const filtered: any[] = [];
    for (const p of withDist) {
      const radius: number = Math.max(p.serviceRadius ?? 50, 50);
      if (p.distance <= radius) filtered.push(p);
    }

    all = filtered.sort((a: any, b: any) => a.distance - b.distance);
  }

  // Ensure all providers expose avatarUrl (single source of truth: profiles.avatar_url)
  all = all.map((p: any) => ({ ...p, avatarUrl: p.avatarUrl ?? null }));

  res.json({ providers: all });
});

// GET /api/providers/by-phone/:phone — look up provider by mobile number
router.get("/providers/by-phone/:phone", async (req, res) => {
  const raw = req.params["phone"] as string;
  const phone = normalizePhone(raw);
  if (phone.length < 10) {
    res.status(400).json({ error: "Invalid phone number" });
    return;
  }

  // Check JSON file first
  const jsonProviders = readProviders();
  const jsonMatch = jsonProviders.find((p: any) => normalizePhone(p.phone ?? "") === phone);
  if (jsonMatch) {
    // Gap #2 fix: enrich JSON provider with profiles.avatar_url
    if (supabase && jsonMatch.userId) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", jsonMatch.userId)
          .maybeSingle();
        if (profile?.avatar_url) {
          res.json({ provider: { ...jsonMatch, avatarUrl: profile.avatar_url }, exists: true });
          return;
        }
      } catch { /* non-fatal */ }
    }
    res.json({ provider: jsonMatch, exists: true });
    return;
  }

  // Check Supabase
  if (supabase) {
    try {
      // Gap #2 fix: helper to enrich a Supabase row with profiles.avatar_url
      async function enrichWithProfile(row: any): Promise<any> {
        if (!row.user_id) return mapSbRow(row);
        const { data: profile } = await supabase!
          .from("profiles")
          .select("avatar_url")
          .eq("id", row.user_id)
          .maybeSingle();
        return { ...mapSbRow(row), avatarUrl: profile?.avatar_url ?? mapSbRow(row).avatarUrl ?? null };
      }

      // NOTE: do NOT use reviews(*) join — no FK from providers to reviews exists.
      // Attempting it causes a PostgREST error that the catch block swallows,
      // making the route silently return {provider: null, exists: false}.
      const { data } = await supabase
        .from("providers")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
      if (data) {
        res.json({ provider: await enrichWithProfile(data), exists: true });
        return;
      }
      // Also try with country code prefix
      const { data: data2 } = await supabase
        .from("providers")
        .select("*")
        .eq("phone", `+91${phone}`)
        .maybeSingle();
      if (data2) {
        res.json({ provider: await enrichWithProfile(data2), exists: true });
        return;
      }
    } catch {
      // fall through
    }
  }

  res.json({ provider: null, exists: false });
});

// Returns true when the provider's subscription has lapsed.
function isSubscriptionExpired(p: any): boolean {
  if (p.subscriptionActive === false) return true;
  if (p.subscriptionEndDate && new Date(p.subscriptionEndDate as string) <= new Date()) return true;
  return false;
}

/**
 * Load provider by id (Supabase + JSON merge). Used by detail + public endpoints.
 * Does not apply subscription/visibility gates — callers decide.
 */
async function loadProviderRecord(id: string): Promise<any | null> {
  const jsonProviders = readProviders();
  const local = jsonProviders.find((p: any) => p.id === id) ?? null;

  if (supabase) {
    try {
      const [sbResult, reviewsResult] = await Promise.all([
        supabase.from("providers").select("*, profiles(avatar_url)").eq("id", id).maybeSingle(),
        supabase.from("reviews").select("*, profiles(avatar_url)").eq("provider_id", id),
      ]);

      let provider = buildProviderResponse(sbResult.data ?? null, local);
      if (provider) {
        const mappedReviews = mapDetailReviews((reviewsResult.data ?? []) as any[]);
        const allReviewsList = mappedReviews.length > 0
          ? mappedReviews
          : (local?.reviews ?? provider.reviews ?? []);
        const liveRating = allReviewsList.length > 0
          ? parseFloat((allReviewsList.reduce((s: number, r: any) => s + (r.rating ?? 0), 0) / allReviewsList.length).toFixed(1))
          : (provider.rating ?? 0);

        if (!provider.avatarUrl && provider.userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", provider.userId)
            .maybeSingle();
          if (profile?.avatar_url) {
            provider = { ...provider, avatarUrl: profile.avatar_url };
          }
        }

        return {
          ...provider,
          reviews: allReviewsList,
          rating: liveRating,
          reviewCount: allReviewsList.length,
          avatarUrl: provider.avatarUrl ?? null,
        };
      }
    } catch {
      // fall through to JSON
    }
  }

  if (local) {
    if (supabase && local.userId) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", local.userId)
          .maybeSingle();
        if (profile?.avatar_url) {
          return { ...local, avatarUrl: profile.avatar_url };
        }
      } catch { /* non-fatal */ }
    }
    return local;
  }

  return null;
}

async function recordPublicActivity(
  providerId: string,
  eventType: string,
  platform?: string,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("provider_activity").insert({
      provider_id: providerId,
      customer_id: null,
      event_type: eventType,
      platform: platform ?? "web",
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[providers] public activity insert error");
  }
}

// GET /api/providers/:id/public — sanitized profile for web share pages
router.get("/providers/:id/public", async (req, res) => {
  const id = req.params["id"] as string;
  try {
    const provider = await loadProviderRecord(id);
    const reason = getPublicUnavailability(provider);
    if (reason) {
      res.status(404).json({
        available: false,
        reason: "unavailable",
        message: "This provider is no longer available.",
      });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ available: true, provider: toPublicProviderDTO(provider) });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[providers] public profile error");
    res.status(404).json({
      available: false,
      reason: "unavailable",
      message: "This provider is no longer available.",
    });
  }
});

// GET /api/providers/:id/public/preview — OG / Twitter / JSON-LD HTML for crawlers
router.get("/providers/:id/public/preview", async (req, res) => {
  const id = req.params["id"] as string;
  try {
    const provider = await loadProviderRecord(id);
    const reason = getPublicUnavailability(provider);
    const dto = reason ? null : toPublicProviderDTO(provider);
    const html = buildProviderOgHtml({ provider: dto, unavailable: Boolean(reason) });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=120");
    res.status(reason ? 404 : 200).send(html);
  } catch {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(404).send(buildProviderOgHtml({ provider: null, unavailable: true }));
  }
});

// Secure contact redirects — do not expose raw phone in the public JSON
router.get("/providers/:id/contact/whatsapp", async (req, res) => {
  const id = req.params["id"] as string;
  try {
    const provider = await loadProviderRecord(id);
    if (getPublicUnavailability(provider)) {
      res.redirect(302, "https://skillad.in/");
      return;
    }
    const phone = getProviderPhoneDigits(provider);
    if (!phone) {
      res.redirect(302, `https://skillad.in/provider/${encodeURIComponent(id)}`);
      return;
    }
    void recordPublicActivity(id, "whatsapp", "web");
    const text = encodeURIComponent(`Hi ${provider.name}, I found you on SkillAd.`);
    res.redirect(302, `https://wa.me/91${phone}?text=${text}`);
  } catch {
    res.redirect(302, "https://skillad.in/");
  }
});

router.get("/providers/:id/contact/call", async (req, res) => {
  const id = req.params["id"] as string;
  try {
    const provider = await loadProviderRecord(id);
    if (getPublicUnavailability(provider)) {
      res.redirect(302, "https://skillad.in/");
      return;
    }
    const phone = getProviderPhoneDigits(provider);
    if (!phone) {
      res.redirect(302, `https://skillad.in/provider/${encodeURIComponent(id)}`);
      return;
    }
    void recordPublicActivity(id, "call", "web");
    res.redirect(302, `tel:+91${phone}`);
  } catch {
    res.redirect(302, "https://skillad.in/");
  }
});

// GET /api/providers/:id
router.get("/providers/:id", async (req, res) => {
  const id = req.params["id"] as string;
  const provider = await loadProviderRecord(id);

  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  if (isSubscriptionExpired(provider)) {
    res.status(403).json({ error: "Provider subscription has expired", code: "SUBSCRIPTION_INACTIVE" });
    return;
  }

  res.json({ provider });
});

// POST /api/providers — upsert by PHONE (one phone = one provider)
router.post("/providers", (req, res) => {
  const body = req.body as any;
  if (!body || !body.name || !body.category) {
    res.status(400).json({ error: "name and category are required" });
    return;
  }

  const phone = normalizePhone(body.phone ?? "");
  const providers = readProviders();

  // Find existing record: first by phone (business key), then by id (fallback)
  let idx = -1;
  if (phone.length >= 10) {
    idx = providers.findIndex((p: any) => normalizePhone(p.phone ?? "") === phone);
  }
  if (idx < 0 && body.id) {
    idx = providers.findIndex((p: any) => p.id === body.id);
  }

  const existing = idx >= 0 ? providers[idx] : null;

  // Build the upsert record — preserve immutable fields (id, rating, reviews, registeredAt)
  const record = {
    id:          existing?.id ?? body.id ?? `local-${Date.now()}`,
    userId:      body.userId ?? existing?.userId ?? null,
    name:        body.name,
    category:    body.category,
    subcategory: body.subcategory ?? existing?.subcategory ?? null,
    // Preserve accumulated rating/reviews — never overwrite with zeros from client
    rating:      existing?.rating ?? body.rating ?? 0,
    reviewCount: existing?.reviewCount ?? body.reviewCount ?? 0,
    distance:    body.distance ?? 0,
    available:   body.available ?? existing?.available ?? true,
    experience:  body.experience ?? existing?.experience ?? 0,
    description: body.description ?? existing?.description ?? "",
    phone:       body.phone ?? existing?.phone ?? "",
    location:    body.location ?? existing?.location ?? "",
    serviceRadius:  body.serviceRadius  ?? existing?.serviceRadius  ?? 50,
    serviceCharge:  body.serviceCharge  ?? existing?.serviceCharge  ?? null,
    serviceArea:    body.serviceArea    ?? existing?.serviceArea    ?? existing?.workingHours ?? "",
    workingHours:   body.workingHours   ?? existing?.workingHours   ?? "",
    latitude:    body.latitude  ?? existing?.latitude  ?? 23.8315,
    longitude:   body.longitude ?? existing?.longitude ?? 91.2868,
    // Preserve admin-set verified status — never downgrade
    verified:    existing?.verified ?? body.verified ?? false,
    suspended:   existing?.suspended ?? false,
    blocked:     existing?.blocked ?? false,
    initials:    body.initials    ?? existing?.initials    ?? "PR",
    avatarColor: body.avatarColor ?? existing?.avatarColor ?? "#FF6B35",
    avatarUrl:   body.avatarUrl   ?? existing?.avatarUrl   ?? null,
    services:    Array.isArray(body.services) ? body.services : (existing?.services ?? []),
    reviews:     existing?.reviews ?? (Array.isArray(body.reviews) ? body.reviews : []),
    registeredAt: existing?.registeredAt ?? body.registeredAt ?? new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    // Subscription expiry — set once on first registration, never overwritten on edit
    subscriptionEndDate: existing?.subscriptionEndDate ?? (() => {
      const settings = readSettings();
      const days = (settings.freeTrialDays as number) ?? 180;
      return new Date(Date.now() + days * 86400000).toISOString();
    })(),
  };

  // For real Supabase users (valid UUID userId) write only structural fields to JSON.
  // Display fields (location, serviceCharge, avatarColor, available, rating, reviewCount,
  // services, description, etc.) are served from Supabase after the merge; persisting them
  // here only creates stale-data divergence on the next edit through any other path.
  // Mock/offline providers (non-UUID userId) continue to receive the full record as before.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isRealUser = !!(record.userId && UUID_RE.test(record.userId));
  const jsonRecord: any = isRealUser ? {
    id:                  record.id,
    userId:              record.userId,
    name:                record.name,
    phone:               record.phone,
    category:            record.category,
    latitude:            record.latitude,
    longitude:           record.longitude,
    serviceRadius:       record.serviceRadius,
    verified:            record.verified,
    suspended:           record.suspended,
    blocked:             record.blocked,
    subscriptionEndDate: record.subscriptionEndDate,
    registeredAt:        record.registeredAt,
  } : record;

  if (idx >= 0) {
    providers[idx] = jsonRecord;
  } else {
    providers.unshift(jsonRecord);
    // Auto-create a subscription record for new providers using the free trial period
    if (!existing) {
      const settings = readSettings();
      const days = (settings.freeTrialDays as number) ?? 180;
      const subs = readSubs();
      const alreadyHasSub = subs.some((s: any) => s.providerId === record.id);
      if (!alreadyHasSub) {
        subs.push({
          id: `sub_${Date.now()}`,
          userId: record.userId ?? "",
          providerId: record.id,
          plan: "free_trial",
          startDate: new Date().toISOString(),
          endDate: record.subscriptionEndDate,
          status: "active",
          notified7: false,
          notified3: false,
          notified1: false,
          notifiedExpired: false,
        });
        writeSubs(subs);
      }
    }
  }

  writeProviders(providers);

  // Also persist to Supabase via service role key — this bypasses RLS and fixes
  // the silent "null value in column id" failure that was keeping providers table at 0 rows.
  // Only write when we have a real Supabase user (userId starts with a UUID-style string,
  // not "local-..." or "ph-..." which are offline/demo registrations).
  if (supabase && record.userId) {
    supabase.from("providers").upsert(
      {
        id:            record.id,
        user_id:       record.userId,
        name:          record.name,
        phone:         record.phone ?? "",
        category:      record.category,
        subcategory:   record.subcategory ?? null,
        experience:    record.experience ?? 0,
        description:   record.description ?? "",
        service_radius: record.serviceRadius ?? 50,
        service_area:   record.serviceArea ?? null,
        service_charge: record.serviceCharge ?? null,
        working_hours:  record.workingHours ?? "",
        initials:      record.initials ?? "PR",
        avatar_color:  record.avatarColor ?? "#64748B",
        services:      record.services ?? [],
        location:      record.location ?? "",
        latitude:      record.latitude ?? 23.8315,
        longitude:     record.longitude ?? 91.2868,
        subscription_end_date: record.subscriptionEndDate ?? null,
      },
      { onConflict: "id" },
    ).then(({ error }) => {
      if (error) {
        logger.error({ provId: record.id, dbErr: error.message }, "[providers] Supabase upsert failed");
      }
    }, (netErr: unknown) => {
      logger.warn({ netErr }, "[providers] Supabase upsert network error");
    });

  }

  res.json({ success: true, provider: record, updated: idx >= 0 });
});

// POST /api/providers/:id/reviews — submit a customer review for a provider
// This route lives in providers.ts so it ships with the existing Hostinger deployment.
router.post("/providers/:id/reviews", async (req, res) => {
  const providerId = req.params["id"] as string;
  const { reviewerId, reviewerName, rating, comment } = req.body as {
    reviewerId?: string;
    reviewerName?: string;
    rating?: number;
    comment?: string;
  };

  if (!reviewerId || !reviewerName || typeof rating !== "number") {
    res.status(400).json({ error: "reviewerId, reviewerName, and rating are required" });
    return;
  }
  if (rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating must be between 1 and 5" });
    return;
  }

  const initials = reviewerName
    .split(" ")
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (!supabase) {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  // Prevent duplicate reviews from the same reviewer for the same provider
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("provider_id", providerId)
    .eq("reviewer_id", reviewerId)
    .maybeSingle();

  if (existingReview) {
    res.status(409).json({ error: "You have already reviewed this provider." });
    return;
  }

  const { error: insertError } = await supabase.from("reviews").insert({
    provider_id: providerId,
    reviewer_id: reviewerId,
    reviewer_name: reviewerName,
    reviewer_initials: initials,
    rating,
    comment: comment ?? "",
  });

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  // Recalculate average rating and review count
  const { data: allReviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("provider_id", providerId);

  if (allReviews && allReviews.length > 0) {
    const avg = allReviews.reduce((sum: number, r: any) => sum + (r.rating ?? 0), 0) / allReviews.length;
    await supabase
      .from("providers")
      .update({ rating: parseFloat(avg.toFixed(1)), review_count: allReviews.length })
      .eq("id", providerId);

    // Also update providers.json rating
    const providers = readProviders();
    const idx = providers.findIndex((p: any) => p.id === providerId);
    if (idx >= 0) {
      providers[idx].rating = parseFloat(avg.toFixed(1));
      providers[idx].reviewCount = allReviews.length;
      writeProviders(providers);
    }
  }

  res.json({ success: true });
});

// PUT /api/providers/:id — explicit update by ID
router.put("/providers/:id", (req, res) => {
  const id = req.params["id"] as string;
  const body = req.body as any;
  const providers = readProviders();
  const idx = providers.findIndex((p: any) => p.id === id);

  if (idx < 0) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  const existing = providers[idx];
  providers[idx] = {
    ...existing,
    ...body,
    // These fields must never be overwritten by client
    id: existing.id,
    rating: existing.rating,
    reviewCount: existing.reviewCount,
    reviews: existing.reviews,
    registeredAt: existing.registeredAt,
    verified: existing.verified,
    suspended: existing.suspended,
    blocked: existing.blocked,
    updatedAt: new Date().toISOString(),
  };

  writeProviders(providers);

  // Also sync to Supabase for real providers (fire-and-forget, non-fatal)
  const updated = providers[idx];
  const UUID_RE_PUT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (supabase && updated.userId && UUID_RE_PUT.test(updated.userId)) {
    supabase.from("providers").update({
      name:           updated.name,
      category:       updated.category,
      subcategory:    updated.subcategory ?? null,
      location:       updated.location ?? "",
      service_charge: updated.serviceCharge ?? null,
      avatar_color:   updated.avatarColor ?? null,
      available:      updated.available ?? true,
      experience:     updated.experience ?? 0,
      description:    updated.description ?? "",
      service_radius: updated.serviceRadius ?? 50,
      service_area:   updated.serviceArea ?? null,
      working_hours:  updated.workingHours ?? "",
      services:       updated.services ?? [],
      latitude:       updated.latitude ?? 23.8315,
      longitude:      updated.longitude ?? 91.2868,
      subscription_end_date: updated.subscriptionEndDate ?? null,
    }).eq("id", updated.id).then(({ error }) => {
      if (error) logger.warn({ provId: updated.id, dbErr: error.message }, "[providers] PUT Supabase sync failed");
    });
  }

  res.json({ success: true, provider: providers[idx] });
});

// ─── POST /api/providers/:id/activity ─────────────────────────────────────────
// Records a view, call, or whatsapp event for a provider.
// For view events: enforces 30-minute dedup per customer+provider pair.
router.post("/providers/:id/activity", async (req, res) => {
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }

  const providerId = req.params["id"] as string;
  const { customer_id, event_type, platform } = req.body as {
    customer_id?: string;
    event_type: string;
    platform?: string;
  };

  const VALID_TYPES = ["view", "call", "whatsapp", "download"];
  if (!VALID_TYPES.includes(event_type)) {
    res.status(400).json({ error: "Invalid event_type" });
    return;
  }

  try {
    // 30-minute dedup: only for view events with a known customer
    if (event_type === "view" && customer_id) {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("provider_activity")
        .select("id")
        .eq("provider_id", providerId)
        .eq("customer_id", customer_id)
        .eq("event_type", "view")
        .gte("created_at", cutoff)
        .limit(1);
      if (recent && recent.length > 0) {
        res.json({ success: true, skipped: true });
        return;
      }
    }

    const { error } = await supabase.from("provider_activity").insert({
      provider_id: providerId,
      customer_id: customer_id ?? null,
      event_type,
      platform: platform ?? null,
    });
    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[providers] activity insert error");
    res.status(500).json({ error: "Failed to record activity" });
  }
});

// ─── GET /api/providers/:id/activity ──────────────────────────────────────────
// Returns total counts: { views, calls, whatsapp }.
router.get("/providers/:id/activity", async (req, res) => {
  if (!supabase) { res.json({ views: 0, calls: 0, whatsapp: 0 }); return; }

  const providerId = req.params["id"] as string;

  try {
    const [viewsRes, callsRes, waRes] = await Promise.all([
      supabase
        .from("provider_activity")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .eq("event_type", "view"),
      supabase
        .from("provider_activity")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .eq("event_type", "call"),
      supabase
        .from("provider_activity")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .eq("event_type", "whatsapp"),
    ]);

    res.json({
      views:    viewsRes.count  ?? 0,
      calls:    callsRes.count  ?? 0,
      whatsapp: waRes.count     ?? 0,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[providers] activity fetch error");
    res.json({ views: 0, calls: 0, whatsapp: 0 });
  }
});

export default router;
