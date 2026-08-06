import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Smartphone, Footprints, Users, MessageCircle, type LucideIcon } from "lucide-react";
import { fetchContent, type HowItWorksStep } from "@/lib/api";

const FALLBACK_STEPS: HowItWorksStep[] = [
  {
    id: "1",
    title: "Open SkillAd",
    description: "Download and open the app — no complicated signup needed to start exploring.",
  },
  {
    id: "2",
    title: "Move anywhere",
    description: "Your location updates automatically as you move. You never need to set a search radius.",
  },
  {
    id: "3",
    title: "Nearby professionals appear automatically whenever you enter their service area",
    description: "Providers whose service area covers you show up on your phone — no searching.",
  },
  {
    id: "4",
    title: "Chat, Call and Hire",
    description: "Message or call verified professionals and hire the right person for the job.",
  },
];

const ICONS: LucideIcon[] = [Smartphone, Footprints, Users, MessageCircle];

export default function HowItWorks() {
  const [steps, setSteps] = useState<HowItWorksStep[]>(FALLBACK_STEPS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchContent()
      .then((c) => {
        const cms = c.landing?.howItWorks ?? [];
        setSteps(cms.length > 0 ? cms : FALLBACK_STEPS);
      })
      .catch(() => setSteps(FALLBACK_STEPS))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <section id="how-it-works" className="py-28 bg-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">Simple flow</p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground mb-5">
            How SkillAd works
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Open the app, move around, and hire nearby professionals in four steps.
          </p>
        </div>

        {!loaded && (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {loaded && (
          <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5">
            <div
              className="hidden lg:block absolute top-16 left-[12%] right-[12%] h-px bg-gradient-to-r from-primary/0 via-primary/25 to-primary/0"
              aria-hidden
            />
            {steps.map((step, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <motion.div
                  key={step.id || i}
                  className="relative p-8 rounded-3xl bg-white border border-slate-200/80 shadow-[0_10px_40px_rgba(15,23,42,0.05)] hover:shadow-[0_20px_50px_rgba(255,107,44,0.12)] hover:border-primary/20 transition-all duration-300"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="absolute -top-3.5 left-6 h-8 w-8 rounded-full bg-gradient-to-br from-primary to-[#ff8f5a] text-white text-xs font-bold flex items-center justify-center shadow-lg shadow-primary/30">
                    {i + 1}
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center mb-6 ring-1 ring-primary/10">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
