import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import {
  fetchAppReviews,
  fetchAppReviewStats,
  type AppReviewPublic,
  type AppReviewStats,
} from "@/lib/api";

function formatReviewDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Reviews() {
  const [reviews, setReviews] = useState<AppReviewPublic[]>([]);
  const [stats, setStats] = useState<AppReviewStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    Promise.all([fetchAppReviews(24), fetchAppReviewStats()])
      .then(([list, s]) => {
        setReviews(list);
        setStats(s);
      })
      .catch(() => {
        setReviews([]);
        setStats(null);
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (reviews.length <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % reviews.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [reviews.length, paused]);

  const visible = reviews.length
    ? [0, 1, 2]
        .map((offset) => reviews[(index + offset) % reviews.length])
        .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
    : [];

  return (
    <section id="reviews" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            What Users Say About SkillAd
          </h2>
          <p className="text-lg text-muted-foreground">
            Real feedback about the SkillAd app experience — not provider reviews.
          </p>
          {stats && stats.count > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{stats.average.toFixed(1)}</span> average
              from {stats.count} approved review{stats.count === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {!loaded && (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading reviews…</div>
        )}

        {loaded && reviews.length === 0 && (
          <div className="rounded-2xl border border-border bg-muted/30 p-12 text-center text-sm text-muted-foreground">
            Be among the first users to share your SkillAd experience.
          </div>
        )}

        {reviews.length > 0 && (
          <div
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 min-h-[220px]">
              <AnimatePresence mode="popLayout">
                {visible.map((r) => (
                  <motion.blockquote
                    key={`${r.id}-${index}`}
                    className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.35 }}
                    layout
                  >
                    <div className="flex items-center gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className={`h-4 w-4 ${
                            s < Math.round(r.rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                      {r.featured && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-primary">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed mb-5 line-clamp-4">
                      &ldquo;{r.text}&rdquo;
                    </p>
                    <footer className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {r.initials || r.displayName?.[0] || "U"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <cite className="not-italic text-sm font-semibold text-foreground block truncate">
                          {r.displayName}
                        </cite>
                        <span className="text-xs text-muted-foreground truncate block">
                          {[r.city, formatReviewDate(r.createdAt)].filter(Boolean).join(" · ") ||
                            "SkillAd user"}
                        </span>
                      </div>
                    </footer>
                  </motion.blockquote>
                ))}
              </AnimatePresence>
            </div>

            {reviews.length > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  type="button"
                  aria-label="Previous review"
                  onClick={() => setIndex((i) => (i - 1 + reviews.length) % reviews.length)}
                  className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex gap-1.5">
                  {reviews.map((r, i) => (
                    <button
                      key={r.id}
                      type="button"
                      aria-label={`Go to review ${i + 1}`}
                      onClick={() => setIndex(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === index % reviews.length ? "w-6 bg-primary" : "w-2 bg-border"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Next review"
                  onClick={() => setIndex((i) => (i + 1) % reviews.length)}
                  className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
