import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, UserPlus, Star, Briefcase, CreditCard, MapPin, ShieldCheck, Users, FolderPlus } from "lucide-react";
import { fetchLiveActivity, type LiveActivityItem } from "@/lib/api";

function typeIcon(type: string) {
  switch (type) {
    case "provider_joined":
      return UserPlus;
    case "provider_verified":
      return ShieldCheck;
    case "review":
    case "review_submitted":
    case "app_review":
      return Star;
    case "booking_completed":
      return Briefcase;
    case "subscription":
    case "subscription_renewed":
      return CreditCard;
    case "customer_joined":
      return Users;
    case "city_activated":
      return MapPin;
    case "category_added":
      return FolderPlus;
    default:
      return Activity;
  }
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function LiveActivity() {
  const [items, setItems] = useState<LiveActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchLiveActivity()
        .then((list) => {
          if (!cancelled) setItems(list);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoaded(true);
        });
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  return (
    <section id="activity" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Live activity</h2>
          <p className="text-lg text-muted-foreground">
            Recent real events from the SkillAd platform.
          </p>
        </div>

        {!loaded && (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading activity…</div>
        )}

        {loaded && items.length === 0 && (
          <div className="rounded-2xl border border-border bg-muted/30 p-12 text-center text-sm text-muted-foreground">
            No recent public activity.
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((item, i) => {
              const Icon = typeIcon(item.type);
              return (
                <motion.div
                  key={`${item.type}-${item.id}-${i}`}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {timeAgo(item.at)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
