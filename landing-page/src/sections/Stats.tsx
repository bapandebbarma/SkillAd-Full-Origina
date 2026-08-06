import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ShieldCheck, Users, Zap, MapPin, Star, Briefcase, type LucideIcon } from "lucide-react";
import { fetchStats, type PlatformStats } from "@/lib/api";

type StatItem = {
  label: string;
  value: number;
  icon: LucideIcon;
  decimals?: number;
  suffix?: string;
};

function formatDisplay(n: number, decimals = 0, suffix = "+"): string {
  if (decimals > 0) return n.toFixed(decimals);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K${suffix}`;
  return `${Math.round(n)}${suffix}`;
}

function AnimatedCounter({
  value,
  decimals = 0,
  suffix = "+",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(decimals > 0 ? "0.0" : "0");

  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = value * eased;
      if (decimals > 0) {
        setDisplay(current.toFixed(decimals));
      } else if (value >= 1000) {
        setDisplay(formatDisplay(current, 0, suffix));
      } else {
        setDisplay(`${Math.round(current)}${suffix}`);
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(formatDisplay(value, decimals, suffix));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, decimals, suffix]);

  return <span ref={ref}>{display}</span>;
}

function buildItems(data: PlatformStats): StatItem[] {
  const items: StatItem[] = [];

  const providers = data.providers ?? data.workers;
  if (typeof providers === "number" && providers > 0) {
    items.push({ label: "Providers", value: providers, icon: ShieldCheck });
  }

  const customers = data.customers ?? data.users;
  if (typeof customers === "number" && customers > 0) {
    items.push({ label: "Customers", value: customers, icon: Users });
  }

  const categories = data.categories ?? data.services;
  if (typeof categories === "number" && categories > 0) {
    items.push({ label: "Categories", value: categories, icon: Zap });
  }

  if (typeof data.cities === "number" && data.cities > 0) {
    items.push({ label: "Cities", value: data.cities, icon: MapPin });
  }

  if (typeof data.bookings === "number") {
    items.push({
      label: "Bookings",
      value: data.bookings,
      icon: Briefcase,
      suffix: data.bookings === 0 ? "" : "+",
    });
  }

  if (typeof data.averageRating === "number" && data.averageRating > 0) {
    items.push({
      label: "Avg. Rating",
      value: data.averageRating,
      icon: Star,
      decimals: 1,
      suffix: "",
    });
  }

  return items;
}

export default function Stats() {
  const [data, setData] = useState<PlatformStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchStats()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoaded(true));
  }, []);

  const items = data ? buildItems(data) : [];

  return (
    <section className="py-14 border-y border-border/50 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!loaded ? (
          <div className="text-center text-sm text-muted-foreground py-6">Loading stats…</div>
        ) : !data || items.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            Live platform stats are unavailable right now.
          </div>
        ) : (
          <div
            className={`grid gap-8 ${
              items.length >= 6
                ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
                : items.length === 5
                  ? "grid-cols-2 md:grid-cols-5"
                  : items.length === 3
                    ? "grid-cols-1 sm:grid-cols-3"
                    : "grid-cols-2 md:grid-cols-4"
            }`}
          >
            {items.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="flex flex-col items-center justify-center text-center space-y-2"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
                  <stat.icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-3xl font-bold text-foreground">
                  <AnimatedCounter
                    value={stat.value}
                    decimals={stat.decimals}
                    suffix={stat.suffix}
                  />
                </h3>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
