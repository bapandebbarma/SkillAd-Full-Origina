import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchContent } from "@/lib/api";

const FALLBACK_TITLE = "No more asking for contact numbers.";
const FALLBACK_SUBTITLE =
  "No more asking friends, neighbours or relatives for phone numbers. SkillAd puts trusted local professionals right in your pocket.";

function UspIllustration() {
  return (
    <svg
      viewBox="0 0 280 200"
      className="w-full max-w-[280px] mx-auto"
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Old phone / contacts — crossed out */}
      <g opacity="0.55">
        <rect x="18" y="36" width="88" height="128" rx="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
        <rect x="28" y="52" width="68" height="88" rx="6" fill="#0f172a" />
        <circle cx="62" cy="150" r="6" fill="#475569" />
        {/* Contact rows */}
        <rect x="36" y="62" width="52" height="8" rx="2" fill="#334155" />
        <rect x="36" y="78" width="40" height="6" rx="2" fill="#334155" />
        <rect x="36" y="96" width="52" height="8" rx="2" fill="#334155" />
        <rect x="36" y="112" width="36" height="6" rx="2" fill="#334155" />
        {/* Red X */}
        <line x1="28" y1="48" x2="96" y2="152" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
        <line x1="96" y1="48" x2="28" y2="152" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* Arrow */}
      <path
        d="M120 100 H148"
        stroke="#ff6b2c"
        strokeWidth="3"
        strokeLinecap="round"
        markerEnd="url(#uspArrow)"
      />
      <defs>
        <marker id="uspArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#ff6b2c" />
        </marker>
      </defs>

      {/* SkillAd pocket phone */}
      <g>
        <rect x="168" y="28" width="92" height="144" rx="16" fill="#0B1220" stroke="#ff6b2c" strokeWidth="2.5" />
        <rect x="178" y="44" width="72" height="104" rx="8" fill="#111827" />
        <circle cx="214" cy="160" r="5" fill="#ff6b2c" />
        {/* Pocket providers appearing */}
        <circle cx="196" cy="72" r="12" fill="#ff6b2c" opacity="0.9" />
        <text x="196" y="76" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">⚡</text>
        <circle cx="228" cy="88" r="12" fill="#3B82F6" opacity="0.9" />
        <text x="228" y="92" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">🔧</text>
        <circle cx="210" cy="112" r="12" fill="#8B5CF6" opacity="0.9" />
        <text x="210" y="116" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">📚</text>
        <rect x="186" y="132" width="56" height="8" rx="4" fill="#ff6b2c" opacity="0.35" />
      </g>
    </svg>
  );
}

export default function UspBanner() {
  const [title, setTitle] = useState(FALLBACK_TITLE);
  const [subtitle, setSubtitle] = useState(FALLBACK_SUBTITLE);

  useEffect(() => {
    fetchContent()
      .then((c) => {
        const t = c.landing?.uspTitle?.trim();
        const s = c.landing?.uspSubtitle?.trim();
        if (t) setTitle(t);
        if (s) setSubtitle(s);
      })
      .catch(() => {});
  }, []);

  return (
    <section id="usp" className="relative py-20 md:py-24 overflow-hidden bg-[#0B1220]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-4">
              Why SkillAd is different
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-white leading-tight mb-5">
              {title}
            </h2>
            <p className="text-lg text-white/70 leading-relaxed max-w-xl">{subtitle}</p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary">
              Trusted professionals — in your pocket
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8 backdrop-blur-sm"
          >
            <UspIllustration />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
