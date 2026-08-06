import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, CartesianGrid, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { api } from "../lib/api";

const COLORS = ["#FF6B35", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6", "#6366F1"];
const CHART_STYLE = { backgroundColor: "#1E293B", border: "1px solid #334155", borderRadius: 8, color: "#F1F5F9" };

const TABS = [
  { id: "live",     label: "Live Platform Data", icon: "🟢" },
  { id: "state",    label: "State Analytics",    icon: "📍" },
  { id: "demand",   label: "Demand Trends",      icon: "📈" },
  { id: "behavior", label: "User Behavior",      icon: "👥" },
  { id: "time",     label: "Time Reports",       icon: "🕐" },
  { id: "revenue",  label: "Revenue",            icon: "💰" },
];

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
    </span>
  );
}

function Card({ title, children, className = "", action }: {
  title: string; children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <LiveBadge />
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function KPICard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <LiveBadge />
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-white font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <p className="text-slate-500 text-sm text-center py-8">{msg}</p>;
}

function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function fmt(n: number) {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
function fmtRs(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

interface Provider {
  id: string; name: string; category?: string; location?: string; rating?: number;
  available?: boolean; verified?: boolean; suspended?: boolean; blocked?: boolean;
  registeredAt?: string;
}

export default function Analytics() {
  const [activeTab, setActiveTab]   = useState("live");
  const [providers, setProviders]   = useState<Provider[]>([]);
  const [loading, setLoading]       = useState(true);
  const [timePeriod, setTimePeriod] = useState<"monthly" | "quarterly">("monthly");

  // State Analytics
  const [stateList, setStateList]       = useState<string[]>(["All India"]);
  const [selState, setSelState]         = useState("All India");
  const [stateData, setStateData]       = useState<any>(null);
  const [stateLoading, setStateLoading] = useState(false);

  // Real analytics tabs
  const [demandData,   setDemandData]   = useState<any>(null);
  const [demandLoading, setDemandLoading] = useState(false);
  const [behaviorData, setBehaviorData] = useState<any>(null);
  const [behaviorLoading, setBehaviorLoading] = useState(false);
  const [timeData,     setTimeData]     = useState<any>(null);
  const [timeLoading,  setTimeLoading]  = useState(false);
  const [revenueData,  setRevenueData]  = useState<any>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  useEffect(() => {
    api.getProviders().then((res: { providers?: Provider[] }) => {
      setProviders(res.providers ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "state") return;
    setStateLoading(true);
    api.getStateAnalytics(selState)
      .then((data: any) => { setStateList(data.states ?? ["All India"]); setStateData(data); setStateLoading(false); })
      .catch(() => setStateLoading(false));
  }, [activeTab, selState]);

  useEffect(() => {
    if (activeTab !== "demand" || demandData) return;
    setDemandLoading(true);
    api.getDemandAnalytics()
      .then((data: any) => { setDemandData(data); setDemandLoading(false); })
      .catch(() => setDemandLoading(false));
  }, [activeTab, demandData]);

  useEffect(() => {
    if (activeTab !== "behavior" || behaviorData) return;
    setBehaviorLoading(true);
    api.getBehaviorAnalytics()
      .then((data: any) => { setBehaviorData(data); setBehaviorLoading(false); })
      .catch(() => setBehaviorLoading(false));
  }, [activeTab, behaviorData]);

  useEffect(() => {
    if (activeTab !== "time" || timeData) return;
    setTimeLoading(true);
    api.getTimeAnalytics()
      .then((data: any) => { setTimeData(data); setTimeLoading(false); })
      .catch(() => setTimeLoading(false));
  }, [activeTab, timeData]);

  useEffect(() => {
    if (activeTab !== "revenue" || revenueData) return;
    setRevenueLoading(true);
    api.getRevenueAnalytics()
      .then((data: any) => { setRevenueData(data); setRevenueLoading(false); })
      .catch(() => setRevenueLoading(false));
  }, [activeTab, revenueData]);

  // ── Live tab computed stats ──
  const realCategoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of providers) { if (p.category) map[p.category] = (map[p.category] ?? 0) + 1; }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [providers]);

  const realLocationBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of providers) {
      const city = (p.location ?? "Unknown").split(",")[0].trim();
      if (city) map[city] = (map[city] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [providers]);

  const realRegistrationTrend = useMemo(() => {
    const map: Record<string, number> = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      map[d.toISOString().slice(5, 10)] = 0;
    }
    for (const p of providers) {
      if (p.registeredAt) { const key = p.registeredAt.slice(5, 10); if (key in map) map[key]++; }
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [providers]);

  const realRatingBuckets = useMemo(() =>
    [1, 2, 3, 4, 5].map((r) => ({
      rating: `${r}★`,
      count: providers.filter((p) => Math.round((p as any).rating ?? 0) === r).length,
    })), [providers]);

  const realStatusData = useMemo(() => [
    { name: "Active",      value: providers.filter((p) => p.available && !p.suspended && !p.blocked).length, color: "#10B981" },
    { name: "Unavailable", value: providers.filter((p) => !p.available && !p.suspended && !p.blocked).length, color: "#F59E0B" },
    { name: "Suspended",   value: providers.filter((p) => p.suspended).length, color: "#EF4444" },
    { name: "Verified",    value: providers.filter((p) => p.verified).length, color: "#3B82F6" },
  ], [providers]);

  const avgRating = providers.length
    ? (providers.reduce((s, p) => s + ((p as any).rating ?? 0), 0) / providers.length).toFixed(1) : "—";
  const citiesCount = new Set(providers.map((p) => (p.location ?? "").split(",")[0].trim()).filter(Boolean)).size;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">SkillAd Platform Analytics</h2>
        <p className="text-slate-400 text-sm mt-1">Real data from your providers, bookings, earnings, ratings and reviews</p>
      </div>

      {/* Top KPIs */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Your Platform — Real Numbers</h3>
          <LiveBadge />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Registered Providers" value={providers.length}          sub="From providers + Supabase"  color="#FF6B35" icon="👷" />
          <KPICard label="Average Rating"        value={avgRating}                 sub="Across all providers"       color="#F59E0B" icon="⭐" />
          <KPICard label="Cities Active"         value={citiesCount}               sub="Unique locations"           color="#10B981" icon="📍" />
          <KPICard label="Categories Used"       value={realCategoryBreakdown.length} sub="Distinct service types"  color="#8B5CF6" icon="🗂️" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* ─── LIVE PLATFORM DATA ─── */}
      {activeTab === "live" && (
        <div className="space-y-5">
          {providers.length < 50 && (
            <div className="flex gap-3 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
              <span className="text-xl shrink-0">🟢</span>
              <div>
                <p className="text-sm font-semibold text-emerald-300">All data on this page is real</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  You have <strong className="text-white">{providers.length} registered providers</strong>.
                  Every chart reflects actual platform data. As more providers join and users make bookings, all charts here fill automatically.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Providers by Category" action={
              <button onClick={() => exportCSV("real_categories", realCategoryBreakdown)}
                className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">⬇ Export</button>
            }>
              {realCategoryBreakdown.length === 0 ? <EmptyState msg="No providers registered yet" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={realCategoryBreakdown} layout="vertical" margin={{ left: 8 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={CHART_STYLE} />
                    <Bar dataKey="count" name="Providers" radius={4}>
                      {realCategoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Card title="Providers by City" action={
              <button onClick={() => exportCSV("real_locations", realLocationBreakdown)}
                className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">⬇ Export</button>
            }>
              {realLocationBreakdown.length === 0 ? <EmptyState msg="No providers registered yet" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={realLocationBreakdown} layout="vertical" margin={{ left: 8 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={CHART_STYLE} />
                    <Bar dataKey="count" name="Providers" radius={4}>
                      {realLocationBreakdown.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
          <Card title="Daily Provider Registrations — Last 30 Days">
            {realRegistrationTrend.every((d) => d.count === 0) ? (
              <EmptyState msg="No registrations recorded yet with timestamps" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={realRegistrationTrend}>
                  <defs>
                    <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#FF6B35" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_STYLE} />
                  <Area type="monotone" dataKey="count" stroke="#FF6B35" fill="url(#regGrad)" strokeWidth={2} name="Registrations" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Rating Distribution">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={realRatingBuckets}>
                  <XAxis dataKey="rating" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_STYLE} />
                  <Bar dataKey="count" radius={4} fill="#F59E0B" name="Providers" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Provider Status Breakdown">
              {providers.length === 0 ? <EmptyState msg="No providers yet" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={realStatusData.filter((d) => d.value > 0)} cx="50%" cy="50%"
                      innerRadius={45} outerRadius={70} dataKey="value" nameKey="name">
                      {realStatusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={CHART_STYLE} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "#94A3B8", fontSize: 11 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
          <Card title={`All ${providers.length} Registered Providers`} action={
            <button onClick={() => exportCSV("all_providers", providers as unknown as Record<string, unknown>[])}
              className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">⬇ Export CSV</button>
          }>
            {providers.length === 0 ? <EmptyState msg="No providers registered yet" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-800">
                    {["Name", "Category", "City", "Rating", "Available", "Verified", "Registered"].map((h) => (
                      <th key={h} className="text-left text-slate-400 font-medium py-2 px-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {providers.map((p, i) => (
                      <tr key={p.id} className={`border-b border-slate-800/50 hover:bg-slate-800/40 ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}>
                        <td className="py-2 px-2 text-white font-medium whitespace-nowrap">{p.name}</td>
                        <td className="py-2 px-2 text-orange-400">{p.category ?? "—"}</td>
                        <td className="py-2 px-2 text-slate-300 whitespace-nowrap">{(p.location ?? "Unknown").split(",")[0]}</td>
                        <td className="py-2 px-2 text-yellow-400">{(p as any).rating ? `${(p as any).rating}★` : "No rating"}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.available ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                            {p.available ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.verified ? "bg-blue-500/15 text-blue-400" : "bg-slate-700 text-slate-400"}`}>
                            {p.verified ? "Verified" : "Pending"}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-400 whitespace-nowrap">
                          {p.registeredAt ? new Date(p.registeredAt).toLocaleDateString("en-IN") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── STATE ANALYTICS ─── */}
      {activeTab === "state" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-base">📍</span>
              <span className="text-sm font-semibold text-white">Select State:</span>
            </div>
            <select value={selState} onChange={(e) => setSelState(e.target.value)}
              className="text-sm bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500">
              {stateList.map((s) => <option key={s}>{s}</option>)}
            </select>
            <LiveBadge />
            {stateList.length > 1 && (
              <span className="text-xs text-slate-500 ml-auto">{stateList.length - 1} states detected from provider locations</span>
            )}
          </div>

          {stateLoading ? <Spinner /> : !stateData ? null : (() => {
            const s = stateData.stats ?? {};
            const cats: { name: string; count: number }[] = stateData.categoryBreakdown ?? [];
            const top: any[] = stateData.topProviders ?? [];
            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Providers",  value: fmt(s.totalProviders  ?? 0), color: "#FF6B35", icon: "👷" },
                    { label: "Active Providers", value: fmt(s.activeProviders ?? 0), color: "#10B981", icon: "✅" },
                    { label: "Total Customers",  value: fmt(s.totalCustomers  ?? 0), color: "#3B82F6", icon: "👥", sub: "from Supabase profiles" },
                    { label: "Verified",         value: fmt(s.verifiedProviders ?? 0), color: "#8B5CF6", icon: "🔵" },
                    { label: "Total Earnings",   value: fmtRs(s.totalEarnings ?? 0), color: "#F59E0B", icon: "💰" },
                    { label: "Completed Jobs",   value: fmt(s.completedJobs ?? 0),  color: "#14B8A6", icon: "📦" },
                    { label: "Average Rating",   value: s.avgRating ? `${s.avgRating} ★` : "—", color: "#F59E0B", icon: "⭐" },
                    { label: "Total Reviews",    value: fmt(s.totalReviews ?? 0),   color: "#EC4899", icon: "📝" },
                  ].map((k) => (
                    <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-1"><span className="text-xl">{k.icon}</span><LiveBadge /></div>
                      <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
                      <p className="text-xs text-white font-medium mt-0.5">{k.label}</p>
                      {"sub" in k && k.sub && <p className="text-[10px] text-slate-500 mt-0.5">{k.sub}</p>}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Card title={`Category Distribution — ${selState}`} action={
                    <button onClick={() => exportCSV(`state_cats_${selState}`, cats as unknown as Record<string, unknown>[])}
                      className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">⬇</button>
                  }>
                    {cats.length === 0 ? <EmptyState msg="No providers in this state" /> : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={cats.slice(0, 12)} layout="vertical" margin={{ left: 8 }}>
                          <XAxis type="number" allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={CHART_STYLE} />
                          <Bar dataKey="count" name="Providers" radius={4}>
                            {cats.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Card>
                  <Card title={`Top Performing Providers — ${selState}`} action={
                    <button onClick={() => exportCSV(`top_providers_${selState}`, top as unknown as Record<string, unknown>[])}
                      className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">⬇</button>
                  }>
                    {top.length === 0 ? <EmptyState msg="No providers in this state" /> : (
                      <div className="space-y-2 overflow-y-auto max-h-60">
                        {top.map((p: any, i: number) => (
                          <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition-colors">
                            <span className="text-xs text-slate-500 w-5 text-right shrink-0">{i + 1}</span>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ backgroundColor: p.avatarColor ?? "#64748B" }}>
                              {p.initials ?? p.name?.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{p.name}</p>
                              <p className="text-[10px] text-orange-400 truncate">{p.category}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold text-emerald-400">{fmtRs(p.totalEarnings)}</p>
                              <p className="text-[10px] text-yellow-400">{p.rating ? `${Number(p.rating).toFixed(1)} ★` : "No rating"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
                {s.totalProviders === 0 && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-2xl text-xs text-blue-300">
                    No providers found in <strong>{selState}</strong>. Provider locations are parsed from the location field
                    (e.g. "Agartala, Tripura" → state = Tripura). As more providers register, data will appear here automatically.
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ─── DEMAND TRENDS ─── */}
      {activeTab === "demand" && (
        <div className="space-y-5">
          {demandLoading ? <Spinner /> : !demandData ? (
            <EmptyState msg="Could not load demand analytics" />
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Category Demand Rankings */}
                <Card title="Service Category Rankings" action={
                  <button onClick={() => exportCSV("category_demand", demandData.categoryDemand)}
                    className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">⬇</button>
                }>
                  {demandData.categoryDemand.length === 0 ? <EmptyState msg="No providers registered yet" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={demandData.categoryDemand} layout="vertical" margin={{ left: 8 }}>
                        <XAxis type="number" allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={CHART_STYLE} formatter={(v: any, name: string) => [v, name === "providers" ? "Providers" : name === "bookings" ? "Bookings" : "Reviews"]} />
                        <Bar dataKey="providers" name="providers" stackId="a" radius={[0,4,4,0]} fill="#FF6B35" />
                        <Bar dataKey="bookings"  name="bookings"  stackId="a" fill="#3B82F6" />
                        <Bar dataKey="reviews"   name="reviews"   stackId="a" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <div className="flex gap-4 mt-2 flex-wrap">
                    {[["#FF6B35","Providers"],["#3B82F6","Bookings"],["#10B981","Reviews"]].map(([c,l]) => (
                      <div key={l} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: c }} />
                        <span className="text-[10px] text-slate-400">{l}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* YoY Provider Growth */}
                <Card title="Year-on-Year Provider Growth by Category">
                  {demandData.categoryDemand.length === 0 ? <EmptyState msg="No providers registered yet" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[...demandData.categoryDemand].sort((a: any, b: any) => b.yoyGrowth - a.yoyGrowth)} layout="vertical" margin={{ left: 8 }}>
                        <XAxis type="number" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={CHART_STYLE} formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}%`, "YoY Growth"]} />
                        <Bar dataKey="yoyGrowth" name="yoyGrowth" radius={4}>
                          {[...demandData.categoryDemand].sort((a: any, b: any) => b.yoyGrowth - a.yoyGrowth).map((d: any) => (
                            <Cell key={d.name} fill={d.yoyGrowth > 0 ? "#10B981" : d.yoyGrowth < 0 ? "#EF4444" : "#94A3B8"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </div>

              {/* Monthly Booking Activity */}
              <Card title="Monthly Booking Activity — Last 12 Months" action={
                <button onClick={() => exportCSV("monthly_bookings", demandData.monthlyActivity)}
                  className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">⬇</button>
              }>
                {demandData.monthlyActivity.every((m: any) => m.bookings === 0) ? (
                  <EmptyState msg="No booking requests recorded yet. Bookings will appear here as customers contact providers." />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={demandData.monthlyActivity}>
                      <defs>
                        <linearGradient id="bkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={CHART_STYLE} />
                      <Area type="monotone" dataKey="bookings" stroke="#3B82F6" fill="url(#bkGrad)" strokeWidth={2} name="Booking Requests" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Card>

              {/* Platform Insights */}
              <Card title="📊 Platform Insights">
                {demandData.autoInsights.length === 0 ? <EmptyState msg="No insights available yet" /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {demandData.autoInsights.map((ins: any, i: number) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950">
                        <span className="text-xl shrink-0">{ins.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white mb-0.5">{ins.title}</p>
                          <p className="text-xs text-slate-400 leading-relaxed">{ins.detail}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium h-fit ${
                          ins.urgency === "high"   ? "bg-red-500/15 text-red-400" :
                          ins.urgency === "medium" ? "bg-orange-500/15 text-orange-400" :
                          "bg-slate-700 text-slate-400"
                        }`}>{ins.urgency}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─── USER BEHAVIOR ─── */}
      {activeTab === "behavior" && (
        <div className="space-y-5">
          {behaviorLoading ? <Spinner /> : !behaviorData ? (
            <EmptyState msg="Could not load behavior analytics" />
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard label="Booking Completion Rate" value={`${behaviorData.completionRate}%`}   color="#10B981" icon="✅" sub={`${behaviorData.completedBookings} of ${behaviorData.totalBookings} bookings`} />
                <KPICard label="Total Booking Requests"  value={fmt(behaviorData.totalBookings)}     color="#3B82F6" icon="📋" sub="All-time booking messages" />
                <KPICard label="Total Messages"          value={fmt(behaviorData.totalMessages)}     color="#8B5CF6" icon="💬" sub="All platform messages" />
                <KPICard label="Completed Bookings"      value={fmt(behaviorData.completedBookings)} color="#F59E0B" icon="🎯" sub="Customer confirmed" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Most Booked Categories */}
                <Card title="Most Booked Service Categories">
                  {behaviorData.mostContacted.length === 0 ? (
                    <EmptyState msg="No booking requests recorded yet" />
                  ) : (
                    <div className="space-y-3">
                      {behaviorData.mostContacted.map((s: any, i: number) => (
                        <div key={s.category} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-4 text-right shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-medium text-white">{s.category}</span>
                              <span className="text-xs text-slate-400 ml-2 shrink-0">{s.count} booking{s.count !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{
                                width: `${(s.count / (behaviorData.mostContacted[0]?.count || 1)) * 100}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                              }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Peak Hours */}
                <Card title="Message Activity by Time of Day">
                  {behaviorData.totalMessages === 0 ? (
                    <EmptyState msg="No messages recorded yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={behaviorData.peakHours}>
                        <XAxis dataKey="hour" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={CHART_STYLE} formatter={(v: number, _: any, props: any) => [props.payload.count + " messages", "Activity"]} />
                        <Bar dataKey="activity" radius={6}>
                          {behaviorData.peakHours.map((h: any) => (
                            <Cell key={h.hour} fill={h.activity === 100 ? "#FF6B35" : h.activity >= 60 ? "#F59E0B" : "#3B82F6"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </div>

              {/* Category Engagement Radar */}
              <Card title="Category Engagement — Providers vs Bookings vs Reviews">
                {behaviorData.categoryEngagement.length === 0 ? (
                  <EmptyState msg="No category data available yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={behaviorData.categoryEngagement}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="category" tick={{ fill: "#94A3B8", fontSize: 10 }} />
                      <Radar name="Providers" dataKey="providers" stroke="#FF6B35" fill="#FF6B35" fillOpacity={0.2} />
                      <Radar name="Bookings"  dataKey="bookings"  stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                      <Radar name="Reviews"   dataKey="reviews"   stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
                      <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "#94A3B8", fontSize: 10 }}>{v}</span>} />
                      <Tooltip contentStyle={CHART_STYLE} formatter={(v: number, name: string, props: any) => {
                        const raw = name === "Providers" ? props.payload.rawProviders : name === "Bookings" ? props.payload.rawBookings : props.payload.rawReviews;
                        return [`${raw} (${v} index)`, name];
                      }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
                <p className="text-[10px] text-slate-500 mt-2">Index 0–100 normalised per metric. Hover for raw counts.</p>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─── TIME REPORTS ─── */}
      {activeTab === "time" && (
        <div className="space-y-5">
          {timeLoading ? <Spinner /> : !timeData ? (
            <EmptyState msg="Could not load time analytics" />
          ) : (
            <>
              <div className="flex items-center gap-3">
                {(["monthly", "quarterly"] as const).map((p) => (
                  <button key={p} onClick={() => setTimePeriod(p)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${timePeriod === p ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                    {p === "monthly" ? "Monthly" : "Quarterly"}
                  </button>
                ))}
                <button onClick={() => exportCSV(`${timePeriod}_report`,
                  (timePeriod === "monthly" ? timeData.monthly : timeData.quarterly) as Record<string, unknown>[])}
                  className="ml-auto text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">
                  ⬇ Export Report
                </button>
              </div>

              {(() => {
                const rows = timePeriod === "monthly" ? timeData.monthly : timeData.quarterly;
                const xKey = timePeriod === "monthly" ? "label" : "quarter";
                const hasRegs  = rows.some((r: any) => r.registrations > 0);
                const hasBooks = rows.some((r: any) => r.bookings > 0);
                const hasEarn  = rows.some((r: any) => r.earnings > 0);
                return (
                  <>
                    {/* Registration Growth */}
                    <Card title={`Provider Registrations — ${timePeriod === "monthly" ? "Last 12 Months" : "Last 4 Quarters"}`}>
                      {!hasRegs ? <EmptyState msg="No provider registrations recorded with timestamps yet" /> : (
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={rows}>
                            <defs>
                              <linearGradient id="reg2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#FF6B35" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey={xKey} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={CHART_STYLE} />
                            <Area type="monotone" dataKey="registrations" stroke="#FF6B35" fill="url(#reg2)" strokeWidth={2} name="Registrations" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <Card title="Booking Requests Trend">
                        {!hasBooks ? <EmptyState msg="No booking requests recorded yet" /> : (
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={rows}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey={xKey} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                              <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={CHART_STYLE} />
                              <Line type="monotone" dataKey="bookings" stroke="#3B82F6" strokeWidth={2} dot={{ fill: "#3B82F6", r: 3 }} name="Bookings" />
                              <Line type="monotone" dataKey="completedBookings" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981", r: 3 }} name="Completed" />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </Card>
                      <Card title="Earnings Trend">
                        {!hasEarn ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-2">
                            <EmptyState msg="No earnings recorded yet" />
                            <p className="text-[10px] text-slate-600 text-center px-4">Earnings will appear here once providers complete paid bookings. Enable subscriptions in the Subscriptions section to start earning.</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={rows}>
                              <defs>
                                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey={xKey} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                              <Tooltip contentStyle={CHART_STYLE} formatter={(v: number) => [fmtRs(v), "Earnings"]} />
                              <Area type="monotone" dataKey="earnings" stroke="#F59E0B" fill="url(#earnGrad)" strokeWidth={2} name="Earnings" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </Card>
                    </div>

                    {/* Report Table */}
                    <Card title="Detailed Report" action={
                      <button onClick={() => exportCSV(`${timePeriod}_table`, rows as Record<string, unknown>[])}
                        className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">⬇ Export</button>
                    }>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-slate-800">
                            {[timePeriod === "monthly" ? "Month" : "Quarter", "Registrations", "Bookings", "Completed", "Earnings"].map((h) => (
                              <th key={h} className="text-left text-slate-400 font-medium py-2 px-3 whitespace-nowrap">{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {rows.map((row: any, i: number) => (
                              <tr key={i} className={`border-b border-slate-800/50 hover:bg-slate-800/40 ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}>
                                <td className="py-2 px-3 text-white font-medium">{String(row[xKey])}</td>
                                <td className="py-2 px-3 text-orange-400 font-medium">{fmt(row.registrations)}</td>
                                <td className="py-2 px-3 text-blue-400 font-medium">{fmt(row.bookings)}</td>
                                <td className="py-2 px-3 text-emerald-400 font-medium">{fmt(row.completedBookings)}</td>
                                <td className="py-2 px-3 text-yellow-400 font-medium">{fmtRs(row.earnings)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ─── REVENUE ─── */}
      {activeTab === "revenue" && (
        <div className="space-y-5">
          {revenueLoading ? <Spinner /> : !revenueData ? (
            <EmptyState msg="Could not load revenue analytics" />
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard label="Subscription Plans"    value={revenueData.plans.length}                            color="#FF6B35" icon="📋" sub="Configured in plans.json" />
                <KPICard label="Total Plan Revenue"    value={fmtRs(revenueData.totalPlanRevenue)}                color="#10B981" icon="💳" sub={revenueData.subscriptionsEnabled ? "Active" : "Subscriptions not yet enabled"} />
                <KPICard label="Total Ads"             value={revenueData.totalAds}                               color="#F59E0B" icon="📢" sub={`${revenueData.activeAds} active`} />
                <KPICard label="Ad Revenue"            value="₹0"                                                 color="#8B5CF6" icon="📊" sub="Tracking not yet enabled" />
              </div>

              {!revenueData.subscriptionsEnabled && (
                <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
                  <span className="text-xl shrink-0">💡</span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-amber-300">Subscriptions not yet enabled.</strong> Plan pricing is configured (see below), but no payments are active.
                    Enable payment gateway in the <strong className="text-white">Subscriptions</strong> section to start collecting subscription revenue.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Plan pricing */}
                <Card title="Subscription Plans — Pricing Configuration">
                  {revenueData.plans.length === 0 ? <EmptyState msg="No plans configured in plans.json" /> : (
                    <div className="space-y-3">
                      {revenueData.plans.map((plan: any, i: number) => (
                        <div key={plan.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <div>
                              <p className="text-xs font-semibold text-white">{plan.name}</p>
                              <p className="text-[10px] text-slate-500">{plan.subscribers} active subscribers</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-400">{fmtRs(plan.price)}</p>
                            <p className="text-[10px] text-slate-500">per period</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Ads per month */}
                <Card title="Advertisements Created — Last 12 Months" action={
                  <button onClick={() => exportCSV("ads_monthly", revenueData.adsMonthly)}
                    className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-700">⬇</button>
                }>
                  {revenueData.adsMonthly.every((m: any) => m.count === 0) ? (
                    <EmptyState msg="No ads created yet (or no creation dates recorded)" />
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={revenueData.adsMonthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={CHART_STYLE} formatter={(v: number) => [v, "Ads Created"]} />
                        <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Ads" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </div>

              {/* Commercial Roadmap */}
              <Card title="📦 Revenue Streams — Road Map">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { icon: "💳", title: "Provider Subscriptions", desc: "Monthly/quarterly plans for providers to appear in search. Enable payment gateway in Subscriptions." },
                    { icon: "📢", title: "Banner Advertisements", desc: "Businesses pay to feature their ads in the app. Add pricing tracking in the Advertisements section." },
                    { icon: "🏢", title: "Enterprise Analytics API", desc: "Sell real-time demand data to businesses and agencies." },
                    { icon: "📊", title: "State Intelligence Reports", desc: "Monthly state-wise PDF reports on skill demand and hiring trends." },
                    { icon: "🎯", title: "Featured Provider Listings", desc: "Providers pay for top placement in search results and category pages." },
                    { icon: "🔔", title: "Demand Alert Subscriptions", desc: "Real-time alerts when demand spikes in specific areas or categories." },
                  ].map((p) => (
                    <div key={p.title} className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-800/30">
                      <span className="text-xl">{p.icon}</span>
                      <p className="text-xs font-semibold text-white mt-2 mb-1">{p.title}</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{p.desc}</p>
                      <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">Set Up</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
