import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchCategories, type Category } from "@/lib/api";
import { iconToEmoji } from "@/lib/icons";

interface CategoriesProps {
  onViewAll: () => void;
}

export default function Categories({ onViewAll }: CategoriesProps) {
  const [cats, setCats] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchCategories()
      .then(setCats)
      .catch(() => setCats([]))
      .finally(() => setLoaded(true));
  }, []);

  const display = cats.slice(0, 8);

  return (
    <section id="categories" className="py-24 bg-[#0f172a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {cats.length > 0 ? `${cats.length} Categories` : "Service Categories"}
            </h2>
            <p className="text-white/70 text-lg">
              Whatever you need, there&apos;s a skilled professional nearby ready to help.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onViewAll}
            className="bg-transparent border-white/20 text-white hover:bg-white/10 shrink-0 rounded-xl"
          >
            View All Services <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {!loaded && (
          <div className="py-16 text-center text-white/50 text-sm">Loading categories…</div>
        )}

        {loaded && cats.length === 0 && (
          <div className="py-16 text-center text-white/50 text-sm rounded-2xl border border-white/10 bg-white/5">
            No categories available yet.
          </div>
        )}

        {display.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {display.map((cat, i) => (
              <motion.button
                type="button"
                key={cat.id}
                onClick={onViewAll}
                className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/10 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <span
                  className="h-12 w-12 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: (cat.color || "#ff6b2c") + "33" }}
                >
                  {iconToEmoji(cat.icon)}
                </span>
                <span className="font-semibold text-base leading-tight">{cat.name}</span>
                {typeof cat.providerCount === "number" ? (
                  <span className="text-xs text-white/50">
                    {cat.providerCount > 0
                      ? `${cat.providerCount} provider${cat.providerCount === 1 ? "" : "s"}`
                      : "No providers yet"}
                  </span>
                ) : typeof cat.searchCount === "number" ? (
                  <span className="text-xs text-white/50">
                    Popularity {cat.searchCount > 0 ? cat.searchCount : "—"}
                  </span>
                ) : null}
              </motion.button>
            ))}
          </div>
        )}

        {cats.length > 8 && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={onViewAll}
              className="text-white/70 hover:text-white text-sm underline underline-offset-4 transition-colors"
            >
              + {cats.length - 8} more categories — explore all
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
