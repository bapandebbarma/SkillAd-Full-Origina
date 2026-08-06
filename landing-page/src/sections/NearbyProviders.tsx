import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Star, MessageCircle, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchCities,
  fetchNearbyProviders,
  fetchProvidersByCity,
  fetchSettings,
  type CityCoverage,
  type NearbyProvider,
} from "@/lib/api";

interface NearbyProvidersProps {
  onViewProfile: (providerId?: string) => void;
}

type Mode = "geo" | "city" | "loading";

export default function NearbyProviders({ onViewProfile }: NearbyProvidersProps) {
  const [mode, setMode] = useState<Mode>("loading");
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<CityCoverage[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [error, setError] = useState("");

  const loadByCity = useCallback(async (city: string) => {
    if (!city.trim()) {
      setProviders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const urlHint = `/api/providers?city=${encodeURIComponent(city.trim())}`;
      console.info("[NearbyProviders] request", urlHint);
      const list = await fetchProvidersByCity(city.trim());
      console.info("[NearbyProviders] response", { count: list.length, city: city.trim() });
      setProviders(list);
    } catch (e) {
      console.warn("[NearbyProviders] city request failed", e);
      setProviders([]);
      setError("Could not load providers for this city.");
    } finally {
      setLoading(false);
    }
  }, []);

  const initCityFallback = useCallback(async () => {
    setMode("city");
    setLoading(true);
    setError("");
    try {
      // Cities list is optional (dropdown). defaultCity from settings is enough to load providers.
      const [cityListResult, settingsResult] = await Promise.allSettled([
        fetchCities(),
        fetchSettings(),
      ]);

      const cityList =
        cityListResult.status === "fulfilled" ? cityListResult.value : [];
      const settings =
        settingsResult.status === "fulfilled" ? settingsResult.value : null;

      if (cityListResult.status === "rejected") {
        console.warn(
          "[NearbyProviders] GET /api/cities failed — continuing with settings.defaultCity",
          cityListResult.reason,
        );
      }

      setCities(cityList);
      const preferred =
        settings?.defaultCity?.trim() ||
        cityList[0]?.name ||
        "";
      setSelectedCity(preferred);

      if (preferred) {
        await loadByCity(preferred);
      } else {
        setProviders([]);
        setLoading(false);
        if (!settings) {
          setError("Could not load city list.");
        }
      }
    } catch (e) {
      console.warn("[NearbyProviders] city fallback failed", e);
      setProviders([]);
      setLoading(false);
      setError("Could not load city list.");
    }
  }, [loadByCity]);

  useEffect(() => {
    let cancelled = false;

    if (!navigator.geolocation) {
      void initCityFallback();
      return () => {
        cancelled = true;
      };
    }

    setMode("loading");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const urlHint = `/api/providers?lat=${lat}&lng=${lng}`;
        console.info("[NearbyProviders] geo request", urlHint, { lat, lng });
        setMode("geo");
        try {
          const list = await fetchNearbyProviders(lat, lng);
          console.info("[NearbyProviders] geo response", { count: list.length, lat, lng });
          if (cancelled) return;
          if (list.length > 0) {
            setProviders(list);
            setLoading(false);
            return;
          }
          // Geo succeeded but no providers cover this point — use city fallback (same discovery rules).
          console.info(
            "[NearbyProviders] geo returned 0 providers; falling back to city",
          );
          await initCityFallback();
        } catch (e) {
          console.warn("[NearbyProviders] geo request failed; falling back to city", e);
          if (!cancelled) await initCityFallback();
        }
      },
      (geoErr) => {
        console.info("[NearbyProviders] geolocation unavailable", geoErr?.message);
        if (!cancelled) void initCityFallback();
      },
      { enableHighAccuracy: false, timeout: 12000 },
    );

    return () => {
      cancelled = true;
    };
  }, [initCityFallback]);

  function onCityChange(city: string) {
    setSelectedCity(city);
    void loadByCity(city);
  }

  return (
    <section id="nearby" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Providers near you
            </h2>
            <p className="text-lg text-muted-foreground">
              {mode === "geo"
                ? "Verified professionals whose service area covers your current location."
                : "Browse real providers by city when location access is unavailable."}
            </p>
          </div>

          {mode === "city" && (
            <div className="shrink-0">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">City</label>
              <select
                value={selectedCity}
                onChange={(e) => onCityChange(e.target.value)}
                className="min-w-[12rem] rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
              >
                {cities.length === 0 && selectedCity ? (
                  <option value={selectedCity}>{selectedCity}</option>
                ) : null}
                {cities.length === 0 && !selectedCity && (
                  <option value="">No cities available yet</option>
                )}
                {cities.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                    {c.providerCount > 0 ? ` ({c.providerCount})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {mode === "geo" ? "Finding providers near you…" : "Loading providers…"}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-border bg-muted/30 p-12 text-center text-sm text-muted-foreground">
            {error}
          </div>
        )}

        {!loading && !error && providers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <MapPin className="h-10 w-10 text-primary mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">No providers found</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {mode === "city" && selectedCity
                ? `No providers available in this city yet.`
                : "No providers available in this area yet."}
            </p>
          </div>
        )}

        {!loading && providers.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {providers.slice(0, 9).map((p, i) => (
              <motion.div
                key={p.id}
                className="rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
                    style={{ background: p.avatarColor || "#ff6b2c" }}
                  >
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      p.initials || p.name?.[0] || "?"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                      {typeof p.available === "boolean" && (
                        <span
                          className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            p.available
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {p.available ? "Available" : "Busy"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{p.category || "Provider"}</p>
                    {typeof p.distance === "number" && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {p.distance} km away
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4 text-sm">
                  {typeof p.rating === "number" && p.rating > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium">{p.rating}</span>
                      {typeof p.reviewCount === "number" && (
                        <span className="text-muted-foreground text-xs">({p.reviewCount})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No ratings yet</span>
                  )}
                  {typeof p.experience === "number" && p.experience > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {p.experience} yr{p.experience === 1 ? "" : "s"} exp.
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" variant="outline" className="rounded-xl px-2" onClick={() => onViewProfile(p.id)}>
                    <User className="mr-1 h-3.5 w-3.5" />
                    Profile
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl px-2" onClick={() => onViewProfile(p.id)}>
                    <MessageCircle className="mr-1 h-3.5 w-3.5" />
                    Chat
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl px-2" onClick={() => onViewProfile(p.id)}>
                    <Phone className="mr-1 h-3.5 w-3.5" />
                    Call
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
