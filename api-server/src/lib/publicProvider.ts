/**
 * Public provider profile helpers — additive only.
 * Sanitizes provider records for web share pages and OG previews.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type PublicProviderUnavailableReason =
  | "not_found"
  | "blocked"
  | "suspended"
  | "unverified"
  | "inactive"
  | "expired";

export interface PublicProviderDTO {
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
  /** Absolute action URLs — never expose raw phone in the public JSON. */
  contact: {
    callPath: string;
    whatsappPath: string;
  };
  /** Reserved for portfolio, certificates, badges, featured flags, etc. */
  extensions: Record<string, unknown>;
  shareUrl: string;
  profilePath: string;
}

function websiteBase(): string {
  try {
    const f = resolve(__dirname, "../../data/settings.json");
    if (existsSync(f)) {
      const s = JSON.parse(readFileSync(f, "utf-8")) as { websiteUrl?: string };
      if (s.websiteUrl) return s.websiteUrl.replace(/\/$/, "");
    }
  } catch {
    /* fall through */
  }
  return "https://skillad.in";
}

function apiPublicBase(): string {
  return (process.env["PUBLIC_API_URL"] || process.env["API_PUBLIC_URL"] || "https://api.skillad.in").replace(
    /\/$/,
    "",
  );
}

export function isSubscriptionExpired(p: any): boolean {
  if (p?.subscriptionActive === false) return true;
  if (p?.subscriptionEndDate && new Date(p.subscriptionEndDate as string) <= new Date()) return true;
  return false;
}

/** Why a provider must not appear on the public web profile. */
export function getPublicUnavailability(p: any | null | undefined): PublicProviderUnavailableReason | null {
  if (!p) return "not_found";
  if (p.deleted === true || p.isDeleted === true || p.status === "deleted") return "not_found";
  if (p.blocked === true) return "blocked";
  if (p.suspended === true || p.status === "suspended") return "suspended";
  if (p.verified !== true) return "unverified";
  if (isSubscriptionExpired(p)) return "expired";
  if (p.available === false || p.status === "inactive") return "inactive";
  return null;
}

function extractCity(location: string): string {
  if (!location) return "";
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] ?? location;
}

function normalizePhoneDigits(raw: string): string {
  return (raw ?? "").toString().replace(/\D/g, "").replace(/^91/, "").slice(-10);
}

export function providerHasContactPhone(p: any): boolean {
  return normalizePhoneDigits(p?.phone ?? "").length === 10;
}

export function getProviderPhoneDigits(p: any): string | null {
  const d = normalizePhoneDigits(p?.phone ?? "");
  return d.length === 10 ? d : null;
}

/**
 * Build a public-safe DTO. Call only after getPublicUnavailability() === null.
 * Never includes email, OTP, subscription, admin, payment, or raw phone.
 */
export function toPublicProviderDTO(p: any): PublicProviderDTO {
  const id = String(p.id);
  const hasPhone = providerHasContactPhone(p);
  const site = websiteBase();
  const api = apiPublicBase();

  const languages: string[] = Array.isArray(p.languages)
    ? p.languages.filter((x: unknown) => typeof x === "string")
    : typeof p.languages === "string" && p.languages.trim()
      ? p.languages.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

  const services: string[] = Array.isArray(p.services)
    ? p.services.filter((x: unknown) => typeof x === "string")
    : [];

  // Future-ready bag — only copy explicitly public extension keys if present
  const extensions: Record<string, unknown> = {};
  if (p.extensions && typeof p.extensions === "object") {
    const allowed = ["portfolio", "certificates", "badges", "featured", "gallery"] as const;
    for (const key of allowed) {
      if (key in p.extensions) extensions[key] = (p.extensions as any)[key];
    }
  }
  if (p.featured === true) extensions.featured = true;
  if (Array.isArray(p.portfolio)) extensions.portfolio = p.portfolio;
  if (Array.isArray(p.certificates)) extensions.certificates = p.certificates;
  if (Array.isArray(p.badges)) extensions.badges = p.badges;

  return {
    id,
    name: String(p.name ?? "Provider"),
    category: String(p.category ?? ""),
    subcategory: p.subcategory ? String(p.subcategory) : null,
    rating: typeof p.rating === "number" ? p.rating : 0,
    reviewCount: typeof p.reviewCount === "number" ? p.reviewCount : 0,
    experience: typeof p.experience === "number" ? p.experience : 0,
    description: String(p.description ?? ""),
    location: String(p.location ?? ""),
    city: extractCity(String(p.location ?? "")),
    serviceArea: String(p.serviceArea ?? p.workingHours ?? ""),
    serviceRadius: typeof p.serviceRadius === "number" ? p.serviceRadius : 50,
    available: p.available !== false,
    verified: p.verified === true,
    languages,
    services,
    avatarUrl: p.avatarUrl ?? null,
    initials: String(p.initials ?? "PR"),
    avatarColor: String(p.avatarColor ?? "#64748B"),
    memberSince: p.registeredAt ? String(p.registeredAt) : p.created_at ? String(p.created_at) : null,
    responseTime: p.responseTime ? String(p.responseTime) : null,
    workingHours: String(p.workingHours ?? ""),
    canCall: hasPhone,
    canWhatsApp: hasPhone,
    contact: {
      callPath: `${api}/api/providers/${encodeURIComponent(id)}/contact/call`,
      whatsappPath: `${api}/api/providers/${encodeURIComponent(id)}/contact/whatsapp`,
    },
    extensions,
    shareUrl: `${site}/provider/${encodeURIComponent(id)}`,
    profilePath: `/provider/${encodeURIComponent(id)}`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProviderOgHtml(opts: {
  provider: PublicProviderDTO | null;
  unavailable?: boolean;
}): string {
  const site = websiteBase();
  const icon = `${site}/icon.png`;

  if (!opts.provider || opts.unavailable) {
    const title = "Provider unavailable | SkillAd";
    const desc = "This provider is no longer available. Explore thousands of verified professionals on SkillAd.";
    const url = `${site}/`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <meta name="robots" content="noindex" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SkillAd" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:image" content="${escapeHtml(icon)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${escapeHtml(icon)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />
</head>
<body>
  <p>${escapeHtml(desc)}</p>
  <p><a href="${escapeHtml(site)}">Open SkillAd</a></p>
</body>
</html>`;
  }

  const p = opts.provider;
  const city = p.city || p.location || "India";
  const title = `${p.name} – ${p.category} in ${city} | SkillAd`;
  const desc = `Find verified ${p.category} ${p.name} in ${city}. View experience, ratings, service area and contact through SkillAd.`;
  const image = p.avatarUrl && /^https?:\/\//i.test(p.avatarUrl) ? p.avatarUrl : icon;
  const url = p.shareUrl;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: p.name,
    description: p.description || desc,
    image,
    url,
    address: {
      "@type": "PostalAddress",
      addressLocality: city,
      addressCountry: "IN",
    },
    aggregateRating:
      p.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: p.rating,
            reviewCount: p.reviewCount,
          }
        : undefined,
    areaServed: p.serviceArea || city,
    provider: {
      "@type": "Organization",
      name: "SkillAd",
      url: site,
      logo: icon,
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escapeHtml(url)}" />

  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="SkillAd" />
  <meta property="og:title" content="${escapeHtml(`${p.name} · ${p.category}`)}" />
  <meta property="og:description" content="${escapeHtml(`${p.category} in ${city} · Verified on SkillAd`)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:alt" content="${escapeHtml(p.name)}" />
  <meta property="og:locale" content="en_IN" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(`${p.name} · ${p.category}`)}" />
  <meta name="twitter:description" content="${escapeHtml(`${city} · Verified on SkillAd`)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <meta name="theme-color" content="#ff6b2c" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <main>
    <h1>${escapeHtml(p.name)}</h1>
    <p>${escapeHtml(p.category)}</p>
    <p>${escapeHtml(city)}</p>
    <p>Verified on SkillAd</p>
    <p><a href="${escapeHtml(url)}">View full profile</a></p>
  </main>
</body>
</html>`;
}

export function isSocialCrawler(ua: string | undefined): boolean {
  if (!ua) return false;
  return /(WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot|Baiduspider|DuckDuckBot|Slurp)/i.test(
    ua,
  );
}
