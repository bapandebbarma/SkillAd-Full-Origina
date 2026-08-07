import { supabase } from "./supabase";
import type { Provider, Review, Conversation, ChatMessage, BookingRequest, ProviderStats, BookingStatus } from "./types";
import { MOCK_PROVIDERS, MOCK_BOOKING_REQUESTS } from "./mockData";
import { getLocalProviders } from "./storage";

// Shared API server — same host, routed via the reverse proxy.
// On web the Expo app runs at *.expo.pike.replit.dev but the API lives at
// *.pike.replit.dev/api, so we strip the "expo." subdomain on the fly.
const PRODUCTION_API = "https://api.skillad.in/api";

function resolveApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    // "https://abc-00-xyz.expo.pike.replit.dev" → "https://abc-00-xyz.pike.replit.dev"
    const fixed = origin.replace(/\/\/([^.]+)\.expo\./, "//$1.");
    return (fixed !== origin ? fixed : origin) + "/api";
  }
  // React Native with no EXPO_PUBLIC_API_URL baked in → use production
  return PRODUCTION_API;
}
export const API_BASE = resolveApiBase();

// ─── Distance (Haversine formula, returns km) ─────────────────────────────────
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

async function apiFetchProviders(
  category?: string | null,
  userLat?: number,
  userLon?: number,
): Promise<Provider[]> {
  try {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (userLat != null && userLon != null) {
      params.set("lat", userLat.toString());
      params.set("lng", userLon.toString());
    }
    const url = `${API_BASE}/providers${params.toString() ? `?${params}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { providers?: any[] };
    if (!Array.isArray(data.providers)) return [];
    // Backend already computed distance and filtered by service radius when lat/lng provided
    return data.providers.map((r) => mapProviderRow(r, userLat, userLon));
  } catch {
    return [];
  }
}

async function apiFetchProviderById(id: string): Promise<Provider | null> {
  try {
    const res = await fetch(`${API_BASE}/providers/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { provider?: any };
    return data.provider ? mapProviderRow(data.provider) : null;
  } catch {
    return null;
  }
}

export async function apiPostProvider(provider: Provider): Promise<{ ok: boolean; error?: string }> {
  const doFetch = () =>
    fetch(`${API_BASE}/providers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(provider),
    });

  let lastErr = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await doFetch();
      if (res.ok) return { ok: true };
      lastErr = `HTTP ${res.status}`;
    } catch (err: any) {
      lastErr = err?.message ?? "Network error";
    }
    if (attempt === 1) {
      console.warn(`[apiPostProvider] attempt 1 failed (${lastErr}), retrying in 2 s…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.warn(`[apiPostProvider] failed after 2 attempts — API_BASE=${API_BASE} error=${lastErr}`);
  return { ok: false, error: lastErr };
}

// ─── Providers ────────────────────────────────────────────────────────────────

export async function fetchProviders(
  category?: string | null,
  userLat?: number,
  userLon?: number,
): Promise<Provider[]> {
  const [localProviders, apiProviders, supabaseResult] = await Promise.all([
    getLocalProviders(),
    apiFetchProviders(category, userLat, userLon),
    (async () => {
      let query = supabase
        .from("providers")
        .select("*, profiles(avatar_url)")
        .eq("verified", true)
        .order("rating", { ascending: false });
      if (category) query = query.eq("category", category);
      return query;
    })(),
  ]);

  const hasLocation = userLat != null && userLon != null;

  // Helper: apply distance + strict service-radius filter to any provider list.
  // Minimum effective radius is always 50 km (matches UI minimum and API server clamp).
  function withDistAndRadiusFilter<T extends Provider>(list: T[]): T[] {
    return list
      .map((p) => ({
        ...p,
        distance: hasLocation && p.latitude && p.longitude
          ? calculateDistance(userLat!, userLon!, p.latitude, p.longitude)
          : p.distance,
      }))
      .filter((p) => !hasLocation || p.distance <= Math.max(p.serviceRadius ?? 50, 50));
  }

  const localFiltered = category
    ? localProviders.filter((p) => p.category === category)
    : localProviders;

  const localWithDist = withDistAndRadiusFilter(localFiltered);

  // API server is the primary shared source (already radius-filtered server-side when lat/lng provided).
  // For Supabase/mock fallbacks we apply radius filtering here on the client.
  let remoteProviders: Provider[];
  if (apiProviders.length > 0) {
    // API already filtered by radius — no need to re-filter, just take as-is.
    remoteProviders = apiProviders;
    if (!supabaseResult.error && supabaseResult.data && supabaseResult.data.length > 0) {
      const sbIds = new Set(apiProviders.map((p) => p.id));
      const sbExtra = withDistAndRadiusFilter(
        supabaseResult.data
          .filter((r: any) => !r.blocked && !r.suspended)
          .map((r) => mapProviderRow(r, userLat, userLon))
          .filter((p) => !sbIds.has(p.id)),
      );
      remoteProviders = [...remoteProviders, ...sbExtra];
    }
  } else if (!supabaseResult.error && supabaseResult.data && supabaseResult.data.length > 0) {
    remoteProviders = withDistAndRadiusFilter(
      supabaseResult.data
        .filter((r: any) => !r.blocked && !r.suspended)
        .map((r) => mapProviderRow(r, userLat, userLon)),
    );
  } else {
    remoteProviders = withDistAndRadiusFilter(
      MOCK_PROVIDERS
        .filter((p) => !category || p.category === category)
        .map((p) => mapProviderRow(p, userLat, userLon)),
    );
  }

  // Local (device-only) providers first, then remote sorted by distance
  const remoteIds = new Set(remoteProviders.map((p) => p.id));
  const uniqueLocal = localWithDist.filter((p) => !remoteIds.has(p.id));
  const all = [...uniqueLocal, ...remoteProviders];

  if (hasLocation) all.sort((a, b) => a.distance - b.distance);

  // Deduplicate by phone number — same provider may appear from both API server and Supabase
  const seenPhones = new Set<string>();
  const deduped = all.filter((p) => {
    if (!p.phone) return true;
    if (seenPhones.has(p.phone)) return false;
    seenPhones.add(p.phone);
    return true;
  });

  return deduped;
}

export async function fetchProviderById(id: string): Promise<Provider | null> {
  // Run all sources in parallel
  const [localProviders, apiProvider, supabaseResult] = await Promise.all([
    getLocalProviders(),
    apiFetchProviderById(id),
    supabase.from("providers").select("*").eq("id", id).single(),
  ]);

  // Priority: API server > Supabase > local > mock
  let provider: Provider | null = null;
  if (apiProvider) {
    const sbRow = !supabaseResult.error ? supabaseResult.data : null;
    provider = {
      ...apiProvider,
      subcategory: apiProvider.subcategory || sbRow?.subcategory || undefined,
      workingHours: apiProvider.workingHours?.trim()
        ? apiProvider.workingHours
        : (sbRow?.working_hours ?? sbRow?.workingHours ?? ""),
      serviceArea: apiProvider.serviceArea?.trim()
        ? apiProvider.serviceArea
        : (apiProvider.workingHours?.trim()
          ? apiProvider.workingHours
          : (sbRow?.service_area ?? sbRow?.serviceArea ?? sbRow?.working_hours ?? sbRow?.workingHours ?? undefined)),
      description: apiProvider.description?.trim()
        ? apiProvider.description
        : (sbRow?.description ?? apiProvider.description),
      services: apiProvider.services?.length
        ? apiProvider.services
        : (sbRow?.services ?? apiProvider.services),
    };
  } else if (!supabaseResult.error && supabaseResult.data) provider = mapProviderRow(supabaseResult.data);
  else {
    const localMatch = localProviders.find((p) => p.id === id);
    provider = localMatch ?? MOCK_PROVIDERS.find((p) => p.id === id) ?? null;
  }

  // Gap #3 fix: always fetch profiles.avatar_url — it is the single source of truth for avatars
  if (provider && provider.userId) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", provider.userId)
        .maybeSingle();
      if (profile?.avatar_url) {
        provider = { ...provider, avatarUrl: profile.avatar_url };
      }
    } catch {
      // non-fatal
    }
  }

  return provider;
}

export async function searchProviders(
  query: string,
  userLat?: number,
  userLon?: number,
): Promise<Provider[]> {
  const hasLocation = userLat != null && userLon != null;
  const localProviders = await getLocalProviders();
  const q = query.toLowerCase();

  // Helper: compute distance and apply strict service-radius filter.
  // Minimum effective radius is always 50 km (matches UI minimum and API server clamp).
  function withDistAndRadiusFilter<T extends Provider>(list: T[]): T[] {
    return list
      .map((p) => ({
        ...p,
        distance: hasLocation && p.latitude && p.longitude
          ? calculateDistance(userLat!, userLon!, p.latitude, p.longitude)
          : p.distance,
      }))
      .filter((p) => !hasLocation || p.distance <= Math.max(p.serviceRadius ?? 50, 50));
  }

  const localMatched = withDistAndRadiusFilter(
    localProviders.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory ?? "").toLowerCase().includes(q),
    ),
  );

  const { data, error } = await supabase
    .from("providers")
    .select("*")
    .eq("verified", true)
    .or(`category.ilike.%${query}%,name.ilike.%${query}%,subcategory.ilike.%${query}%`)
    .order("rating", { ascending: false });

  let remoteResults: Provider[];
  if (error || !data) {
    remoteResults = withDistAndRadiusFilter(
      MOCK_PROVIDERS
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q),
        )
        .map((p) => mapProviderRow(p, userLat, userLon)),
    );
  } else {
    remoteResults = withDistAndRadiusFilter(
      data
        .filter((r: any) => !r.blocked && !r.suspended)
        .map((r) => mapProviderRow(r, userLat, userLon)),
    );
  }

  const remoteIds = new Set(remoteResults.map((p) => p.id));
  const uniqueLocal = localMatched.filter((p) => !remoteIds.has(p.id));
  const all = [...uniqueLocal, ...remoteResults];
  if (hasLocation) all.sort((a, b) => a.distance - b.distance);

  // Deduplicate by phone number — same provider may appear from multiple sources
  const seenPhones = new Set<string>();
  return all.filter((p) => {
    if (!p.phone) return true;
    if (seenPhones.has(p.phone)) return false;
    seenPhones.add(p.phone);
    return true;
  });
}

export async function registerProvider(
  userId: string,
  providerData: {
    name: string;
    phone: string;
    category: string;
    subcategory?: string;
    experience: number;
    description: string;
    serviceRadius: number;
    workingHours?: string;
    serviceArea?: string;
    serviceCharge?: string;
    initials: string;
    avatarColor: string;
    services: string[];
    location: string;
    latitude: number;
    longitude: number;
  },
): Promise<{ success: boolean; error?: string; providerId?: string }> {
  // UPSERT by id — use a stable, deterministic text id ("sb-<userId>") so that:
  //  1. The NOT NULL constraint on providers.id is always satisfied (no DB DEFAULT needed).
  //  2. onConflict: "id" (primary key) always works — no separate UNIQUE index required.
  //  3. Re-registering the same provider updates the existing row rather than inserting a new one.
  const stableId = `sb-${userId}`;
  const { data, error } = await supabase
    .from("providers")
    .upsert(
      {
        id:            stableId,
        user_id:       userId,
        name:          providerData.name,
        phone:         providerData.phone,
        category:      providerData.category,
        subcategory:   providerData.subcategory,
        experience:    providerData.experience,
        description:   providerData.description,
        service_radius: providerData.serviceRadius,
        // Prefer serviceArea when provided; DB column is working_hours (no service_area column).
        working_hours:  providerData.serviceArea ?? providerData.workingHours ?? "",
        service_charge: providerData.serviceCharge,
        initials:      providerData.initials,
        avatar_color:  providerData.avatarColor,
        services:      providerData.services,
        location:      providerData.location,
        latitude:      providerData.latitude,
        longitude:     providerData.longitude,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  return { success: true, providerId: data?.id };
}

export async function fetchProviderByPhone(phone: string): Promise<Provider | null> {
  const normalized = phone.replace(/\D/g, "").replace(/^91/, "").slice(-10);
  if (normalized.length < 10) return null;
  try {
    const res = await fetch(`${API_BASE}/providers/by-phone/${encodeURIComponent(normalized)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { provider?: any; exists?: boolean };
    return data.exists && data.provider ? mapProviderRow(data.provider) : null;
  } catch {
    return null;
  }
}

export async function updateProviderAvailability(
  userId: string,
  available: boolean,
): Promise<void> {
  await supabase.from("providers").update({ available }).eq("user_id", userId);
}

export async function fetchProviderProfile(userId: string): Promise<Provider | null> {
  // Fetch the provider row + avatar.  The profiles(avatar_url) embedded join works
  // because providers.user_id has an FK to profiles.id.
  const { data, error } = await supabase
    .from("providers")
    .select("*, profiles(avatar_url)")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;

  // Fetch reviews separately — there is no FK from providers → reviews in the DB
  // schema, so PostgREST rejects any embedded join with PGRST200.
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("provider_id", data.id);

  // Batch-fetch reviewer avatars so the dashboard review cards show profile
  // photos instead of initials.  reviews.reviewer_id → profiles.id.
  const reviewerIds = (reviews ?? [])
    .map((r: any) => r.reviewer_id as string | null)
    .filter((id): id is string => !!id);

  let avatarMap: Record<string, string | null> = {};
  if (reviewerIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", reviewerIds);
    avatarMap = Object.fromEntries(
      (profileRows ?? []).map((p: any) => [p.id as string, (p.avatar_url as string | null) ?? null]),
    );
  }

  // Stitch a `profiles` object onto each review row so that mapProviderRow's
  // existing `(r.profiles as any)?.avatar_url` path picks up the avatar.
  const reviewsWithAvatars = (reviews ?? []).map((r: any) => ({
    ...r,
    profiles: { avatar_url: avatarMap[r.reviewer_id as string] ?? null },
  }));

  return mapProviderRow({ ...data, reviews: reviewsWithAvatars });
}

// ─── Incoming Bookings ────────────────────────────────────────────────────────

export async function fetchIncomingBookings(providerUserId: string): Promise<BookingRequest[]> {
  // Find the provider record for this user
  const { data: providerRow } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", providerUserId)
    .single();

  if (!providerRow) return MOCK_BOOKING_REQUESTS;

  // Get all conversations for this provider.
  // conversations.provider_id stores the raw auth UUID (providers.user_id),
  // not the "sb-{uuid}" record ID — use providerUserId directly.
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, customer_id")
    .eq("provider_id", providerUserId);

  if (!convs || convs.length === 0) return MOCK_BOOKING_REQUESTS;

  const convIds = convs.map((c: any) => c.id);
  const customerIds = [...new Set(convs.map((c: any) => c.customer_id as string))];

  // Fetch booking-type messages in those conversations
  const { data: msgs } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", convIds)
    .eq("type", "booking")
    .order("created_at", { ascending: false });

  if (!msgs || msgs.length === 0) return MOCK_BOOKING_REQUESTS;

  // Fetch customer profiles (include avatar_color for future customer colour-picker support)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url, avatar_color")
    .in("id", customerIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  const convCustomerMap = Object.fromEntries(convs.map((c: any) => [c.id, c.customer_id]));

  return msgs.map((msg: any) => {
    const customerId = convCustomerMap[msg.conversation_id];
    const profile = profileMap[customerId] ?? { name: "Customer", id: customerId };
    const initials = (profile.name as string)
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    // Use the stored profile color if set (non-default); otherwise derive a consistent
    // colour from the customer UUID so every customer has a distinct visual identity.
    const DEFAULT_PROFILE_COLOR = "#64748B";
    const dbColor = (profile as any).avatar_color as string | undefined;
    const derivedColor = AVATAR_COLORS[customerId.charCodeAt(0) % AVATAR_COLORS.length];
    const customerAvatarColor = (dbColor && dbColor !== DEFAULT_PROFILE_COLOR) ? dbColor : derivedColor;
    const booking = msg.booking_data ?? {};
    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      customerId,
      customerName: profile.name,
      customerInitials: initials,
      customerAvatarColor,
      customerAvatarUrl: (profile as any).avatar_url ?? null,
      service: booking.service ?? "Service",
      date: booking.date ?? "",
      time: booking.time ?? "",
      amount: booking.amount ?? "To be confirmed",
      status: ((msg.booking_status ?? "pending") as BookingStatus),
      createdAt: msg.created_at,
    };
  });
}

// Single source of truth for avatar/profile colours used across the app.
// register-provider.tsx imports this; do not define a second copy elsewhere.
export const AVATAR_COLORS = ["#2563EB", "#F59E0B", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#EF4444", "#06B6D4"];

export async function fetchProviderStats(providerUserId: string): Promise<ProviderStats> {
  const { data: providerRow } = await supabase
    .from("providers")
    .select("id, rating, review_count")
    .eq("user_id", providerUserId)
    .single();

  if (!providerRow) {
    return { pendingCount: 3, acceptedCount: 2, completedCount: 8, weeklyEarnings: "₹4,200", rating: 0, reviewCount: 0 };
  }

  // conversations.provider_id stores the raw auth UUID (providers.user_id),
  // not the "sb-{uuid}" record ID — use providerUserId directly.
  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .eq("provider_id", providerUserId);

  const convIds = (convs ?? []).map((c: any) => c.id);
  let pendingCount = 0;
  let acceptedCount = 0;
  let completedCount = 0;

  if (convIds.length > 0) {
    const [pendingRes, acceptedRes, completedRes] = await Promise.all([
      supabase
        .from("messages")
        .select("id", { count: "exact" })
        .in("conversation_id", convIds)
        .eq("type", "booking")
        .or("booking_status.is.null,booking_status.eq.pending"),
      supabase
        .from("messages")
        .select("id", { count: "exact" })
        .in("conversation_id", convIds)
        .eq("type", "booking")
        .eq("booking_status", "accepted"),
      supabase
        .from("messages")
        .select("id", { count: "exact" })
        .in("conversation_id", convIds)
        .eq("type", "booking")
        .or("booking_status.eq.completed,booking_status.eq.customer_confirmed_completed"),
    ]);
    pendingCount = pendingRes.count ?? 0;
    acceptedCount = acceptedRes.count ?? 0;
    completedCount = completedRes.count ?? 0;
  }

  return {
    pendingCount,
    acceptedCount,
    completedCount,
    weeklyEarnings: "₹0",
    rating: providerRow.rating ?? 0,
    reviewCount: providerRow.review_count ?? 0,
  };
}

// ─── Booking Status ────────────────────────────────────────────────────────────

export async function updateBookingStatus(
  messageId: string,
  status: "accepted" | "declined" | "provider_completed" | "customer_confirmed_completed" | "disputed",
): Promise<void> {
  const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(messageId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `updateBookingStatus failed (${res.status}): ${(body as any).error ?? res.statusText}`,
    );
  }
}

// ─── Earnings ─────────────────────────────────────────────────────────────────

export interface EarningsSummary {
  totalEarnings: number;
  monthlyEarnings: number;
  weeklyEarnings: number;
  count: number;
}

export async function fetchEarningsSummary(userId: string): Promise<EarningsSummary> {
  try {
    const res = await fetch(`${API_BASE}/providers/${encodeURIComponent(userId)}/earnings`);
    if (!res.ok) return { totalEarnings: 0, monthlyEarnings: 0, weeklyEarnings: 0, count: 0 };
    const data = (await res.json()) as { summary?: EarningsSummary };
    return data.summary ?? { totalEarnings: 0, monthlyEarnings: 0, weeklyEarnings: 0, count: 0 };
  } catch {
    return { totalEarnings: 0, monthlyEarnings: 0, weeklyEarnings: 0, count: 0 };
  }
}

export async function recordEarning(opts: {
  bookingId: string;
  providerId: string;
  amount: number;
  service: string;
  customerName: string;
  customerInitials: string;
  customerAvatarColor: string;
  customerAvatarUrl?: string | null;
  conversationId: string;
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/earnings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch { /* non-fatal — earnings are best-effort */ }
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function submitReview(
  providerId: string,
  reviewerId: string,
  reviewerName: string,
  rating: number,
  comment: string,
): Promise<{ success: boolean; error?: string }> {
  // Primary: POST /api/providers/:id/reviews (API server with service role key)
  // This route lives in providers.ts so it is available on any Hostinger deployment.
  try {
    const res = await fetch(`${API_BASE}/providers/${encodeURIComponent(providerId)}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewerId, reviewerName, rating, comment }),
    });
    // If the server returns HTML (e.g. 404 page from old deploy), the JSON parse will fail.
    // Detect it explicitly and fall through to the Supabase fallback.
    const text = await res.text();
    if (text.trimStart().startsWith("<")) {
      throw new Error("html_response");
    }
    const data = JSON.parse(text) as { success?: boolean; error?: string };
    if (!res.ok || !data.success) return { success: false, error: data.error ?? "Failed to submit review" };
    return { success: true };
  } catch (e: any) {
    if (e?.message !== "html_response") {
      // Real network error — don't silently fall through
    }
  }

  // Fallback: insert directly into Supabase (works when API server is outdated)
  // Check for duplicate first
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("provider_id", providerId)
    .eq("reviewer_id", reviewerId)
    .maybeSingle();
  if (existingReview) return { success: false, error: "You have already reviewed this provider." };

  const initials = reviewerName
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const { error } = await supabase.from("reviews").insert({
    provider_id: providerId,
    reviewer_id: reviewerId,
    reviewer_name: reviewerName,
    reviewer_initials: initials,
    rating,
    comment: comment ?? "",
  });
  if (error) return { success: false, error: error.message };

  // Recalculate rating and review_count on the provider row
  const { data: allReviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("provider_id", providerId);
  if (allReviews && allReviews.length > 0) {
    const avg = allReviews.reduce((sum, r: any) => sum + (r.rating ?? 0), 0) / allReviews.length;
    await supabase
      .from("providers")
      .update({ rating: parseFloat(avg.toFixed(1)), review_count: allReviews.length })
      .eq("id", providerId);
  }

  return { success: true };
}

// Marks the review_request chat message as submitted via the API server.
// The API uses the service-role key to bypass RLS — the review_request message
// is sent by the provider so the customer (who submits the review) cannot
// update it directly through Supabase client. Non-fatal: best-effort only.
export async function markReviewRequestSubmitted(convId: string, msgId: string): Promise<void> {
  try {
    await fetch(
      `${API_BASE}/conversations/${encodeURIComponent(convId)}/messages/${encodeURIComponent(msgId)}/review-submitted`,
      { method: "PATCH" },
    );
  } catch { /* non-fatal */ }
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function fetchConversations(userId: string, _providerId?: string): Promise<Conversation[]> {
  try {
    const res = await fetch(`${API_BASE}/conversations?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { conversations?: Conversation[] };
    return data.conversations ?? [];
  } catch {
    return [];
  }
}

export class SubscriptionInactiveError extends Error {
  readonly code = "SUBSCRIPTION_INACTIVE";
  constructor(msg = "Provider subscription has expired") {
    super(msg);
    this.name = "SubscriptionInactiveError";
  }
}

export async function getOrCreateConversation(
  customerId: string,
  providerId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/conversations/get-or-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, providerId }),
    });
    if (res.status === 403) {
      const body = await res.json().catch(() => ({})) as any;
      if (body?.code === "SUBSCRIPTION_INACTIVE") throw new SubscriptionInactiveError(body.error);
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { conversationId?: string };
    return data.conversationId ?? null;
  } catch (e) {
    if (e instanceof SubscriptionInactiveError) throw e;
    return null;
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`);
    if (!res.ok) return [];
    const data = (await res.json()) as { messages?: ChatMessage[] };
    return data.messages ?? [];
  } catch {
    return [];
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  type: "text" | "booking" | "work_completed" | "review_request" = "text",
  bookingData?: ChatMessage["booking"] | ChatMessage["workCompleted"],
): Promise<ChatMessage | null> {
  try {
    const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId, text, type, bookingData: bookingData ?? null }),
    });
    if (res.status === 403) {
      const body = await res.json().catch(() => ({})) as any;
      if (body?.code === "SUBSCRIPTION_INACTIVE") throw new SubscriptionInactiveError(body.error);
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: ChatMessage };
    return data.message ?? null;
  } catch (e) {
    if (e instanceof SubscriptionInactiveError) throw e;
    return null;
  }
}

export function subscribeToMessages(
  conversationId: string,
  onMessage: (msg: ChatMessage) => void,
  onBookingStatusChange?: (messageId: string, status: string) => void,
) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as any;
        const isWorkCompleted = row.type === "work_completed";
        onMessage({
          id: row.id,
          senderId: row.sender_id,
          text: row.text,
          timestamp: row.created_at,
          read: row.read,
          type: row.type,
          booking: (!isWorkCompleted && row.booking_data)
            ? { ...row.booking_data, status: row.booking_status ?? undefined }
            : undefined,
          workCompleted: (isWorkCompleted && row.booking_data)
            ? row.booking_data
            : undefined,
        });
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as any;
        if (row.booking_status && onBookingStatusChange) {
          onBookingStatusChange(row.id as string, row.booking_status as string);
        }
      },
    )
    .subscribe();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function fetchProfileAvatar(userId: string): Promise<string | null> {
  if (!supabase || !userId) return null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    return data?.avatar_url ?? null;
  } catch {
    return null;
  }
}

function mapProviderRow(row: any, userLat?: number, userLon?: number): Provider {
  const provLat = row.latitude ?? 23.8315;
  const provLon = row.longitude ?? 91.2868;
  const dist = userLat != null && userLon != null
    ? calculateDistance(userLat, userLon, provLat, provLon)
    : 0;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    subcategory: row.subcategory ?? undefined,
    rating: row.rating ?? 0,
    reviewCount: row.review_count ?? row.reviews?.length ?? 0,
    distance: dist,
    available: row.available ?? true,
    experience: row.experience ?? 0,
    description: row.description ?? "",
    phone: row.phone ?? "",
    location: row.location ?? "",
    serviceArea: row.service_area ?? row.serviceArea ?? row.working_hours ?? row.workingHours ?? undefined,
    serviceRadius: row.service_radius ?? row.serviceRadius ?? 50,
    serviceCharge: row.service_charge,
    workingHours: row.working_hours ?? row.workingHours ?? "",
    latitude: row.latitude ?? 12.9352,
    longitude: row.longitude ?? 77.6245,
    verified: row.verified ?? false,
    initials: row.initials ?? (row.name
      ? String(row.name).split(" ").map((w: string) => w[0] ?? "").join("").toUpperCase().slice(0, 2) || "PR"
      : "PR"),
    // Read both camelCase (API server response) and snake_case (raw Supabase row)
    avatarColor: row.avatar_color ?? row.avatarColor ?? "#64748B",
    avatarUrl: row.avatarUrl ?? (Array.isArray(row.profiles) ? row.profiles[0]?.avatar_url : row.profiles?.avatar_url) ?? row.avatar_url ?? null,
    services: row.services ?? [],
    reviews: (row.reviews ?? []).map((r: any) => ({
      id: r.id,
      // API server returns camelCase (reviewerName); raw Supabase rows use snake_case
      // (reviewer_name). Read both so this works regardless of which source provides reviews.
      reviewerName:     r.reviewerName     ?? r.reviewer_name     ?? "Anonymous",
      reviewerInitials: r.reviewerInitials ?? r.reviewer_initials ??
        (r.reviewerName ?? r.reviewer_name ?? "?")[0].toUpperCase(),
      rating:  r.rating  ?? 0,
      comment: r.comment ?? "",
      // API stores the date as `date` (ISO string); raw Supabase rows use `created_at`.
      date: formatMessageTime(r.date ?? r.created_at),
      // avatarUrl is camelCase in both the API response and the Supabase join result
      avatarUrl: r.avatarUrl ?? (r.profiles as any)?.avatar_url ?? null,
    })),
  };
}

function formatMessageTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

// ─── Provider Activity ─────────────────────────────────────────────────────────

export async function recordActivity(
  providerId: string,
  customerId: string | null,
  eventType: "view" | "call" | "whatsapp",
  platform: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/providers/${encodeURIComponent(providerId)}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId ?? undefined,
        event_type: eventType,
        platform,
      }),
    });
  } catch {
    // silently swallow — never block user
  }
}

export interface ActivitySummary {
  views: number;
  calls: number;
  whatsapp: number;
}

export async function fetchProviderActivitySummary(
  providerId: string,
): Promise<ActivitySummary> {
  try {
    const res = await fetch(
      `${API_BASE}/providers/${encodeURIComponent(providerId)}/activity`,
    );
    if (!res.ok) return { views: 0, calls: 0, whatsapp: 0 };
    return (await res.json()) as ActivitySummary;
  } catch {
    return { views: 0, calls: 0, whatsapp: 0 };
  }
}
