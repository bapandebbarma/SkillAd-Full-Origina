/**
 * ILLUSTRATIVE Hero animation — SkillAd GPS discovery storytelling.
 * Not live map data. Role names are concept labels only.
 *
 * Business logic (unchanged):
 * - Customers have NO search radius.
 * - Each provider has a FIXED service area around them.
 * - Providers & areas never move; only the customer walks.
 * - Phone lists providers whose area currently covers the customer.
 * - Overlapping areas → multiple providers appear together.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Phone, Star } from "lucide-react";

type DemoProvider = {
  id: string;
  role: string;
  icon: string;
  x: number;
  y: number;
  /** Fixed service radius in SVG units */
  radius: number;
  radiusLabel: string;
  color: string;
  avatarBg: string;
  rating: number;
  /** Scale factor so displayed km feels realistic vs SVG distance */
  kmScale: number;
};

/**
 * Fixed providers — positions chosen so:
 * 1) Customer starts OUTSIDE all areas (left).
 * 2) Discovers Electrician first.
 * 3) Mid-journey: Tutor + Plumber + Beautician OVERLAP on the road.
 * 4) Later: Cook alone, then exit.
 */
const PROVIDERS: DemoProvider[] = [
  {
    id: "electrician",
    role: "Electrician",
    icon: "⚡",
    x: 155,
    y: 168,
    radius: 54,
    radiusLabel: "50 km",
    color: "#F59E0B",
    avatarBg: "#FEF3C7",
    rating: 4.9,
    kmScale: 0.055,
  },
  {
    id: "tutor",
    role: "Tutor",
    icon: "📚",
    x: 295,
    y: 118,
    radius: 82,
    radiusLabel: "100 km",
    color: "#8B5CF6",
    avatarBg: "#EDE9FE",
    rating: 4.8,
    kmScale: 0.05,
  },
  {
    id: "plumber",
    role: "Plumber",
    icon: "🔧",
    x: 325,
    y: 188,
    radius: 68,
    radiusLabel: "80 km",
    color: "#3B82F6",
    avatarBg: "#DBEAFE",
    rating: 4.7,
    kmScale: 0.052,
  },
  {
    id: "beautician",
    role: "Beautician",
    icon: "💇",
    x: 355,
    y: 128,
    radius: 90,
    radiusLabel: "120 km",
    color: "#EC4899",
    avatarBg: "#FCE7F3",
    rating: 4.9,
    kmScale: 0.048,
  },
  {
    id: "cook",
    role: "Cook",
    icon: "🍳",
    x: 480,
    y: 165,
    radius: 50,
    radiusLabel: "40 km",
    color: "#EA580C",
    avatarBg: "#FFEDD5",
    rating: 4.6,
    kmScale: 0.058,
  },
];

/** Long left→right road — customer starts far left, outside all radii. */
const ROAD = [
  { x: 8, y: 225 },
  { x: 55, y: 218 },
  { x: 105, y: 205 },
  { x: 155, y: 192 },
  { x: 205, y: 178 },
  { x: 255, y: 165 },
  { x: 305, y: 158 },
  { x: 355, y: 162 },
  { x: 405, y: 155 },
  { x: 455, y: 148 },
  { x: 510, y: 155 },
  { x: 555, y: 168 },
];

type Landmark = { x: number; y: number; label: string; icon: string };

const LANDMARKS: Landmark[] = [
  { x: 70, y: 95, label: "Apartment", icon: "🏢" },
  { x: 175, y: 78, label: "Hospital", icon: "🏥" },
  { x: 250, y: 240, label: "School", icon: "🏫" },
  { x: 380, y: 240, label: "Market", icon: "🛒" },
  { x: 430, y: 70, label: "Office", icon: "🏛️" },
  { x: 520, y: 95, label: "Park", icon: "🌿" },
];

const VIEW_W = 570;
const VIEW_H = 300;

type StatusMsg = { id: string; kind: "enter" | "leave"; text: string };

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function pointOnRoad(t: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(0.9999, t));
  const segs = ROAD.length - 1;
  const f = clamped * segs;
  const i = Math.min(Math.floor(f), segs - 1);
  const local = f - i;
  const a = ROAD[i];
  const b = ROAD[i + 1];
  return {
    x: a.x + (b.x - a.x) * local,
    y: a.y + (b.y - a.y) * local,
  };
}

function roadPathD() {
  return ROAD.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function ProviderCard({
  p,
  customer,
}: {
  p: DemoProvider;
  customer: { x: number; y: number };
}) {
  const km = Math.max(0.3, dist(customer.x, customer.y, p.x, p.y) * p.kmScale);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="rounded-2xl bg-white border border-slate-100 shadow-[0_4px_18px_rgba(15,23,42,0.08)] p-2.5 flex gap-2.5 items-center"
    >
      <div
        className="h-11 w-11 rounded-full flex items-center justify-center text-lg shrink-0 ring-2 ring-white shadow-sm"
        style={{ background: p.avatarBg }}
        aria-hidden
      >
        {p.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-bold text-slate-900 truncate">{p.role}</p>
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600">
            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" aria-hidden />
            {p.rating.toFixed(1)}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">{km.toFixed(1)} km away</p>
        <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 border border-emerald-100">
          Available
        </span>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Phone className="h-3 w-3" aria-hidden />
        </span>
        <span className="h-7 w-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
          <MessageCircle className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </motion.div>
  );
}

export default function GpsAnimation() {
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(1);
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const prevInside = useRef<Set<string>>(new Set());
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let frame = 0;
    let raf = 0;
    // ~16s story + soft fade restart
    const WALK = 900;
    const FADE_OUT = 40;
    const HOLD = 20;
    const FADE_IN = 35;
    const CYCLE = WALK + FADE_OUT + HOLD + FADE_IN;

    const tick = () => {
      frame = (frame + 1) % CYCLE;
      if (frame < WALK) {
        const t = frame / WALK;
        // ease-in-out continuous walk
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        setProgress(eased);
        setFade(1);
      } else if (frame < WALK + FADE_OUT) {
        const u = (frame - WALK) / FADE_OUT;
        setFade(1 - u);
        setProgress(1);
      } else if (frame < WALK + FADE_OUT + HOLD) {
        setFade(0);
        setProgress(0);
      } else {
        const u = (frame - WALK - FADE_OUT - HOLD) / FADE_IN;
        setFade(u);
        setProgress(0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, []);

  const customer = useMemo(() => pointOnRoad(progress), [progress]);

  const inside = useMemo(
    () => PROVIDERS.filter((p) => dist(customer.x, customer.y, p.x, p.y) <= p.radius),
    [customer.x, customer.y],
  );

  // Enter / leave toast feedback
  useEffect(() => {
    if (fade < 0.5) {
      prevInside.current = new Set();
      return;
    }
    const next = new Set(inside.map((p) => p.id));
    const prev = prevInside.current;

    for (const p of PROVIDERS) {
      const was = prev.has(p.id);
      const now = next.has(p.id);
      if (!was && now) {
        const msg: StatusMsg = {
          id: `${p.id}-enter-${Date.now()}`,
          kind: "enter",
          text: `✓ Entered ${p.role} Service Area`,
        };
        setStatus(msg);
        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setStatus(null), 2200);
      } else if (was && !now) {
        const msg: StatusMsg = {
          id: `${p.id}-leave-${Date.now()}`,
          kind: "leave",
          text: `Leaving ${p.role} Service Area`,
        };
        setStatus(msg);
        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setStatus(null), 1800);
      }
    }
    prevInside.current = next;
  }, [inside, fade]);

  const overlapHighlight = inside.length >= 3;

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div
        className="pointer-events-none absolute -inset-5 rounded-[2.25rem] bg-gradient-to-br from-primary/25 via-violet-400/10 to-sky-400/10 blur-2xl opacity-80"
        aria-hidden
      />

      <motion.div
        className="relative rounded-[1.75rem] border border-white/70 bg-white/95 backdrop-blur-xl shadow-[0_28px_90px_rgba(15,23,42,0.14)] overflow-hidden"
        style={{ opacity: fade }}
        aria-label="SkillAd GPS discovery animation. Customer moves through fixed provider service areas while the phone updates nearby professionals."
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100/80 flex items-center justify-between bg-gradient-to-r from-[#0B1220] via-[#132038] to-[#0B1220] text-white">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/45">
              Live discovery
            </p>
            <p className="text-sm font-semibold mt-0.5">
              Move into their area · Appear nearby
            </p>
          </div>
          <div className="flex items-center gap-2">
            {overlapHighlight && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden xs:inline text-[10px] rounded-full bg-emerald-400/20 text-emerald-300 px-2 py-1 font-semibold border border-emerald-400/30"
              >
                {inside.length} overlapping
              </motion.span>
            )}
            <span className="text-[10px] rounded-full bg-[#ff6b2c]/20 text-[#ff6b2c] px-2.5 py-1 font-semibold border border-[#ff6b2c]/25">
              Concept
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-[1.4fr_168px] gap-0">
          {/* ── Map ── */}
          <div className="relative bg-[linear-gradient(165deg,#f8fafc_0%,#fff7ed_40%,#f1f5f9_100%)] min-h-[220px] sm:min-h-[300px] overflow-hidden">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="w-full h-full"
              role="img"
              aria-hidden
            >
              <defs>
                <filter id="areaGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="roadGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#64748b" />
                </linearGradient>
              </defs>

              {/* Soft terrain */}
              {Array.from({ length: 36 }).map((_, i) => (
                <circle
                  key={i}
                  cx={20 + ((i * 73) % (VIEW_W - 40))}
                  cy={24 + ((i * 47) % (VIEW_H - 40))}
                  r="1.1"
                  fill="#cbd5e1"
                  opacity="0.4"
                />
              ))}

              {/* Landmarks — minimal */}
              {LANDMARKS.map((lm) => (
                <g key={lm.label} opacity="0.85">
                  <rect
                    x={lm.x - 14}
                    y={lm.y - 12}
                    width="28"
                    height="22"
                    rx="6"
                    fill="white"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                  <text x={lm.x} y={lm.y + 1} textAnchor="middle" fontSize="11">
                    {lm.icon}
                  </text>
                  <text
                    x={lm.x}
                    y={lm.y + 22}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="7"
                    fontWeight="600"
                  >
                    {lm.label}
                  </text>
                </g>
              ))}

              {/* Fixed provider service areas + subtle pulse */}
              {PROVIDERS.map((p) => {
                const active = inside.some((x) => x.id === p.id);
                return (
                  <g key={`area-${p.id}`}>
                    <motion.circle
                      cx={p.x}
                      cy={p.y}
                      r={p.radius}
                      fill={p.color}
                      stroke={p.color}
                      strokeWidth={active ? 2.2 : 1.4}
                      strokeDasharray={active ? "0" : "6 5"}
                      initial={false}
                      animate={{
                        fillOpacity: active ? [0.12, 0.18, 0.12] : [0.045, 0.07, 0.045],
                        strokeOpacity: active ? [0.75, 0.95, 0.75] : [0.28, 0.4, 0.28],
                      }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <text
                      x={p.x}
                      y={p.y - p.radius - 5}
                      textAnchor="middle"
                      fill={p.color}
                      fontSize="8"
                      fontWeight="700"
                      opacity={active ? 0.95 : 0.5}
                    >
                      {p.radiusLabel}
                    </text>
                  </g>
                );
              })}

              {/* Road */}
              <path
                d={roadPathD()}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={roadPathD()}
                fill="none"
                stroke="url(#roadGrad)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={roadPathD()}
                fill="none"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="7 9"
                opacity="0.75"
              />

              {/* Fixed providers with profession icons */}
              {PROVIDERS.map((p) => {
                const active = inside.some((x) => x.id === p.id);
                return (
                  <g key={p.id} filter={active ? "url(#areaGlow)" : undefined}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={active ? 19 : 16}
                      fill={p.color}
                      stroke="white"
                      strokeWidth="2.5"
                    />
                    <text
                      x={p.x}
                      y={p.y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={active ? "13" : "12"}
                    >
                      {p.icon}
                    </text>
                    <text
                      x={p.x}
                      y={p.y + 30}
                      textAnchor="middle"
                      fill="#334155"
                      fontSize="9"
                      fontWeight="700"
                    >
                      {p.role}
                    </text>
                  </g>
                );
              })}

              {/* Customer — only moving object */}
              <g transform={`translate(${customer.x}, ${customer.y})`}>
                <motion.circle
                  r="24"
                  fill="rgba(15,23,42,0.1)"
                  animate={{ r: [22, 26, 22] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
                <circle r="15" fill="#0f172a" stroke="white" strokeWidth="2.5" />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="8"
                  fontWeight="800"
                >
                  You
                </text>
              </g>
            </svg>

            {/* Enter / leave feedback */}
            <div className="absolute top-3 left-3 right-3 flex justify-center pointer-events-none z-10">
              <AnimatePresence mode="wait">
                {status && (
                  <motion.div
                    key={status.id}
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-lg border backdrop-blur-md ${
                      status.kind === "enter"
                        ? "bg-emerald-50/95 text-emerald-800 border-emerald-200"
                        : "bg-slate-900/90 text-white border-slate-700"
                    }`}
                  >
                    {status.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap gap-1.5 pointer-events-none">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/92 border border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                You move
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/92 border border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b2c]" />
                Their areas stay fixed
              </span>
              {overlapHighlight && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-[9px] font-bold text-emerald-700 shadow-sm">
                  Overlap · {inside.length} nearby
                </span>
              )}
            </div>
          </div>

          {/* ── Phone UI ── */}
          <div className="border-t md:border-t-0 md:border-l border-slate-100 bg-[#0B1220] p-3 flex flex-col min-h-[240px] md:min-h-0 relative">
            {/* Phone chrome */}
            <div className="mx-auto w-14 h-1.5 rounded-full bg-white/20 mb-2" />
            <div className="rounded-[1.15rem] bg-slate-50 flex-1 flex flex-col overflow-hidden border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="px-3 pt-3 pb-2 border-b border-slate-100 bg-white/90 backdrop-blur">
                <p className="text-[9px] uppercase tracking-[0.14em] font-bold text-slate-400">
                  Nearby now
                </p>
                <p className="text-[11px] font-semibold text-slate-800 mt-0.5">
                  {inside.length === 0
                    ? "No coverage yet"
                    : `${inside.length} professional${inside.length === 1 ? "" : "s"}`}
                </p>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-hidden bg-gradient-to-b from-slate-50 to-white">
                <AnimatePresence mode="popLayout">
                  {inside.length === 0 && (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-8 text-center"
                    >
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Keep moving to enter a provider&apos;s service area
                      </p>
                    </motion.div>
                  )}
                  {inside.map((p) => (
                    <ProviderCard key={p.id} p={p} customer={customer} />
                  ))}
                </AnimatePresence>
              </div>

              {overlapHighlight && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-2 mb-2 rounded-xl bg-emerald-50 border border-emerald-100 px-2 py-1.5 text-[9px] font-semibold text-emerald-700 text-center"
                >
                  Overlapping areas — all matching providers shown
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <p className="mt-3.5 text-center text-[11px] text-muted-foreground max-w-md mx-auto leading-relaxed">
        As you move from one area to another, providers appear and disappear automatically based on
        their service coverage. No manual searching is required.
      </p>
    </div>
  );
}
