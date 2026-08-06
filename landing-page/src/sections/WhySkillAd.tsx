import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { fetchContent, type FeatureCard } from "@/lib/api";

const TRADITIONAL = [
  "Ask neighbours",
  "Search WhatsApp",
  "Save random numbers",
  "Unknown quality",
];

const SKILLAD = [
  "Verified professionals",
  "Nearby discovery",
  "Reviews",
  "GPS based",
  "Chat",
  "Multi-language",
];

export default function WhySkillAd() {
  const [cards, setCards] = useState<FeatureCard[]>([]);

  useEffect(() => {
    fetchContent()
      .then((c) => setCards(c.landing?.featureCards ?? []))
      .catch(() => setCards([]));
  }, []);

  return (
    <section id="why-skillad" className="py-28 bg-[#0B1220] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 right-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">Why SkillAd</p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5">
            Traditional method vs SkillAd
          </h2>
          <p className="text-lg text-white/65 leading-relaxed">
            Stop hunting for phone numbers. Discover verified local professionals the modern way.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-16">
          <motion.div
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10"
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-xl font-bold text-white/80 mb-6">Traditional Method</h3>
            <ul className="space-y-4">
              {TRADITIONAL.map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/60">
                  <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-base">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="rounded-3xl border border-primary/30 bg-primary/10 p-8 md:p-10 shadow-[0_20px_60px_rgba(255,107,44,0.12)]"
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-xl font-bold text-white mb-6">SkillAd</h3>
            <ul className="space-y-4">
              {SKILLAD.map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/90">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-base font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {cards.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((card, i) => (
              <motion.div
                key={card.id || i}
                className="p-8 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] hover:border-primary/30 transition-all duration-300"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="h-11 w-11 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-5 ring-1 ring-primary/20">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold mb-2">{card.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{card.description}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
