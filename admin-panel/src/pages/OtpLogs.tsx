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
  id?: string;
  ts: string;
  phone: string;
  event: string;
  detail?: string | null;
  channel?: string | null;
  provider?: string;
  success?: boolean;
}

interface OtpConfig {
  msg91Configured: boolean;
  templateConfigured: boolean;
  apiKeyConfigured: boolean;
  otpTestMode: boolean;
  nodeEnv: string;
  isProduction: boolean;
  provider: string;
}

export default function OtpLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<string>("persistent");
  const [warning, setWarning] = useState<string>("");
  const [config, setConfig] = useState<OtpConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  async function load() {
    try {
      const [d, c] = await Promise.all([
        api.getOtpLogs({ event: filter === "all" ? undefined : filter, limit: 100 }),
        api.getOtpConfig(),
      ]);
      setLogs((d.logs ?? []) as LogEntry[]);
      setTotal(d.total ?? 0);
      setSource(String(d.source ?? "persistent"));
      setWarning(String(d.warning ?? ""));
      setConfig(c as OtpConfig);
    } catch {
      /* keep previous */
    }
    setLoading(false);
  }

  useEffect(() => { setLoading(true); void load(); }, [filter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => void load(), 5000);
    return () => clearInterval(iv);
  }, [autoRefresh, filter]);

  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.event] = (acc[l.event] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">OTP Logs</h2>
          <p className="text-slate-400 text-sm mt-1">
            Persistent audit — {total} event{total === 1 ? "" : "s"}
            {source !== "persistent" ? ` (showing ${source})` : " (survives API restart)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${autoRefresh ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
          >
            {autoRefresh ? "⏺ Auto-refresh ON" : "Auto-refresh OFF"}
          </button>
          <button
            onClick={() => { setLoading(true); void load(); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {warning && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {warning}
        </div>
      )}

      {/* Safe MSG91 status — never shows secret values */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔐</span>
          <h3 className="font-semibold text-white text-sm">MSG91 configuration status</h3>
        </div>
        {config ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <StatusPill label="MSG91 configured" ok={config.msg91Configured} />
            <StatusPill label="API key set" ok={config.apiKeyConfigured} />
            <StatusPill label="Template set" ok={config.templateConfigured} />
            <StatusPill label="Production NODE_ENV" ok={config.isProduction} />
            <StatusPill label="OTP test mode" ok={!config.otpTestMode} invertWarn />
            <div className="rounded-xl px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-slate-400">
              Provider: <span className="text-slate-200">{config.provider}</span>
              <br />
              NODE_ENV: <span className="text-slate-200">{config.nodeEnv}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Loading configuration status…</p>
        )}
        <p className="text-xs text-slate-500">
          Secret values (API keys, template IDs, service-role keys) are never sent to the Admin Panel.
          Configure MSG91_API_KEY and MSG91_TEMPLATE_ID on the Hostinger API server only.
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {Object.entries(EVENT_STYLES).map(([key, s]) => (
          <div key={key} className={`rounded-xl p-3 text-center ${s.bg} border border-white/5`}>
            <p className={`text-xl font-bold ${s.text}`}>{counts[key] ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

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
            {f === "all" ? `All (${total})` : `${EVENT_STYLES[f]?.label} (${counts[f] ?? 0})`}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium text-slate-400">No OTP events yet</p>
            <p className="text-sm mt-1">Events appear after users send or verify OTPs (and after the otp_audit_logs migration is applied)</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Phone</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Event</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Provider</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const style = EVENT_STYLES[log.event] ?? { bg: "bg-slate-800", text: "text-slate-400", label: log.event };
                const d = new Date(log.ts);
                const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                return (
                  <tr key={log.id ?? `${log.ts}-${i}`} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
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
                    <td className="px-4 py-3 text-slate-500 text-xs">{log.provider ?? "MSG91"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{log.detail ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusPill({
  label,
  ok,
  invertWarn,
}: {
  label: string;
  ok: boolean;
  invertWarn?: boolean;
}) {
  const good = invertWarn ? ok : ok;
  const warn = invertWarn && !ok;
  return (
    <div
      className={`rounded-xl px-3 py-2 border text-xs ${
        warn
          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
          : good
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
      }`}
    >
      <p className="font-medium">{label}</p>
      <p className="mt-0.5 opacity-90">
        {invertWarn ? (ok ? "Off (good)" : "ON — disable for production") : ok ? "Yes" : "No"}
      </p>
    </div>
  );
}
