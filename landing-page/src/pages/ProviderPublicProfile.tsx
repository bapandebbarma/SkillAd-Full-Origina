import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import {
  BadgeCheck,
  Briefcase,
  Download,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Star,
} from "lucide-react";
import {
  ICON,
  fetchPublicProvider,
  fetchSettings,
  recordProviderWebActivity,
  type AppSettings,
  type PublicProviderProfile,
} from "@/lib/api";

function formatMemberSince(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
    });
  } catch {
    return "—";
  }
}

function openAppOrStore(settings: AppSettings, providerId: string) {
  const play = settings.playStoreLink?.trim();
  const appStore = settings.appStoreLink?.trim();
  const deepLink = `skillad://provider/${encodeURIComponent(providerId)}`;

  const fallback = play || appStore || "https://skillad.in/";
  const start = Date.now();
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = deepLink;
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    document.body.removeChild(iframe);
    if (Date.now() - start < 1600) {
      window.location.href = fallback;
    }
  }, 1200);
}

function ProviderAvatar({ provider }: { provider: PublicProviderProfile }) {
  const [err, setErr] = useState(false);
  if (provider.avatarUrl && !err) {
    return (
      <img
        src={provider.avatarUrl}
        alt={provider.name}
        loading="lazy"
        decoding="async"
        className="h-28 w-28 sm:h-32 sm:w-32 rounded-3xl object-cover ring-4 ring-white shadow-xl"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div
      className="h-28 w-28 sm:h-32 sm:w-32 rounded-3xl flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white shadow-xl"
      style={{ backgroundColor: provider.avatarColor || "#ff6b2c" }}
      aria-hidden
    >
      {provider.initials || "PR"}
    </div>
  );
}

function UnavailableState({
  message,
  settings,
}: {
  message: string;
  settings: AppSettings;
}) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
            <img src={ICON} alt="SkillAd" className="h-8 w-8 rounded-lg" />
            SkillAd
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
            ✕
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-3">Provider unavailable</h1>
          <p className="text-muted-foreground leading-relaxed mb-2">{message}</p>
          <p className="text-sm text-muted-foreground mb-8">
            Explore thousands of verified professionals on SkillAd.
          </p>
          <div className="space-y-3">
            {(settings.playStoreLink || settings.appStoreLink) && (
              <a
                href={settings.playStoreLink || settings.appStoreLink}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold py-3 hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download SkillAd
              </a>
            )}
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 font-semibold py-3 hover:bg-slate-50 transition-colors"
            >
              Back to SkillAd
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ProviderPublicProfilePage() {
  const params = useParams<{ providerId?: string }>();
  const providerId = params.providerId ?? "";

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<PublicProviderProfile | null>(null);
  const [unavailableMsg, setUnavailableMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    playStoreLink: "",
    appStoreLink: "",
    supportEmail: "",
    supportPhone: "",
    enabledLanguages: [],
    websiteUrl: "https://skillad.in",
  });
  const [shareHint, setShareHint] = useState("");

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!providerId) {
      setUnavailableMsg("This provider is no longer available.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPublicProvider(providerId)
      .then((res) => {
        if (cancelled) return;
        if (!res.available) {
          setProvider(null);
          setUnavailableMsg(res.message ?? "This provider is no longer available.");
          return;
        }
        setProvider(res.provider);
        setUnavailableMsg(null);
        void recordProviderWebActivity(res.provider.id, "view");
      })
      .catch(() => {
        if (!cancelled) {
          setProvider(null);
          setUnavailableMsg("This provider is no longer available.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  // Client-side document meta for browsers (crawlers use server OG HTML)
  useEffect(() => {
    if (!provider) return;
    const city = provider.city || provider.location || "India";
    const title = `${provider.name} – ${provider.category} in ${city} | SkillAd`;
    const desc = `Find verified ${provider.category} ${provider.name} in ${city}. View experience, ratings, service area and contact through SkillAd.`;
    document.title = title;
    const ensure = (attr: string, key: string, content: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    ensure("name", "description", desc);
    ensure("property", "og:title", `${provider.name} · ${provider.category}`);
    ensure("property", "og:description", `${provider.category} in ${city} · Verified on SkillAd`);
    ensure("property", "og:url", provider.shareUrl);
    if (provider.avatarUrl) ensure("property", "og:image", provider.avatarUrl);
  }, [provider]);

  async function handleShare() {
    if (!provider) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${provider.name} on SkillAd`,
          text: `${provider.name} — ${provider.category}`,
          url: provider.shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(provider.shareUrl);
        setShareHint("Link copied");
        window.setTimeout(() => setShareHint(""), 2000);
      }
    } catch {
      /* cancelled */
    }
  }

  function handleWhatsApp() {
    if (!provider?.canWhatsApp) return;
    void recordProviderWebActivity(provider.id, "whatsapp");
    window.location.href = provider.contact.whatsappPath;
  }

  function handleCall() {
    if (!provider?.canCall) return;
    void recordProviderWebActivity(provider.id, "call");
    window.location.href = provider.contact.callPath;
  }

  function handleDownload() {
    if (provider) void recordProviderWebActivity(provider.id, "download");
    openAppOrStore(settings, provider?.id ?? providerId);
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading profile…
      </div>
    );
  }

  if (!provider || unavailableMsg) {
    return (
      <UnavailableState
        message={unavailableMsg ?? "This provider is no longer available."}
        settings={settings}
      />
    );
  }

  const city = provider.city || provider.location || "India";

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground shrink-0">
            <img src={ICON} alt="SkillAd" className="h-8 w-8 rounded-lg" />
            <span className="hidden sm:inline">SkillAd</span>
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
        {shareHint && (
          <p className="text-center text-xs text-primary font-medium pb-2">{shareHint}</p>
        )}
      </header>

      <main className="flex-1">
        <div className="bg-gradient-to-br from-[#0B1220] via-[#132038] to-[#0B1220] text-white pb-20 pt-8">
          <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row sm:items-end gap-5">
            <ProviderAvatar provider={provider} />
            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {provider.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
                {provider.available && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 text-[#ffb08a] border border-primary/30 px-2.5 py-0.5 text-xs font-semibold">
                    Available Now
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">{provider.name}</h1>
              <p className="text-white/70 text-lg font-medium mb-3">
                {provider.category}
                {provider.subcategory ? ` · ${provider.subcategory}` : ""}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/65">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  {provider.location || city}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  {provider.rating.toFixed(1)}
                  <span className="text-white/45">({provider.reviewCount} reviews)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-primary" />
                  {provider.experience}+ yrs experience
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 -mt-10 pb-28 space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">
              About
            </h2>
            <p className="text-slate-700 leading-relaxed whitespace-pre-line">
              {provider.description?.trim() ||
                `${provider.name} is a verified ${provider.category} on SkillAd serving ${city}.`}
            </p>
          </section>

          <section className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">
                Service area
              </h2>
              <p className="font-semibold text-foreground mb-1">
                {provider.serviceArea || `${provider.serviceRadius} km radius`}
              </p>
              <p className="text-sm text-muted-foreground">
                Covers customers within about {provider.serviceRadius} km of their base location.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">
                  Member since
                </p>
                <p className="font-semibold">{formatMemberSince(provider.memberSince)}</p>
              </div>
              {provider.responseTime && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">
                    Response time
                  </p>
                  <p className="font-semibold">{provider.responseTime}</p>
                </div>
              )}
              {provider.workingHours && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">
                    Working hours
                  </p>
                  <p className="font-semibold">{provider.workingHours}</p>
                </div>
              )}
            </div>
          </section>

          {(provider.services?.length > 0 || provider.languages?.length > 0) && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
              {provider.services?.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">
                    Skills / services
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {provider.services.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-primary/10 text-primary border border-primary/15 px-3 py-1 text-sm font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {provider.languages?.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">
                    Languages
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {provider.languages.map((l) => (
                      <span
                        key={l}
                        className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-sm font-medium"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {provider.extensions?.featured === true && (
            <section className="rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-6 shadow-sm">
              <p className="font-semibold text-primary">Featured provider on SkillAd</p>
              <p className="text-sm text-muted-foreground mt-1">
                Highlighted for quality and customer trust in your area.
              </p>
            </section>
          )}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 safe-pb">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={!provider.canWhatsApp}
            className="inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl bg-[#25D366] text-white font-semibold py-3 text-xs sm:text-sm disabled:opacity-40"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handleCall}
            disabled={!provider.canCall}
            className="inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl bg-slate-900 text-white font-semibold py-3 text-xs sm:text-sm disabled:opacity-40"
          >
            <Phone className="h-4 w-4" />
            Call
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl bg-primary text-primary-foreground font-semibold py-3 text-xs sm:text-sm"
          >
            <Download className="h-4 w-4" />
            App
          </button>
        </div>
      </div>
    </div>
  );
}
