import { useEffect, useState } from "react";
import { api } from "../lib/api";

const EVENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  send:        { bg: "bg-blue-500/15",    text: "text-blue-400",    label: "Sent" },
  resend:      { bg: "bg-indigo-500/15",  text: "text-indigo-400",  label: "Resent" },
  verify_ok:   { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Verified ✓" },
  verify_fail: { bg: "bg-red-500/15",     text: "text-red-400",     label: "Failed" },
  expired:     { bg: "bg-yellow-500/15",  text: "text-yellow-400",  label: "Expired" },
  blocked:     { bg: "bg-orange-500/15",  text: "text-orange-400",  label: "Blocked" },
};

interface LogEntry {
  ts: string;
  phone: string;
  event: string;
  detail?: string;
}

export default function OtpLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  async function load() {
    try {
      const d = await api.getOtpLogs() as any;
      setLogs(d.logs ?? []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  const filtered = filter === "all" ? logs : logs.filter((l) => l.event === filter);

  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.event] = (acc[l.event] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">OTP Logs</h2>
          <p className="text-slate-400 text-sm mt-1">Live monitoring — last {logs.length} events (in-memory, resets on server restart)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${autoRefresh ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
          >
            {autoRefresh ? "⏺ Auto-refresh ON" : "Auto-refresh OFF"}
          </button>
          <button
            onClick={load}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {Object.entries(EVENT_STYLES).map(([key, s]) => (
          <div key={key} className={`rounded-xl p-3 text-center ${s.bg} border border-white/5`}>
            <p className={`text-xl font-bold ${s.text}`}>{counts[key] ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {["all", "send", "resend", "verify_ok", "verify_fail", "expired", "blocked"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f
                ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {f === "all" ? `All (${logs.length})` : `${EVENT_STYLES[f]?.label} (${counts[f] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium text-slate-400">No OTP events yet</p>
            <p className="text-sm mt-1">Events appear here when users send or verify OTPs</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Phone</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Event</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => {
                const style = EVENT_STYLES[log.event] ?? { bg: "bg-slate-800", text: "text-slate-400", label: log.event };
                const d = new Date(log.ts);
                const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                return (
                  <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      <span className="text-slate-300">{timeStr}</span>
                      <span className="text-slate-600 text-xs ml-1">{dateStr}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{log.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{log.detail ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Environment variable instructions */}
      <div className="bg-slate-900 border border-orange-500/30 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔐</span>
          <h3 className="font-semibold text-white text-sm">MSG91 Environment Variables</h3>
        </div>
        <p className="text-xs text-slate-400">Add these to your Hostinger Node.js environment variables for the API server:</p>
        <div className="bg-slate-950 rounded-xl p-4 space-y-2 font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="text-orange-400">MSG91_API_KEY</span>
            <span className="text-slate-500">=</span>
            <span className="text-emerald-400">your_msg91_authkey_here</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-orange-400">MSG91_TEMPLATE_ID</span>
            <span className="text-slate-500">=</span>
            <span className="text-emerald-400">your_msg91_template_id_here</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-orange-400">NODE_ENV</span>
            <span className="text-slate-500">=</span>
            <span className="text-emerald-400">production</span>
          </div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
          💡 Once <span className="font-mono font-bold">MSG91_API_KEY</span> and <span className="font-mono font-bold">MSG91_TEMPLATE_ID</span> are set, all OTPs will be sent as real SMS. The demo bypass is fully removed — only real MSG91 OTPs will work.
        </div>
      </div>
    </div>
  );
}
