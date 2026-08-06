import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: number | string; sub?: string; icon: string; color: string;
}) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-bold mt-1`} style={{ color }}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
          style={{ backgroundColor: color + "20" }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

const COLORS = ["#FF6B35", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B"];

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStats()
      .then((d) => { setStats(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-8">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
        ⚠️ {error}
      </div>
    </div>
  );

  const s = stats;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-slate-400 text-sm mt-1">Real-time overview of your platform</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Providers" value={s.providers.total} sub={`${s.providers.active} active`} icon="👷" color="#FF6B35" />
        <StatCard label="Verified" value={s.providers.verified} sub="Approved providers" icon="✅" color="#10B981" />
        <StatCard label="Total Users" value={s.users.total} sub={`${s.users.active} active`} icon="👥" color="#3B82F6" />
        <StatCard label="Active Ads" value={s.ads.active} sub={`${s.ads.total} total`} icon="📢" color="#8B5CF6" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="New Contact Messages"
          value={s.contactMessages?.new ?? 0}
          sub="Unread inbox"
          icon="✉️"
          color="#F97316"
        />
      </div>

      {/* Earnings stats */}
      {s.earnings && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Lifetime Earnings"
            value={`₹${s.earnings.totalEarnings.toLocaleString("en-IN")}`}
            sub="All time"
            icon="💰"
            color="#F59E0B"
          />
          <StatCard
            label="Monthly Earnings"
            value={`₹${s.earnings.monthlyEarnings.toLocaleString("en-IN")}`}
            sub="Last 30 days"
            icon="📅"
            color="#10B981"
          />
          <StatCard
            label="Completed Jobs"
            value={s.earnings.completedJobs}
            sub={`${s.earnings.weeklyEarnings > 0 ? `₹${s.earnings.weeklyEarnings.toLocaleString("en-IN")} this week` : "0 this week"}`}
            icon="✅"
            color="#6366F1"
          />
          <StatCard
            label="Avg Job Value"
            value={s.earnings.avgJobValue > 0 ? `₹${s.earnings.avgJobValue.toLocaleString("en-IN")}` : "—"}
            sub="Per completed job"
            icon="📊"
            color="#EC4899"
          />
        </div>
      )}

      {/* Registration trend */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-400">New Today</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{s.providers.newToday}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-400">This Week</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{s.providers.newWeek}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-400">This Month</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{s.providers.newMonth}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top categories */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Providers by Category</h3>
          {s.topCategories.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No providers yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={s.topCategories} layout="vertical" margin={{ left: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #334155", borderRadius: 8, color: "#F1F5F9" }}
                  cursor={{ fill: "#334155" }}
                />
                <Bar dataKey="count" radius={4}>
                  {s.topCategories.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top locations */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Providers by Location</h3>
          {s.topLocations.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No providers yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={s.topLocations} layout="vertical" margin={{ left: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #334155", borderRadius: 8, color: "#F1F5F9" }}
                  cursor={{ fill: "#334155" }}
                />
                <Bar dataKey="count" radius={4}>
                  {s.topLocations.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-slate-400">
        <span className="text-blue-400 font-medium">ℹ️ Tip:</span> Use the sidebar to manage providers, categories, subscriptions, and more. All changes are reflected in the mobile app immediately.
      </div>
    </div>
  );
}
