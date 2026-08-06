import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { fetchContent, type LandingContent } from "@/lib/api";

interface ProviderCtaProps {
  onPrimary: () => void;
}

export default function ProviderCta({ onPrimary }: ProviderCtaProps) {
  const [landing, setLanding] = useState<LandingContent | null>(null);

  useEffect(() => {
    fetchContent()
      .then((c) => setLanding(c.landing ?? null))
      .catch(() => setLanding(null));
  }, []);

  const title =
    landing?.providerCtaTitle?.trim() ||
    "Offer your skills. Get discovered nearby.";
  const subtitle =
    landing?.providerCtaSubtitle?.trim() ||
    "Register as a provider and start receiving booking requests from customers in your area.";
  const primaryLabel =
    landing?.providerCtaPrimaryLabel?.trim() || "Register as Provider";
  const secondaryLabel =
    landing?.providerCtaSecondaryLabel?.trim() || "Learn more";

  return (
    <section id="providers" className="py-24 bg-[#0f172a] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/25 via-transparent to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">{title}</h2>
          <p className="text-lg md:text-xl text-white/75 mb-10">{subtitle}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={onPrimary}
              className="h-14 px-8 text-base rounded-2xl font-semibold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/25"
            >
              {primaryLabel}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-base rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10"
              onClick={() =>
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {secondaryLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
