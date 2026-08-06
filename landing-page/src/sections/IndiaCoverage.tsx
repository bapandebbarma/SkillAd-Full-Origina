import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";
import { fetchCities, type CityCoverage } from "@/lib/api";
/** Vite URL import — keeps tsc fast (large GeoJSON-derived paths). */
import indiaMapUrl from "@/data/indiaStatesPaths.json?url";

interface IndiaMapState {
  name: string;
  d: string;
  labelX?: number | null;
  labelY?: number | null;
  labelOnly?: boolean;
}

interface IndiaMapData {
  bounds: {
    lngMin: number;
    lngMax: number;
    latMin: number;
    latMax: number;
  };
  viewBox: { w: number; h: number };
  /** Survey of India–style national outline (includes claimed northern territories). */
  outline?: string;
  states: IndiaMapState[];
  attribution?: string;
}

function displayStateName(name: string): string {
  return name
    .replace(/Arunanchal/i, "Arunachal")
    .replace(/Andaman & Nicobar Island$/i, "Andaman & Nicobar")
    .replace(/Dadara & Nagar Havelli/i, "Dadra & Nagar Haveli");
}

function project(
  lat: number,
  lng: number,
  bounds: IndiaMapData["bounds"],
  vb: IndiaMapData["viewBox"],
) {
  const x = ((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * vb.w;
  const y = ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * vb.h;
  return { x, y };
}

export default function IndiaCoverage() {
  const [cities, setCities] = useState<CityCoverage[]>([]);
  const [indiaMap, setIndiaMap] = useState<IndiaMapData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<CityCoverage | null>(null);
  const [hovered, setHovered] = useState<CityCoverage | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchCities().catch(() => [] as CityCoverage[]),
      fetch(indiaMapUrl)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load India map");
          return r.json() as Promise<IndiaMapData>;
        })
        .catch(() => null),
    ]).then(([cityList, mapData]) => {
      if (cancelled) return;
      setCities(cityList);
      setIndiaMap(mapData);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const withCoords = useMemo(
    () =>
      cities.filter(
        (c) =>
          c.latitude != null &&
          c.longitude != null &&
          Number.isFinite(c.latitude) &&
          Number.isFinite(c.longitude),
      ),
    [cities],
  );

  const withoutCoords = useMemo(
    () => cities.filter((c) => c.latitude == null || c.longitude == null),
    [cities],
  );

  const drawableStates = useMemo(
    () => (indiaMap?.states ?? []).filter((s) => !!s.d && !s.labelOnly),
    [indiaMap],
  );

  const labeledStates = useMemo(
    () =>
      (indiaMap?.states ?? []).filter(
        (s) =>
          s.labelX != null &&
          s.labelY != null &&
          Number.isFinite(s.labelX) &&
          Number.isFinite(s.labelY) &&
          // Hide labels for tiny UTs to reduce clutter (cards still list cities)
          !/Chandigarh|Daman|Dadra|Puducherry|Delhi/i.test(s.name),
      ),
    [indiaMap],
  );

  const tooltipCity = hovered ?? selected;
  const tooltipPos = useMemo(() => {
    if (
      !indiaMap ||
      tooltipCity?.latitude == null ||
      tooltipCity?.longitude == null ||
      !Number.isFinite(tooltipCity.latitude) ||
      !Number.isFinite(tooltipCity.longitude)
    ) {
      return null;
    }
    return project(
      tooltipCity.latitude,
      tooltipCity.longitude,
      indiaMap.bounds,
      indiaMap.viewBox,
    );
  }, [tooltipCity, indiaMap]);

  const VB = indiaMap?.viewBox ?? { w: 600, h: 700 };
  /** Extra SVG margin so northern tip / island glow is not flush with the frame. */
  const VB_PAD = 14;
  const svgViewBox = `${-VB_PAD} ${-VB_PAD} ${VB.w + VB_PAD * 2} ${VB.h + VB_PAD * 2}`;

  return (
    <section id="coverage" className="py-24 bg-[#0B1220] text-white relative overflow-hidden">
      <div
        className="pointer-events-none absolute top-1/2 left-[20%] -translate-y-1/2 h-[480px] w-[480px] rounded-full bg-[#ff6b2c]/12 blur-3xl"
        aria-hidden
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Coverage across India</h2>
          <p className="text-lg text-white/65">
            Cities with active SkillAd providers — sourced from live platform data.
          </p>
        </motion.div>

        {!loaded && (
          <div className="py-16 text-center text-sm text-white/50">Loading coverage…</div>
        )}

        {loaded && (
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-[#121a2b] to-[#0c1220] p-4 sm:p-6 shadow-[0_0_60px_-18px_rgba(255,107,44,0.4)] overflow-hidden"
            >
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden
              >
                <div className="h-[72%] w-[72%] rounded-full bg-[#ff6b2c]/18 blur-3xl" />
              </div>

              <div className="relative">
                {indiaMap ? (
                  <svg
                    viewBox={svgViewBox}
                    className="w-full h-auto max-h-[520px] mx-auto"
                    role="img"
                    aria-label="India coverage map with states"
                    preserveAspectRatio="xMidYMid meet"
                    overflow="visible"
                  >
                    <defs>
                      <filter id="india-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="3.2" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="dot-glow" x="-120%" y="-120%" width="340%" height="340%">
                        <feGaussianBlur stdDeviation="2.2" result="b" />
                        <feMerge>
                          <feMergeNode in="b" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <linearGradient id="india-fill" x1="30%" y1="15%" x2="70%" y2="90%">
                        <stop offset="0%" stopColor="#2a3348" />
                        <stop offset="55%" stopColor="#1a2233" />
                        <stop offset="100%" stopColor="#121826" />
                      </linearGradient>
                    </defs>

                    {/* National fill + SOI-style glowing outline (full northern claim) */}
                    {indiaMap.outline ? (
                      <>
                        <path
                          d={indiaMap.outline}
                          fill="rgba(255,107,44,0.35)"
                          filter="url(#india-glow)"
                          opacity="0.55"
                          aria-hidden
                        />
                        <path
                          d={indiaMap.outline}
                          fill="url(#india-fill)"
                          stroke="#ff6b2c"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                          filter="url(#india-glow)"
                        />
                      </>
                    ) : (
                      <g opacity="0.55" filter="url(#india-glow)" aria-hidden>
                        {drawableStates.map((s) => (
                          <path key={`glow-${s.name}`} d={s.d} fill="rgba(255,107,44,0.45)" />
                        ))}
                      </g>
                    )}

                    {/* Real state boundaries (subtle) */}
                    {drawableStates.map((s) => (
                      <path
                        key={s.name}
                        d={s.d}
                        fill="url(#india-fill)"
                        fillOpacity={indiaMap.outline ? 0.92 : 1}
                        stroke="rgba(255,120,40,0.18)"
                        strokeWidth="0.6"
                        strokeLinejoin="round"
                      />
                    ))}

                    {/* State labels (reference-style) */}
                    {labeledStates.map((s) => (
                      <text
                        key={`label-${s.name}`}
                        x={s.labelX!}
                        y={s.labelY!}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="pointer-events-none select-none"
                        fill="rgba(255,255,255,0.55)"
                        fontSize={
                          /Jammu|Ladakh|Rajasthan|Maharashtra|Madhya|Uttar Pradesh|Andhra|Karnataka|Tamil|Odisha|Gujarat|West Bengal|Bihar|Telangana|Chhattisgarh|Assam|Arunachal|Arunanchal/i.test(
                            s.name,
                          )
                            ? 9
                            : 7.5
                        }
                        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
                      >
                        {displayStateName(s.name)}
                      </text>
                    ))}

                    {/* Live provider cities from fetchCities() */}
                    {withCoords.map((c) => {
                      const { x, y } = project(
                        c.latitude!,
                        c.longitude!,
                        indiaMap.bounds,
                        indiaMap.viewBox,
                      );
                      const active =
                        selected?.name === c.name || hovered?.name === c.name;
                      return (
                        <g
                          key={c.name}
                          className="cursor-pointer"
                          onClick={() => setSelected(c)}
                          onMouseEnter={() => setHovered(c)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => setHovered(c)}
                          onBlur={() => setHovered(null)}
                          tabIndex={0}
                          role="button"
                          aria-label={`${c.name}: ${c.providerCount} providers`}
                        >
                          <circle
                            cx={x}
                            cy={y}
                            r={active ? 14 : 11}
                            fill="rgba(255,107,44,0.22)"
                            className="animate-pulse"
                          />
                          <circle
                            cx={x}
                            cy={y}
                            r={active ? 6.5 : 5}
                            fill="#ff6b2c"
                            stroke="#ffffff"
                            strokeWidth="1.3"
                            filter="url(#dot-glow)"
                          />
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <div className="py-24 text-center text-sm text-white/45">
                    Map geometry unavailable.
                  </div>
                )}

                <AnimatePresence>
                  {tooltipCity && tooltipPos && indiaMap && (
                    <motion.div
                      key={tooltipCity.name}
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      className="pointer-events-none absolute z-10 w-[min(240px,72vw)] rounded-2xl border border-[#ff6b2c]/40 bg-[#0f172a]/95 backdrop-blur-md px-3.5 py-3 shadow-[0_12px_40px_-10px_rgba(255,107,44,0.5)]"
                      style={{
                        left: `clamp(8px, ${((tooltipPos.x + VB_PAD) / (VB.w + VB_PAD * 2)) * 100}%, calc(100% - 252px))`,
                        top: `clamp(8px, ${((tooltipPos.y + VB_PAD) / (VB.h + VB_PAD * 2)) * 100}%, calc(100% - 130px))`,
                        transform: "translate(-50%, -115%)",
                      }}
                    >
                      <p className="font-semibold text-white text-sm">{tooltipCity.name}</p>
                      <p className="text-xs text-white/55 mt-0.5">
                        {tooltipCity.providerCount} provider
                        {tooltipCity.providerCount === 1 ? "" : "s"}
                        {tooltipCity.categoryCount > 0
                          ? ` · ${tooltipCity.categoryCount} categor${
                              tooltipCity.categoryCount === 1 ? "y" : "ies"
                            }`
                          : ""}
                      </p>
                      {tooltipCity.categories?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tooltipCity.categories.slice(0, 6).map((cat) => (
                            <span
                              key={cat}
                              className="text-[10px] rounded-full bg-[#ff6b2c]/15 text-[#ffb38a] px-2 py-0.5"
                            >
                              {cat}
                            </span>
                          ))}
                          {tooltipCity.categories.length > 6 && (
                            <span className="text-[10px] text-white/40 px-1">
                              +{tooltipCity.categories.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {cities.length === 0 && (
                <p className="relative mt-4 text-center text-xs text-white/45">
                  No provider cities yet — the map updates automatically as providers join.
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">
                Cities ({cities.length})
              </h3>

              {cities.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-[#121a2b] p-8 text-center text-sm text-white/45">
                  Coverage appears automatically as providers join SkillAd.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                  {cities.map((c, i) => {
                    const active = selected?.name === c.name;
                    const hasPin = withCoords.some((w) => w.name === c.name);
                    return (
                      <motion.button
                        type="button"
                        key={c.name}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3) }}
                        onClick={() => setSelected(c)}
                        onMouseEnter={() => hasPin && setHovered(c)}
                        onMouseLeave={() => setHovered(null)}
                        className={`group text-left rounded-2xl border p-4 transition-all duration-300 ${
                          active
                            ? "border-[#ff6b2c]/50 bg-[#ff6b2c]/10 shadow-[0_0_24px_-8px_rgba(255,107,44,0.55)] scale-[1.02]"
                            : "border-white/10 bg-[#121a2b] hover:border-[#ff6b2c]/30 hover:bg-[#161f32] hover:shadow-[0_8px_28px_-12px_rgba(255,107,44,0.4)] hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ff6b2c]/15 text-[#ff6b2c] transition-colors group-hover:bg-[#ff6b2c]/25">
                            <MapPin className="h-4 w-4" />
                          </span>
                          <span className="font-semibold text-white truncate">{c.name}</span>
                        </div>
                        <p className="text-xs text-white/45 pl-[42px] leading-relaxed">
                          {c.providerCount} provider{c.providerCount === 1 ? "" : "s"}
                          {c.categoryCount
                            ? ` · ${c.categoryCount} categor${c.categoryCount === 1 ? "y" : "ies"}`
                            : ""}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {withoutCoords.length > 0 && withCoords.length > 0 && (
                <p className="mt-4 text-xs text-white/40">
                  {withoutCoords.length} cit{withoutCoords.length === 1 ? "y" : "ies"} listed
                  without map coordinates.
                </p>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </section>
  );
}
