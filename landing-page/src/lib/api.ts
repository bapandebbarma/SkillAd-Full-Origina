declare const __API_BASE__: string;

/**
 * Production (Vite build): __API_BASE__ = "https://api.skillad.in"
 *   → apiUrl("/api/stats") = "https://api.skillad.in/api/stats"
 * Dev (vite serve): __API_BASE__ = ""
 *   → apiUrl("/api/stats") = "/api/stats" (proxied to localhost:3000)
 */
function resolveApiOrigin(): string {
  const raw =
    typeof __API_BASE__ !== "undefined" && __API_BASE__
      ? String(__API_BASE__).trim()
      : "";
  if (!raw) return "";
  return raw.replace(/\/$/, "").replace(/\/api$/i, "");
}

export const API_ORIGIN: string = resolveApiOrigin();

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_ORIGIN + p;
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), init);
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export interface PlatformStats {
  workers: number;
  services: number;
  cities: number;
  users: number;
  providers?: number;
  customers?: number;
  bookings?: number;
  categories?: number;
  averageRating?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  active?: boolean;
  searchCount?: number;
  providerCount?: number;
  subcategories?: string[];
}

export interface AppSettings {
  playStoreLink: string;
  appStoreLink: string;
  supportEmail: string;
  supportPhone: string;
  enabledLanguages: string[];
  websiteUrl: string;
  socialFacebook?: string;
  socialInstagram?: string;
  socialTwitter?: string;
  socialYoutube?: string;
  socialLinkedin?: string;
  officeAddress?: string;
  appName?: string;
  defaultCity?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FeatureCard {
  id: string;
  title: string;
  description: string;
}

export interface HowItWorksStep {
  id: string;
  title: string;
  description: string;
}

export interface AppScreenshot {
  id: string;
  label: string;
  url: string;
}

export interface LandingContent {
  heroHeading?: string;
  heroSubtitle?: string;
  heroAnnouncement?: string;
  uspTitle?: string;
  uspSubtitle?: string;
  providerCtaTitle?: string;
  providerCtaSubtitle?: string;
  providerCtaPrimaryLabel?: string;
  providerCtaSecondaryLabel?: string;
  featureCards?: FeatureCard[];
  appScreenshots?: AppScreenshot[];
  howItWorks?: HowItWorksStep[];
}

export interface SiteContent {
  privacyPolicy?: string;
  termsOfService?: string;
  aboutUs?: string;
  helpCentre?: string;
  refundPolicy?: string;
  faqs?: FaqItem[];
  landing?: LandingContent;
  /** Some CMS payloads store screenshots at the content root instead of under landing. */
  appScreenshots?: AppScreenshot[];
  /** Legacy aliases some older payloads used */
  privacy?: string;
  terms?: string;
}

export interface CityCoverage {
  name: string;
  providerCount: number;
  categories: string[];
  categoryCount: number;
  latitude: number | null;
  longitude: number | null;
}

export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerInitials?: string;
  city?: string | null;
  providerName?: string | null;
  providerCategory?: string | null;
  createdAt?: string;
}

/** Platform reviews about SkillAd itself (not provider reviews). */
export interface AppReviewPublic {
  id: string;
  rating: number;
  text: string;
  suggestion?: string;
  displayName: string;
  city?: string;
  initials?: string;
  featured?: boolean;
  createdAt?: string;
}

export interface AppReviewStats {
  average: number;
  count: number;
  featured: number;
}

export interface LiveActivityItem {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  at: string;
}

export interface NearbyProvider {
  id: string;
  name: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  distance?: number;
  location?: string;
  avatarUrl?: string | null;
  initials?: string;
  avatarColor?: string;
  available?: boolean;
  experience?: number;
  verified?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name?: string;
  price?: number;
  durationDays?: number;
  [key: string]: unknown;
}

export async function fetchStats(): Promise<PlatformStats> {
  return getJson<PlatformStats>("/api/stats");
}

export async function fetchCategories(): Promise<Category[]> {
  const data = await getJson<{ categories: Category[] }>("/api/categories");
  return (data.categories ?? []).filter((c) => c.active !== false);
}

export async function fetchSettings(): Promise<AppSettings> {
  const d = await getJson<Partial<AppSettings>>("/api/settings");
  return {
    playStoreLink: d.playStoreLink ?? "",
    appStoreLink: d.appStoreLink ?? "",
    supportEmail: d.supportEmail ?? "",
    supportPhone: d.supportPhone ?? "",
    enabledLanguages: d.enabledLanguages ?? [],
    websiteUrl: d.websiteUrl ?? "",
    socialFacebook: d.socialFacebook ?? "",
    socialInstagram: d.socialInstagram ?? "",
    socialTwitter: d.socialTwitter ?? "",
    socialYoutube: d.socialYoutube ?? "",
    socialLinkedin: d.socialLinkedin ?? "",
    officeAddress: d.officeAddress ?? "",
    appName: d.appName ?? "SkillAd",
    defaultCity: d.defaultCity ?? "",
  };
}

export async function fetchContent(): Promise<SiteContent> {
  const data = await getJson<{ content?: SiteContent } & SiteContent>("/api/content", {
    cache: "no-store",
  });
  // API shape is { content: {...} }. Fall back if the payload is already unwrapped.
  const content = data.content ?? data;
  console.info("[fetchContent] raw /api/content payload", data);
  console.info("[fetchContent] resolved content keys", Object.keys(content ?? {}));
  console.info(
    "[fetchContent] screenshot paths",
    {
      "content.appScreenshots": Array.isArray(content.appScreenshots)
        ? content.appScreenshots.length
        : null,
      "content.landing.appScreenshots": Array.isArray(content.landing?.appScreenshots)
        ? content.landing!.appScreenshots!.length
        : null,
    },
  );

  const screenshots = resolveAppScreenshots(content);

  return {
    ...content,
    privacyPolicy: content.privacyPolicy ?? content.privacy,
    termsOfService: content.termsOfService ?? content.terms,
    faqs: Array.isArray(content.faqs) ? content.faqs : [],
    appScreenshots: screenshots,
    landing: {
      ...(content.landing ?? {}),
      // Keep a single canonical list under landing for section consumers.
      appScreenshots: screenshots,
    },
  };
}

/** Prefer landing.appScreenshots; also accept top-level content.appScreenshots. */
export function resolveAppScreenshots(content: SiteContent | null | undefined): AppScreenshot[] {
  const fromLanding = content?.landing?.appScreenshots;
  const fromRoot = content?.appScreenshots;
  const list = Array.isArray(fromLanding) && fromLanding.length > 0
    ? fromLanding
    : Array.isArray(fromRoot)
      ? fromRoot
      : Array.isArray(fromLanding)
        ? fromLanding
        : [];
  return list
    .map((s) => ({
      id: String(s?.id ?? ""),
      label: String(s?.label ?? "").trim(),
      url: String(s?.url ?? "").trim(),
    }))
    .filter((s) => s.url.length > 0);
}

export async function fetchCities(): Promise<CityCoverage[]> {
  const data = await getJson<{ cities: CityCoverage[] }>("/api/cities");
  return data.cities ?? [];
}

export async function fetchPublicReviews(limit = 12): Promise<PublicReview[]> {
  const data = await getJson<{ reviews: PublicReview[] }>(
    `/api/reviews/public?limit=${limit}`,
  );
  return data.reviews ?? [];
}

export async function fetchAppReviews(limit = 12, featuredOnly = false): Promise<AppReviewPublic[]> {
  const q = featuredOnly ? `&featured=1` : "";
  const data = await getJson<{ reviews: AppReviewPublic[] }>(
    `/api/app-reviews?limit=${limit}${q}`,
  );
  return data.reviews ?? [];
}

export async function fetchAppReviewStats(): Promise<AppReviewStats> {
  return getJson<AppReviewStats>("/api/app-reviews/stats");
}

export async function fetchLiveActivity(): Promise<LiveActivityItem[]> {
  const data = await getJson<{ items: LiveActivityItem[] }>("/api/activity/live");
  return data.items ?? [];
}

export async function fetchNearbyProviders(
  lat: number,
  lng: number,
): Promise<NearbyProvider[]> {
  const data = await getJson<{ providers: NearbyProvider[] }>(
    `/api/providers?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
  );
  return data.providers ?? [];
}

export async function fetchProvidersByCity(city: string): Promise<NearbyProvider[]> {
  const q = encodeURIComponent(city);
  const data = await getJson<{ providers: NearbyProvider[] }>(`/api/providers?city=${q}`);
  return data.providers ?? [];
}

/** Public web profile — sanitized; never includes phone/email/subscription. */
export interface PublicProviderProfile {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  rating: number;
  reviewCount: number;
  experience: number;
  description: string;
  location: string;
  city: string;
  serviceArea: string;
  serviceRadius: number;
  available: boolean;
  verified: boolean;
  languages: string[];
  services: string[];
  avatarUrl: string | null;
  initials: string;
  avatarColor: string;
  memberSince: string | null;
  responseTime: string | null;
  workingHours: string;
  canCall: boolean;
  canWhatsApp: boolean;
  contact: { callPath: string; whatsappPath: string };
  extensions: Record<string, unknown>;
  shareUrl: string;
  profilePath: string;
}

export async function fetchPublicProvider(
  id: string,
): Promise<{ available: true; provider: PublicProviderProfile } | { available: false; message?: string }> {
  const res = await fetch(apiUrl(`/api/providers/${encodeURIComponent(id)}/public`));
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as { available?: boolean }).available === false) {
    return {
      available: false,
      message: (data as { message?: string }).message ?? "This provider is no longer available.",
    };
  }
  return data as { available: true; provider: PublicProviderProfile };
}

export async function recordProviderWebActivity(
  providerId: string,
  eventType: "view" | "call" | "whatsapp" | "download",
): Promise<void> {
  try {
    await fetch(apiUrl(`/api/providers/${encodeURIComponent(providerId)}/activity`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType, platform: "web" }),
    });
  } catch {
    /* non-fatal */
  }
}

export async function fetchPlans(): Promise<SubscriptionPlan[]> {
  const data = await getJson<{ plans?: SubscriptionPlan[] } | SubscriptionPlan[]>(
    "/api/plans",
  );
  if (Array.isArray(data)) return data;
  return data.plans ?? [];
}

export async function submitContact(body: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  subject?: string;
  website?: string;
}): Promise<{ success: boolean; id?: string }> {
  const res = await fetch(apiUrl("/api/contact"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Failed to send message");
  }
  return data as { success: boolean; id?: string };
}

export function formatStat(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K+`;
  return `${n}+`;
}

export const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
export const ICON = `${BASE}/icon.png`;
