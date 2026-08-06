import { useEffect, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { fetchContent, type AppScreenshot } from "@/lib/api";

export default function AppShowcase() {
  const [shots, setShots] = useState<AppScreenshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchContent()
      .then((c) => {
        // fetchContent normalizes both content.appScreenshots and content.landing.appScreenshots
        const list = (c.landing?.appScreenshots ?? c.appScreenshots ?? []).filter((s) =>
          Boolean(s?.url?.trim()),
        );
        console.info("[AppShowcase] screenshots bound", {
          count: list.length,
          labels: list.map((s) => s.label),
          urls: list.map((s) => s.url),
        });
        if (!cancelled) {
          setShots(list);
          setIndex(0);
        }
      })
      .catch((err) => {
        console.warn("[AppShowcase] fetchContent failed", err);
        if (!cancelled) setShots([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (shots.length < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % shots.length), 4000);
    return () => clearInterval(t);
  }, [shots.length, paused]);

  useEffect(() => {
    if (index >= shots.length && shots.length > 0) setIndex(0);
  }, [shots.length, index]);

  const current = shots[index];
  const hasShots = loaded && shots.length > 0;

  function onDragEnd(_: unknown, info: PanInfo) {
    if (shots.length < 2) return;
    if (info.offset.x < -50) setIndex((i) => (i + 1) % shots.length);
    else if (info.offset.x > 50) setIndex((i) => (i - 1 + shots.length) % shots.length);
  }

  return (
    <section id="app" className="py-24 bg-slate-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              The SkillAd app
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Search, chat, and book local professionals — designed for everyday India.
            </p>
            {!loaded && (
              <p className="text-sm text-muted-foreground">Loading screenshots…</p>
            )}
            {loaded && shots.length === 0 && (
              <div className="rounded-2xl border border-border bg-white p-8 text-sm text-muted-foreground">
                App screenshots will appear here once uploaded in the Admin CMS.
              </div>
            )}
            {hasShots && (
              <div className="flex flex-wrap gap-2">
                {shots.map((s, i) => (
                  <button
                    key={s.id || s.url || i}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      i === index
                        ? "bg-primary text-primary-foreground"
                        : "bg-white border border-border text-muted-foreground"
                    }`}
                  >
                    {s.label || `Screen ${i + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            {hasShots && current ? (
              <>
                <div
                  className="relative w-[240px] h-[480px] rounded-[2.5rem] border-[6px] border-[#0f172a] bg-[#0f172a] shadow-[0_30px_80px_rgba(15,23,42,0.25)] overflow-hidden touch-pan-y"
                  onMouseEnter={() => setPaused(true)}
                  onMouseLeave={() => setPaused(false)}
                  onTouchStart={() => setPaused(true)}
                  onTouchEnd={() => setPaused(false)}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#0f172a] rounded-b-2xl z-10" />
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={current.url + String(index)}
                      src={current.url}
                      alt={current.label || "App screenshot"}
                      className="absolute inset-0 w-full h-full object-cover cursor-grab active:cursor-grabbing"
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.2}
                      onDragEnd={onDragEnd}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.35 }}
                    />
                  </AnimatePresence>
                </div>
                {shots.length > 1 && (
                  <div className="flex items-center gap-2" role="tablist" aria-label="Screenshot slides">
                    {shots.map((s, i) => (
                      <button
                        key={s.id || s.url || i}
                        type="button"
                        role="tab"
                        aria-selected={i === index}
                        aria-label={`Screenshot ${i + 1}${s.label ? `: ${s.label}` : ""}`}
                        onClick={() => setIndex(i)}
                        className={`h-2 rounded-full transition-all ${
                          i === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/40"
                        }`}
                      />
                    ))}
                  </div>
                )}
                {current.label && (
                  <p className="text-sm font-medium text-foreground">{current.label}</p>
                )}
              </>
            ) : loaded ? (
              <div className="w-[240px] h-[480px] rounded-[2.5rem] border-[6px] border-[#0f172a]/30 bg-white flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
                No screenshots uploaded yet
              </div>
            ) : (
              <div className="w-[240px] h-[480px] rounded-[2.5rem] border-[6px] border-[#0f172a]/30 bg-white flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
                Loading screenshots…
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
