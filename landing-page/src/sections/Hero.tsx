import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Search, ShieldCheck, MapPin, Languages, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchContent, type LandingContent } from "@/lib/api";

interface HeroProps {
  onDownload: () => void;
  onExplore: () => void;
}

function HeroPhoneSilhouette() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div className="absolute -inset-8 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="relative rounded-[2.5rem] border border-white/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3 shadow-[0_40px_80px_rgba(15,23,42,0.35)] ring-1 ring-white/10">
        <div className="rounded-[2rem] overflow-hidden bg-slate-950 aspect-[9/19] relative">
          <div className="absolute inset-x-0 top-0 h-8 bg-black/40 flex items-center justify-center">
            <div className="h-1.5 w-16 rounded-full bg-white/20" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <p className="text-white font-bold text-lg leading-tight mb-2">GPS Discovery</p>
            <p className="text-white/55 text-sm leading-relaxed mb-6">
              Move into a provider&apos;s service area and providers appear automatically.
            </p>
            <a
              href="#gps-discovery"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              See how discovery works
              <ChevronDown className="h-4 w-4 animate-bounce" />
            </a>
          </div>
          <div className="absolute inset-x-8 bottom-6 h-1 rounded-full bg-white/15" />
        </div>
      </div>
    </div>
  );
}

export default function Hero({ onDownload, onExplore }: HeroProps) {
  const [landing, setLanding] = useState<LandingContent | null>(null);

  useEffect(() => {
    fetchContent()
      .then((c) => setLanding(c.landing ?? null))
      .catch(() => setLanding(null));
  }, []);

  const heading =
    landing?.heroHeading?.trim() ||
    "Nearby Skills.\nRight When You Need Them.";
  const subtitle =
    landing?.heroSubtitle?.trim() ||
    "Find verified electricians, plumbers, tutors, beauticians, drivers and hundreds of skilled professionals near you.";
  const announcement = landing?.heroAnnouncement?.trim();

  return (
    <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,107,44,0.08),_transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230f172a' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <div>
            {announcement ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-7 border border-primary/15"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                {announcement}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-semibold mb-7 tracking-wide"
              >
                GPS discovery for skilled work across India
              </motion.div>
            )}

            <motion.h1
              className="text-4xl sm:text-5xl md:text-[3.5rem] lg:text-[3.75rem] font-extrabold tracking-tight text-foreground leading-[1.05] mb-7 whitespace-pre-line"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              {heading.split("\n").map((line, i, arr) => (
                <span key={i}>
                  {i === arr.length - 1 ? (
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b2c] via-[#ff8f5a] to-[#ff6b2c]">
                      {line}
                    </span>
                  ) : (
                    line
                  )}
                  {i < arr.length - 1 ? <br /> : null}
                </span>
              ))}
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl leading-relaxed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              {subtitle}
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-3.5 mb-11"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
            >
              <Button
                size="lg"
                onClick={onDownload}
                className="h-14 px-8 text-base shadow-[0_12px_40px_rgba(255,107,44,0.35)] rounded-2xl font-semibold hover:scale-[1.02] transition-transform"
              >
                <Download className="mr-2 h-5 w-5" />
                Download Android
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onExplore}
                className="h-14 px-8 text-base rounded-2xl bg-white/80 backdrop-blur border-slate-200 hover:bg-white hover:border-primary/30"
              >
                <Search className="mr-2 h-5 w-5" />
                Explore Categories
              </Button>
            </motion.div>

            <motion.div
              className="flex flex-wrap gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              {[
                { icon: ShieldCheck, label: "Verified providers" },
                { icon: MapPin, label: "Provider service areas" },
                { icon: Languages, label: "24 languages" },
              ].map((b) => (
                <div
                  key={b.label}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur px-3.5 py-2.5 text-sm text-slate-600 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
                >
                  <span className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center">
                    <b.icon className="h-3.5 w-3.5 text-primary" />
                  </span>
                  {b.label}
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 28, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="lg:pl-2"
          >
            <HeroPhoneSilhouette />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
