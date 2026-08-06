import { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";

const COLORS = ["#FF6B35", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899"];

interface RankedProvider {
  id: string;
  name: string;
  category: string;
  location: string;
  state: string;
  initials: string;
  avatarColor: string;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  totalEarnings: number;
  acceptedRequests: number;
  registeredAt: string | null;
  verified: boolean;
  available: boolean;
}

type SortDir = "desc" | "asc";

const TABS = [
  { id: "earnings",   label: "Top Earners",            icon: "💰", sortKey: "totalEarnings",    colLabel: "Total Earned" },
  { id: "rated",      label: "Highest Rated",          icon: "⭐", sortKey: "rating",           colLabel: "Rating" },
  { id: "completed",  label: "Most Completed Jobs",    icon: "✅", sortKey: "completedJobs",    colLabel: "Completed" },
  { id: "accepted",   label: "Most Accepted Requests", icon: "🤝", sortKey: "acceptedRequests", colLabel: "Accepted" },
  { id: "reviews",    label: "Most Reviews Received",  icon: "📝", sortKey: "reviewCount",      colLabel: "Reviews" },
  { id: "newest",     label: "Newest Providers",       icon: "🆕", sortKey: "registeredAt",     colLabel: "Joined" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function fmtRs(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

function Avatar({ p }: { p: RankedProvider }) {
  const [err, setErr] = useState(false);
  if (p.avatarUrl && !err) {
    return (
      <img
        src={p.avatarUrl}
        alt={p.name}
        className="w-9 h-9 rounded-full object-cover shrink-0"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ backgroundColor: p.avatarColor }}
    >
      {p.initials}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg leading-none">🥇</span>;
  if (rank === 2) return <span className="text-lg leading-none">🥈</span>;
  if (rank === 3) return <span className="text-lg leading-none">🥉</span>;
  return <span className="text-xs text-slate-400 font-mono w-6 text-right">{rank}</span>;
}

function exportCSV(rows: RankedProvider[], tab: typeof TABS[number]) {
  if (!rows.length) return;
  const cols: (keyof RankedProvider)[] = [
    "name", "category", "state", "location", "rating", "reviewCount",
    "completedJobs", "acceptedRequests", "totalEarnings", "registeredAt", "verified",
  ];
  const headers = cols.join(",");
  const csv = [
    headers,
    ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(",")),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `skilladd_rankings_${tab.id}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function Rankings() {
  const [activeTab, setActiveTab] = useState<TabId>("earnings");
  const [providers, setProviders] = useState<RankedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("All");

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getRankings()
      .then((res: { providers: RankedProvider[] }) => {
        setProviders(res.providers ?? []);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const tab = TABS.find((t) => t.id === activeTab)!;

  const uniqueStates = useMemo(() => {
    const s = new Set(providers.map((p) => p.state).filter(Boolean));
    return ["All", ...Array.from(s).sort()];
  }, [providers]);

  const sorted = useMemo(() => {
    let rows = [...providers];

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.state.toLowerCase().includes(q),
      );
    }

    if (stateFilter !== "All") {
      rows = rows.filter((p) => p.state === stateFilter);
    }

    const key = tab.sortKey as keyof RankedProvider;
    rows.sort((a, b) => {
      const av = a[key] as string | number | null;
      const bv = b[key] as string | number | null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      return sortDir === "desc"
        ? (bv as number) - (av as number)
        : (av as number) - (bv as number);
    });

    return rows;
  }, [providers, tab, sortDir, search, stateFilter]);

  function renderValue(p: RankedProvider) {
    switch (activeTab) {
      case "earnings":  return <span className="font-semibold text-emerald-400">{fmtRs(p.totalEarnings)}</span>;
      case "rated":     return <span className="font-semibold text-yellow-400">{p.rating ? `${p.rating.toFixed(1)} ★` : "—"}</span>;
      case "completed": return <span className="font-semibold text-blue-400">{p.completedJobs}</span>;
      case "accepted":  return <span className="font-semibold text-orange-400">{p.acceptedRequests}</span>;
      case "reviews":   return <span className="font-semibold text-purple-400">{p.reviewCount}</span>;
      case "newest":    return (
        <span className="text-slate-300 text-xs">
          {p.registeredAt ? new Date(p.registeredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </span>
      );
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-400 text-sm">{error}</div>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Provider Rankings</h2>
          <p className="text-slate-400 text-sm mt-1">
            Real data only — earnings, reviews, completed jobs, and booking stats
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {providers.length} PROVIDERS LOADED
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setSortDir("desc"); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === t.id
                ? "bg-orange-500 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
        <input
          type="text"
          placeholder="Search name, category, state…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 text-xs bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 placeholder-slate-500"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">📍 State:</span>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="text-xs bg-slate-800 text-white border border-slate-700 rounded-lg px-2 py-2 focus:outline-none focus:border-orange-500"
          >
            {uniqueStates.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Sort:</span>
          <button
            onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
            className="flex items-center gap-1.5 text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 hover:bg-slate-700 transition-colors"
          >
            {sortDir === "desc" ? "↓ High → Low" : "↑ Low → High"}
          </button>
        </div>
        <button
          onClick={() => exportCSV(sorted, tab)}
          className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 hover:bg-slate-700 transition-colors ml-auto"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Summary stats for this tab */}
      {providers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Providers", value: sorted.length, color: "#FF6B35", icon: "👷" },
            { label: "Total Earnings", value: fmtRs(sorted.reduce((s, p) => s + p.totalEarnings, 0)), color: "#10B981", icon: "💰" },
            { label: "Total Completed", value: sorted.reduce((s, p) => s + p.completedJobs, 0), color: "#3B82F6", icon: "✅" },
            { label: "Avg Rating", value: sorted.length ? (sorted.reduce((s, p) => s + p.rating, 0) / sorted.length).toFixed(1) + " ★" : "—", color: "#F59E0B", icon: "⭐" },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-xl mb-1">{stat.icon}</div>
              <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>{tab.icon}</span> {tab.label}
            <span className="text-xs text-slate-400 font-normal">— {sorted.length} providers</span>
          </h3>
        </div>

        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-slate-400 text-sm">No providers found</p>
            {search && <p className="text-slate-500 text-xs mt-1">Try clearing the search filter</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-slate-400 font-medium py-3 px-4 w-10">#</th>
                  <th className="text-left text-slate-400 font-medium py-3 px-4">Provider</th>
                  <th className="text-left text-slate-400 font-medium py-3 px-4">Category</th>
                  <th className="text-left text-slate-400 font-medium py-3 px-4">State</th>
                  <th className="text-right text-slate-400 font-medium py-3 px-4">{tab.colLabel}</th>
                  <th className="text-right text-slate-400 font-medium py-3 px-4">Earnings</th>
                  <th className="text-right text-slate-400 font-medium py-3 px-4">Rating</th>
                  <th className="text-right text-slate-400 font-medium py-3 px-4">Reviews</th>
                  <th className="text-right text-slate-400 font-medium py-3 px-4">Jobs Done</th>
                  <th className="text-center text-slate-400 font-medium py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center">
                        <RankBadge rank={i + 1} />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar p={p} />
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate max-w-36">{p.name}</p>
                          <p className="text-slate-500 text-[10px] truncate max-w-36">{(p.location ?? "").split(",")[0]}</p>
                        </div>
                        {p.verified && (
                          <span title="Verified" className="text-blue-400 text-xs shrink-0">✓</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-orange-400 whitespace-nowrap">{p.category || "—"}</td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{p.state || "—"}</td>
                    <td className="py-3 px-4 text-right">{renderValue(p)}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-medium">{fmtRs(p.totalEarnings)}</td>
                    <td className="py-3 px-4 text-right text-yellow-400">
                      {p.rating ? `${p.rating.toFixed(1)} ★` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-purple-400">{p.reviewCount}</td>
                    <td className="py-3 px-4 text-right text-blue-400">{p.completedJobs}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        p.available
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-slate-700 text-slate-400"
                      }`}>
                        {p.available ? "Active" : "Away"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Color legend for stats columns */}
      <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 px-1">
        {[
          { color: COLORS[0], label: "Current tab sort key" },
          { color: "#10B981", label: "Total Earnings (₹)" },
          { color: "#F59E0B", label: "Rating (avg)" },
          { color: "#8B5CF6", label: "Reviews count" },
          { color: "#3B82F6", label: "Completed jobs" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="ml-auto">Data sources: earnings.json · providers (Supabase + local) · messages table</span>
      </div>
    </div>
  );
}
