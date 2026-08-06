import { Suspense, lazy, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import NotFound from "@/pages/not-found";
import ProviderPublicProfilePage from "@/pages/ProviderPublicProfile";
import {
  fetchContent,
  fetchCategories,
  fetchSettings,
  ICON,
  type AppSettings,
  type Category,
  type SiteContent,
} from "@/lib/api";
import { iconToEmoji } from "@/lib/icons";
import Header from "@/sections/Header";
import Hero from "@/sections/Hero";
import Stats from "@/sections/Stats";
import Footer from "@/sections/Footer";

const UspBanner = lazy(() => import("@/sections/UspBanner"));
const GpsDiscovery = lazy(() => import("@/sections/GpsDiscovery"));
const HowItWorks = lazy(() => import("@/sections/HowItWorks"));
const Categories = lazy(() => import("@/sections/Categories"));
const WhySkillAd = lazy(() => import("@/sections/WhySkillAd"));
const NearbyProviders = lazy(() => import("@/sections/NearbyProviders"));
const IndiaCoverage = lazy(() => import("@/sections/IndiaCoverage"));
const Reviews = lazy(() => import("@/sections/Reviews"));
const AppShowcase = lazy(() => import("@/sections/AppShowcase"));
const LiveActivity = lazy(() => import("@/sections/LiveActivity"));
const ProviderCta = lazy(() => import("@/sections/ProviderCta"));
const Faq = lazy(() => import("@/sections/Faq"));
const Contact = lazy(() => import("@/sections/Contact"));

const queryClient = new QueryClient();

type ModalType = "privacy" | "terms" | "contact" | "refund" | "download" | null;

function SectionFallback() {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground" aria-hidden>
      Loading…
    </div>
  );
}

function ContentModal({
  open,
  type,
  onClose,
  appLinks,
}: {
  open: boolean;
  type: ModalType;
  onClose: () => void;
  appLinks: AppSettings;
}) {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchContent()
      .then(setContent)
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [open]);

  const title =
    type === "privacy"
      ? "Privacy Policy"
      : type === "terms"
        ? "Terms of Service"
        : type === "refund"
          ? "Refund Policy"
          : type === "contact"
            ? "Contact Us"
            : "";

  const body =
    type === "privacy"
      ? content?.privacyPolicy
      : type === "terms"
        ? content?.termsOfService
        : type === "refund"
          ? content?.refundPolicy
          : null;

  const email = appLinks?.supportEmail || "support@skillad.in";
  const phone = appLinks?.supportPhone || "";
  const helpText = content?.helpCentre;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
        </DialogHeader>
        {loading && (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
        )}
        {!loading && type === "contact" && (
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p className="text-foreground font-medium text-base">Get in touch with us</p>
            <div className="space-y-2">
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-3 w-full rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors p-3"
              >
                <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  @
                </span>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                  <p className="text-foreground font-medium">{email}</p>
                </div>
              </a>
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-3 w-full rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors p-3"
                >
                  <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    📞
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                    <p className="text-foreground font-medium">{phone}</p>
                  </div>
                </a>
              )}
              {helpText && helpText !== "mobile no 999999999999" && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Help Centre</p>
                  <p className="text-foreground">{helpText}</p>
                </div>
              )}
              <a
                href="#contact"
                onClick={onClose}
                className="block text-center text-sm text-primary font-medium pt-2"
              >
                Or use the contact form on this page →
              </a>
            </div>
          </div>
        )}
        {!loading && body && (
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line space-y-4">
            {body.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}
        {!loading && !body && type !== "contact" && (
          <div className="py-8 text-center text-muted-foreground text-sm">Content not available.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DownloadModal({
  open,
  links,
  onClose,
  isProvider = false,
}: {
  open: boolean;
  links: AppSettings;
  onClose: () => void;
  isProvider?: boolean;
}) {
  const email = links.supportEmail || "support@skillad.in";
  const emailSubject = isProvider
    ? "SkillAd Provider Registration - APK Request"
    : "SkillAd App Download Request";
  const hasStore = Boolean(links.playStoreLink || links.appStoreLink);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <img src={ICON} alt="SkillAd" className="w-7 h-7 rounded-lg" />
            {isProvider ? "Join as a Skilled Worker" : "Get the SkillAd App"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-1">
          {isProvider ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex gap-3">
              <span className="text-2xl">👷</span>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Download the app, register as a provider, and start getting discovered by customers
                near you.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Full provider profiles and booking live in the SkillAd mobile app. Download to explore
              nearby professionals.
            </p>
          )}

          {hasStore ? (
            <div className="space-y-2">
              {links.playStoreLink && (
                <a
                  href={links.playStoreLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full rounded-xl bg-primary text-primary-foreground font-semibold py-3 text-sm hover:bg-primary/90 transition-colors"
                >
                  Google Play
                </a>
              )}
              {links.appStoreLink && (
                <a
                  href={links.appStoreLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full rounded-xl border border-border font-semibold py-3 text-sm hover:bg-muted/50 transition-colors"
                >
                  App Store
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3 text-sm">
                <p className="font-semibold text-foreground">
                  {isProvider ? "How to register as a provider:" : "How to get the app:"}
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  {isProvider ? (
                    <>
                      <li>Contact us via email or phone below</li>
                      <li>We&apos;ll send you the download link</li>
                      <li>
                        Install and choose <strong className="text-foreground">&quot;I offer skills&quot;</strong>
                      </li>
                      <li>Create your provider profile</li>
                    </>
                  ) : (
                    <>
                      <li>Contact us via email or phone below</li>
                      <li>We&apos;ll send you the download link</li>
                      <li>Install and start finding nearby skills</li>
                    </>
                  )}
                </ol>
              </div>
              <div className="space-y-2">
                <a
                  href={`mailto:${email}?subject=${encodeURIComponent(emailSubject)}`}
                  className="flex items-center gap-3 w-full rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors p-3 text-sm font-medium"
                >
                  <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base">
                    @
                  </span>
                  <span className="text-foreground">{email}</span>
                </a>
                {links.supportPhone && (
                  <a
                    href={`tel:${links.supportPhone}`}
                    className="flex items-center gap-3 w-full rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors p-3 text-sm font-medium"
                  >
                    <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base">
                      📞
                    </span>
                    <span className="text-foreground">{links.supportPhone}</span>
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">All Service Categories</DialogTitle>
        </DialogHeader>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {loading && (
          <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading categories...
          </div>
        )}
        {!loading && (
          <div className="overflow-y-auto flex-1 pr-1">
            <p className="text-xs text-muted-foreground mb-3">
              {filtered.length} categor{filtered.length === 1 ? "y" : "ies"} available
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((cat) => (
                <div
                  key={cat.id}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors text-center"
                >
                  <span
                    className="h-11 w-11 rounded-full flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: (cat.color || "#ff6b2c") + "22" }}
                  >
                    {iconToEmoji(cat.icon)}
                  </span>
                  <span className="text-sm font-medium leading-tight">{cat.name}</span>
                  {typeof cat.searchCount === "number" ? (
                    <span className="text-xs text-muted-foreground">
                      Popularity {cat.searchCount > 0 ? cat.searchCount : "—"}
                    </span>
                  ) : cat.subcategories && cat.subcategories.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {cat.subcategories.length} specialties
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">No categories found.</div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    playStoreLink: "",
    appStoreLink: "",
    supportEmail: "",
    supportPhone: "",
    enabledLanguages: [],
    websiteUrl: "",
  });

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  return settings;
}

function Home() {
  const [modal, setModal] = useState<ModalType>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [providerDownloadOpen, setProviderDownloadOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const appLinks = useAppSettings();

  function handleDownload() {
    if (appLinks.playStoreLink) {
      window.open(appLinks.playStoreLink, "_blank", "noopener,noreferrer");
    } else if (appLinks.appStoreLink) {
      window.open(appLinks.appStoreLink, "_blank", "noopener,noreferrer");
    } else {
      setDownloadOpen(true);
    }
  }

  function handleProviderDownload() {
    if (appLinks.playStoreLink) {
      window.open(appLinks.playStoreLink, "_blank", "noopener,noreferrer");
    } else {
      setProviderDownloadOpen(true);
    }
  }

  function handleViewProfile(providerId?: string) {
    if (providerId) {
      window.location.assign(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/provider/${encodeURIComponent(providerId)}`);
      return;
    }
    setDownloadOpen(true);
  }

  return (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      <Header
        onModal={setModal}
        onDownload={handleDownload}
        languages={appLinks.enabledLanguages}
      />
      <main className="flex-1">
        <Hero
          onDownload={handleDownload}
          onExplore={() => {
            setCategoriesOpen(true);
            document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <Suspense fallback={<SectionFallback />}>
          <UspBanner />
          <GpsDiscovery />
        </Suspense>
        <Stats />
        <Suspense fallback={<SectionFallback />}>
          <Categories onViewAll={() => setCategoriesOpen(true)} />
          <HowItWorks />
          <WhySkillAd />
          <NearbyProviders onViewProfile={handleViewProfile} />
          <IndiaCoverage />
          <Reviews />
          <AppShowcase />
          <LiveActivity />
          <ProviderCta onPrimary={handleProviderDownload} />
          <Faq />
          <Contact />
        </Suspense>
      </main>
      <Footer
        onModal={(t) => setModal(t)}
        onDownload={handleDownload}
      />
      <ContentModal
        open={modal !== null && modal !== "download"}
        type={modal}
        onClose={() => setModal(null)}
        appLinks={appLinks}
      />
      <DownloadModal open={downloadOpen} links={appLinks} onClose={() => setDownloadOpen(false)} />
      <DownloadModal
        open={providerDownloadOpen}
        links={appLinks}
        onClose={() => setProviderDownloadOpen(false)}
        isProvider
      />
      <CategoriesModal open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/provider/:providerId" component={ProviderPublicProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
