import { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  expired: "bg-red-500/15 text-red-400 border border-red-500/30",
  suspended: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  none: "bg-slate-700/50 text-slate-400 border border-slate-600",
  pending: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-400 border border-red-500/30",
  clarification_requested: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
};

function StatusBadge({ status }: { status: string }) {
  const label = status === "clarification_requested" ? "Clarify?" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLE[status] ?? STATUS_STYLE.none}`}>
      {label}
    </span>
  );
}

function Toast({ msg, onClear }: { msg: string | null; onClear: () => void }) {
  useEffect(() => { if (msg) { const t = setTimeout(onClear, 3500); return () => clearTimeout(t); } }, [msg]);
  if (!msg) return null;
  return (
    <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl max-w-xs">
      {msg}
    </div>
  );
}

// ── Override modal ────────────────────────────────────────────────────────────
function OverrideModal({
  provider, onClose, onSaved,
}: {
  provider: any;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [action, setAction] = useState<string>("extend");
  const [days, setDays] = useState("30");
  const [customDate, setCustomDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const body: any = { action, reason };
      if (action === "extend" || action === "grant_free") body.days = Number(days) || 30;
      if (action === "set_date") body.endDate = customDate;
      await api.overrideSubscription(provider.id, body);
      onSaved(`Subscription updated for ${provider.name}.`);
      onClose();
    } catch (e: any) {
      onSaved(`Error: ${e.message}`);
      setSaving(false);
    }
  }

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Override Subscription</h3>
            <p className="text-slate-400 text-sm mt-0.5">{provider.name} · {provider.phone}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-400">Current status</span><StatusBadge status={provider.status} /></div>
          <div className="flex justify-between"><span className="text-slate-400">Expiry</span><span className="text-white">{fmtDate(provider.endDate)}</span></div>
          {provider.daysLeft !== null && (
            <div className="flex justify-between"><span className="text-slate-400">Days left</span><span className={provider.daysLeft <= 7 ? "text-red-400 font-medium" : "text-white"}>{provider.daysLeft}</span></div>
          )}
        </div>

        {/* Action selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Action</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "extend", label: "➕ Extend by Days" },
              { v: "set_date", label: "📅 Set Expiry Date" },
              { v: "activate", label: "✅ Reactivate" },
              { v: "suspend", label: "⏸ Suspend" },
              { v: "grant_free", label: "🎁 Grant Free Access" },
            ].map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setAction(v)}
                className={`text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${action === v ? "bg-orange-500/15 border-orange-500/50 text-orange-300" : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {(action === "extend" || action === "grant_free") && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Days</label>
            <div className="flex gap-2">
              {[30, 60, 90, 180, 365].map((d) => (
                <button key={d} onClick={() => setDays(String(d))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${days === String(d) ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                  {d}
                </button>
              ))}
            </div>
            <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
          </div>
        )}

        {action === "set_date" && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">New Expiry Date</label>
            <input type="date" min={tomorrow} value={customDate} onChange={(e) => setCustomDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Reason / Notes <span className="normal-case text-slate-500">(optional)</span></label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Approved manual payment, free extension"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-500 placeholder:text-slate-600" />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 bg-slate-800 border border-slate-700 hover:border-slate-600">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || (action === "set_date" && !customDate)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}
          >
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Apply Change"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Audit drawer ─────────────────────────────────────────────────────────────
function AuditDrawer({ providerId, providerName, onClose }: { providerId: string; providerName: string; onClose: () => void }) {
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSubscriptionAudit(providerId).then((d: any) => {
      setAudit(d.audit ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [providerId]);

  const ACTION_LABEL: Record<string, string> = {
    extend: "Extended", set_date: "Date Set", activate: "Activated", suspend: "Suspended",
    grant_free: "Free Access", approve_renewal: "Renewal Approved", reject_renewal: "Renewal Rejected",
    clarify_renewal: "Clarification Requested", expiry_check: "Auto-Expired",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="text-white font-bold">Audit Trail</h3>
            <p className="text-slate-400 text-xs mt-0.5">{providerName}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : audit.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No audit history for this provider.</p>
          ) : audit.map((a: any) => (
            <div key={a.id} className="bg-slate-800/60 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{ACTION_LABEL[a.action] ?? a.action}</span>
                <span className="text-slate-500 text-xs">{fmtDateTime(a.timestamp)}</span>
              </div>
              {a.oldEndDate && <div className="text-slate-400">Old expiry: <span className="text-slate-300">{fmtDate(a.oldEndDate)}</span></div>}
              {a.newEndDate && <div className="text-slate-400">New expiry: <span className="text-emerald-400 font-medium">{fmtDate(a.newEndDate)}</span></div>}
              {a.days && <div className="text-slate-400">Days: <span className="text-slate-300">+{a.days}</span></div>}
              {a.reason && <div className="text-slate-400">Reason: <span className="text-slate-300">{a.reason}</span></div>}
              <div className="text-slate-500 text-xs">By: {a.performedBy}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Renewal review modal ──────────────────────────────────────────────────────
function RenewalModal({ request, onClose, onDone }: { request: any; onClose: () => void; onDone: (msg: string) => void }) {
  const [action, setAction] = useState<"approve" | "reject" | "clarify">("approve");
  const [days, setDays] = useState("180");
  const [customDate, setCustomDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      if (action === "approve") {
        await api.approveRenewal(request.id, { days: Number(days) || 180, newEndDate: customDate || undefined, reason });
        onDone(`✅ Renewal approved for ${request.providerName}.`);
      } else if (action === "reject") {
        await api.rejectRenewal(request.id, { reason });
        onDone(`Renewal rejected for ${request.providerName}.`);
      } else {
        await api.clarifyRenewal(request.id, { reason });
        onDone(`Clarification requested from ${request.providerName}.`);
      }
      onClose();
    } catch (e: any) {
      onDone(`Error: ${e.message}`);
      setSaving(false);
    }
  }

  const PLAN_DAYS: Record<string, number> = { monthly: 30, quarterly: 90, halfYearly: 180, yearly: 365 };
  const planDays = PLAN_DAYS[request.plan] ?? 180;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Review Renewal Request</h3>
            <p className="text-slate-400 text-sm mt-0.5">{request.providerName} · {request.providerPhone}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Payment details */}
        <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div><span className="text-slate-400">Plan</span><p className="text-white font-medium capitalize">{request.plan} ({planDays} days)</p></div>
            <div><span className="text-slate-400">Amount</span><p className="text-white font-medium">{request.amount ? `₹${request.amount}` : "—"}</p></div>
            <div><span className="text-slate-400">UTR / Txn ID</span><p className="text-orange-300 font-mono font-bold">{request.utr}</p></div>
            <div><span className="text-slate-400">Payment Date</span><p className="text-white">{fmtDate(request.paymentDate)}</p></div>
          </div>
          {request.notes && (
            <div className="pt-2 border-t border-slate-700">
              <span className="text-slate-400">Notes:</span>
              <p className="text-slate-300 mt-0.5">{request.notes}</p>
            </div>
          )}
          {request.screenshotUrl && (
            <div className="pt-2 border-t border-slate-700">
              <span className="text-slate-400 text-xs">Payment Screenshot</span>
              <img src={request.screenshotUrl} alt="Payment screenshot" className="mt-2 rounded-lg max-h-48 object-contain border border-slate-700" />
            </div>
          )}
          <div className="text-slate-500 text-xs pt-1">Submitted: {fmtDateTime(request.submittedAt)}</div>
        </div>

        {/* Action */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: "approve" as const, label: "✅ Approve", color: "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" },
            { v: "reject" as const, label: "❌ Reject", color: "bg-red-500/15 border-red-500/50 text-red-300" },
            { v: "clarify" as const, label: "❓ Clarify", color: "bg-amber-500/15 border-amber-500/50 text-amber-300" },
          ].map(({ v, label, color }) => (
            <button key={v} onClick={() => setAction(v)}
              className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${action === v ? color : "bg-slate-800 border-slate-700 text-slate-400"}`}>
              {label}
            </button>
          ))}
        </div>

        {action === "approve" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Extension Duration</label>
              <div className="flex gap-2 flex-wrap">
                {[30, 90, 180, 365].map((d) => (
                  <button key={d} onClick={() => { setDays(String(d)); setCustomDate(""); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${days === String(d) && !customDate ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                    {d} days
                  </button>
                ))}
              </div>
              <input type="number" min={1} value={days} onChange={(e) => { setDays(e.target.value); setCustomDate(""); }}
                placeholder="Or enter custom days"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-500 placeholder:text-slate-600" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Or Set Exact Expiry Date</label>
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {action === "approve" ? "Notes (optional)" : action === "reject" ? "Reason for rejection" : "What information is needed?"}
          </label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            placeholder={action === "approve" ? "Internal note..." : action === "reject" ? "e.g. UTR not found in bank statement" : "e.g. Please re-upload a clearer screenshot"}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-500 resize-none placeholder:text-slate-600" />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 bg-slate-800 border border-slate-700">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2 ${action === "approve" ? "bg-emerald-600 hover:bg-emerald-500" : action === "reject" ? "bg-red-600 hover:bg-red-500" : "bg-amber-600 hover:bg-amber-500"}`}>
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Request Clarification"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plans & Settings tab (original content) ───────────────────────────────────
function PlansSettings() {
  const [plans, setPlans] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getPlans(), api.getSettings()]).then(([planData, settingsData]) => {
      const p = planData.plans ?? [];
      setPlans(p);
      const prices: Record<string, string> = {};
      p.forEach((pl: any) => { prices[pl.key] = String(pl.price); });
      setEditingPrices(prices);
      setSettings(settingsData.settings ?? {});
      setLoading(false);
    });
  }, []);

  const hasChanges = plans.some((p) => String(p.price) !== (editingPrices[p.key] ?? String(p.price)));

  const PLAN_COLORS: Record<string, string> = { monthly: "#3B82F6", quarterly: "#FF6B35", halfYearly: "#10B981", yearly: "#8B5CF6" };
  const PLAN_ICONS: Record<string, string> = { monthly: "📅", quarterly: "🗓️", halfYearly: "⭐", yearly: "🏆" };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Toast msg={toast} onClear={() => setToast(null)} />
      {/* Payment Gateway */}
      <div className={`border rounded-2xl p-5 ${settings?.paymentGatewayEnabled ? "bg-emerald-500/5 border-emerald-500/30" : "bg-slate-900 border-slate-800"}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-bold text-white text-base">Payment Gateway</h3>
            <p className="text-sm text-slate-400 mt-1">{settings?.paymentGatewayEnabled ? "✅ Payments are LIVE" : "⛔ Payments DISABLED — plans are free / manual"}</p>
          </div>
          <button onClick={async () => {
            const updated = { ...settings, paymentGatewayEnabled: !settings.paymentGatewayEnabled };
            await api.updateSettings(updated); setSettings(updated);
            setToast(updated.paymentGatewayEnabled ? "Payment gateway ENABLED." : "Payment gateway DISABLED.");
          }} className={`relative w-14 h-7 rounded-full transition-colors ${settings?.paymentGatewayEnabled ? "bg-emerald-500" : "bg-slate-700"}`}>
            <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform shadow ${settings?.paymentGatewayEnabled ? "translate-x-8" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {/* Pricing cards */}
      <div>
        <h3 className="font-semibold text-white text-sm mb-3">Subscription Plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const color = PLAN_COLORS[plan.key] ?? "#FF6B35";
            const icon = PLAN_ICONS[plan.key] ?? "📋";
            const currentVal = editingPrices[plan.key] ?? String(plan.price);
            const changed = String(plan.price) !== currentVal;
            return (
              <div key={plan.key} className="relative bg-slate-900 border border-slate-800 rounded-2xl p-5">
                {plan.badge && <span className="absolute top-0 right-0 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl" style={{ backgroundColor: plan.badgeColor ?? color }}>{plan.badge}</span>}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: color + "20" }}>{icon}</div>
                  <div><p className="font-semibold text-white">{plan.label}</p><p className="text-xs text-slate-400">{plan.billedAs}</p></div>
                </div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Price (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-lg">₹</span>
                  <input type="text" inputMode="numeric" value={currentVal}
                    onChange={(e) => { if (/^\d*$/.test(e.target.value)) setEditingPrices((prev) => ({ ...prev, [plan.key]: e.target.value })); }}
                    className="w-full bg-slate-800 border rounded-xl pl-8 pr-4 py-3 text-xl font-bold text-white outline-none focus:ring-2 transition-all"
                    style={{ borderColor: changed ? color : "#334155" }} />
                </div>
                <div className="mt-3 text-xs text-slate-500">With GST (18%): <span className="text-slate-300 font-medium">₹{Math.round(Number(currentVal || 0) * 1.18)}</span></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex-1 text-sm text-slate-400">{hasChanges ? <span className="text-orange-400 font-medium">⚡ Unsaved price changes</span> : <span>All prices saved</span>}</div>
        <button onClick={async () => {
          setSaving(true);
          const updated = plans.map((p) => ({ ...p, price: Number(editingPrices[p.key] ?? p.price) }));
          await api.updatePlans(updated); setPlans(updated); setSaving(false); setToast("Prices saved!");
        }} disabled={saving || !hasChanges}
          className="px-6 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-40 flex items-center gap-2"
          style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}>
          {saving ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : "💾 Save Prices"}
        </button>
      </div>

      {/* Free trial */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white text-sm mb-3">Free Trial Period</h3>
        <div className="flex items-center gap-4">
          <p className="flex-1 text-xs text-slate-400">Days of free access for new providers</p>
          <div className="flex items-center gap-2">
            <input type="number" value={settings?.freeTrialDays ?? 180}
              onChange={(e) => setSettings((s: any) => ({ ...s, freeTrialDays: Number(e.target.value) }))}
              className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 text-center font-bold" />
            <span className="text-slate-400 text-sm">days</span>
            <button onClick={async () => { await api.updateSettings(settings); setToast("Free trial period saved."); }}
              className="px-3 py-2 text-xs font-semibold text-white rounded-lg" style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}>Save</button>
          </div>
        </div>
      </div>

      {/* Payment details */}
      {(settings?.upiId || settings?.bankAccountName) ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-white text-sm">Payment Receiving Details</h3>
          <p className="text-xs text-slate-400">Providers send money here. Shown to them in the app.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {settings.upiId && (
              <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-lg">📱</div><div><p className="text-white font-semibold text-sm">UPI Payment</p><p className="text-xs text-purple-300">Instant transfer</p></div></div>
                <div className="bg-slate-900/60 rounded-xl p-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between"><span className="text-slate-400">UPI ID</span><span className="font-mono font-bold text-white">{settings.upiId}</span></div>
                  {settings.upiName && <div className="flex items-center justify-between"><span className="text-slate-400">Name</span><span className="text-slate-300">{settings.upiName}</span></div>}
                </div>
              </div>
            )}
            {settings.bankAccountName && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-lg">🏦</div><div><p className="text-white font-semibold text-sm">Bank Transfer</p><p className="text-xs text-emerald-300">NEFT / IMPS / RTGS</p></div></div>
                <div className="bg-slate-900/60 rounded-xl p-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between"><span className="text-slate-400">Name</span><span className="text-slate-300">{settings.bankAccountName}</span></div>
                  {settings.bankIfsc && <div className="flex items-center justify-between"><span className="text-slate-400">IFSC</span><span className="font-mono font-bold text-white">{settings.bankIfsc}</span></div>}
                  {settings.bankAccountNumber && <div className="flex items-center justify-between"><span className="text-slate-400">Account</span><span className="font-mono text-white">{"•".repeat(Math.max(0, settings.bankAccountNumber.length - 4))}{settings.bankAccountNumber.slice(-4)}</span></div>}
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">✏️ Update in <span className="text-slate-400 font-medium">Settings → Bank Account Details</span></p>
        </div>
      ) : (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div><p className="text-amber-400 font-semibold text-sm">No payment details set up</p><p className="text-xs text-slate-400 mt-1">Go to <span className="text-slate-300 font-medium">Settings → Bank Account Details</span> to add your UPI / bank details for providers to pay you.</p></div>
        </div>
      )}
    </div>
  );
}

// ── Provider Subscriptions tab ────────────────────────────────────────────────
function ProviderSubscriptions() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [overrideTarget, setOverrideTarget] = useState<any | null>(null);
  const [auditTarget, setAuditTarget] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.getAdminSubscriptions().then((d: any) => { setList(d.subscriptions ?? []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    let r = list;
    if (filterStatus !== "all") r = r.filter((p) => p.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q) || p.category?.toLowerCase().includes(q));
    }
    return r;
  }, [list, filterStatus, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length, active: 0, expired: 0, suspended: 0, none: 0 };
    for (const p of list) { c[p.status] = (c[p.status] ?? 0) + 1; }
    return c;
  }, [list]);

  return (
    <div className="space-y-5">
      <Toast msg={toast} onClear={() => setToast(null)} />
      {overrideTarget && <OverrideModal provider={overrideTarget} onClose={() => setOverrideTarget(null)} onSaved={(m) => { setToast(m); setOverrideTarget(null); load(); }} />}
      {auditTarget && <AuditDrawer providerId={auditTarget.id} providerName={auditTarget.name} onClose={() => setAuditTarget(null)} />}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active", key: "active", color: "#10B981" },
          { label: "Expired", key: "expired", color: "#EF4444" },
          { label: "Suspended", key: "suspended", color: "#F59E0B" },
          { label: "No Plan", key: "none", color: "#64748B" },
        ].map(({ label, key, color }) => (
          <button key={key} onClick={() => setFilterStatus(filterStatus === key ? "all" : key)}
            className={`bg-slate-900 border rounded-2xl p-4 text-left transition-colors hover:border-slate-600 ${filterStatus === key ? "border-orange-500/60" : "border-slate-800"}`}>
            <div className="text-2xl font-bold" style={{ color }}>{counts[key] ?? 0}</div>
            <div className="text-slate-400 text-xs mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, category…"
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600" />
        <div className="flex gap-2">
          {["all", "active", "expired", "suspended", "none"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize border transition-colors ${filterStatus === s ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"}`}>
              {s === "none" ? "No Plan" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">No providers found.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-center">Days Left</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((p) => (
                <tr key={p.id} className="bg-slate-900/40 hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{p.name}</div>
                    <div className="text-slate-500 text-xs">{p.phone}</div>
                    <div className="text-slate-600 text-xs">{p.category}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{p.plan !== "—" ? p.plan : <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-slate-300">{fmtDate(p.endDate)}</td>
                  <td className="px-4 py-3 text-center">
                    {p.daysLeft === null ? <span className="text-slate-600">—</span>
                      : p.daysLeft <= 0 ? <span className="text-red-400 font-bold">Expired</span>
                      : p.daysLeft <= 7 ? <span className="text-red-400 font-bold">{p.daysLeft}d</span>
                      : p.daysLeft <= 30 ? <span className="text-amber-400 font-medium">{p.daysLeft}d</span>
                      : <span className="text-slate-300">{p.daysLeft}d</span>}
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setOverrideTarget(p)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500/20 border border-orange-500/40 hover:bg-orange-500/30">
                        Manage
                      </button>
                      <button onClick={() => setAuditTarget(p)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 bg-slate-800 border border-slate-700 hover:border-slate-600">
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Renewal Requests tab ──────────────────────────────────────────────────────
function RenewalRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.getRenewalRequests().then((d: any) => { setRequests(d.requests ?? []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return requests;
    return requests.filter((r) => r.status === filterStatus);
  }, [requests, filterStatus]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      <Toast msg={toast} onClear={() => setToast(null)} />
      {selected && <RenewalModal request={selected} onClose={() => setSelected(null)} onDone={(m) => { setToast(m); setSelected(null); load(); }} />}

      {pendingCount > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-lg">🔔</div>
          <div><p className="text-blue-300 font-semibold text-sm">{pendingCount} renewal request{pendingCount > 1 ? "s" : ""} awaiting review</p><p className="text-blue-400/70 text-xs mt-0.5">Click "Review" to approve, reject, or request clarification</p></div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {["pending", "approved", "rejected", "clarification_requested", "all"].map((s) => {
          const label = s === "clarification_requested" ? "Clarify?" : s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1);
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${filterStatus === s ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"}`}>
              {label} {s !== "all" ? `(${requests.filter((r) => r.status === s).length})` : `(${requests.length})`}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-400">{filterStatus === "pending" ? "No pending renewal requests." : "No requests in this category."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{r.providerName}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-slate-400 text-sm">{r.providerPhone}</p>
                </div>
                <div className="text-right text-xs text-slate-500">{fmtDateTime(r.submittedAt)}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-slate-500 text-xs">Plan</p><p className="text-white capitalize font-medium">{r.plan}</p></div>
                <div><p className="text-slate-500 text-xs">Amount</p><p className="text-white font-medium">{r.amount ? `₹${r.amount}` : "—"}</p></div>
                <div><p className="text-slate-500 text-xs">UTR / Txn ID</p><p className="text-orange-300 font-mono font-bold">{r.utr}</p></div>
                <div><p className="text-slate-500 text-xs">Payment Date</p><p className="text-white">{fmtDate(r.paymentDate)}</p></div>
              </div>

              {r.notes && <p className="mt-3 text-sm text-slate-400 bg-slate-800/60 rounded-xl px-3 py-2">{r.notes}</p>}
              {r.reviewNotes && r.status !== "pending" && (
                <p className="mt-2 text-sm text-slate-400 bg-slate-800/60 rounded-xl px-3 py-2 border-l-2 border-orange-500/50">
                  <span className="text-slate-500 text-xs">Admin note: </span>{r.reviewNotes}
                </p>
              )}
              {r.newEndDate && <p className="mt-2 text-xs text-emerald-400">New expiry: {fmtDate(r.newEndDate)}</p>}

              {r.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setSelected(r)}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-1.5"
                    style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}>
                    Review
                  </button>
                </div>
              )}
              {r.status === "clarification_requested" && (
                <div className="mt-4">
                  <button onClick={() => setSelected(r)}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30">
                    Re-Review
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Orphaned Providers — Repair Utility ───────────────────────────────────────
function OrphanedRepair() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.getAdminSubscriptions()
      .then((d: any) => {
        const all: any[] = d.subscriptions ?? [];
        // Orphaned = no subscription record at all AND not suspended/blocked
        const orphaned = all.filter((p: any) => !p._hasSub && p.status === "none" && !p.suspended && !p.blocked);
        setList(orphaned);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }
  useEffect(load, []);

  async function grantTrial(p: any) {
    setGranting((prev) => new Set(prev).add(p.id));
    try {
      await api.grantTrialSubscription(p.id, 180);
      setToast(`✅ 180-day trial granted to ${p.name}`);
      load();
    } catch (e: any) {
      setToast(`❌ Failed: ${e.message}`);
    } finally {
      setGranting((prev) => { const s = new Set(prev); s.delete(p.id); return s; });
    }
  }

  return (
    <div className="space-y-5">
      <Toast msg={toast} onClear={() => setToast(null)} />

      {/* Explanation banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-lg shrink-0">🔧</div>
        <div>
          <p className="text-amber-300 font-semibold text-sm">Orphaned Providers — No Subscription Record</p>
          <p className="text-amber-400/70 text-xs mt-0.5">
            These providers registered but their trial subscription was never created (typically because the API server was
            unreachable from their device during registration). Use "Grant 180d Trial" to fix each one.
          </p>
        </div>
      </div>

      {/* Root cause explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-400">
        <p className="text-slate-300 font-semibold text-sm">Root Cause (for records)</p>
        <p>
          <span className="text-slate-300 font-medium">Flow:</span> Registration calls{" "}
          <code className="bg-slate-800 px-1 rounded text-orange-300">POST /api/providers</code> (which auto-creates the trial) and{" "}
          <code className="bg-slate-800 px-1 rounded text-orange-300">Supabase.upsert()</code> independently.
        </p>
        <p>
          <span className="text-slate-300 font-medium">Failure:</span> On native Android/iOS builds,{" "}
          <code className="bg-slate-800 px-1 rounded text-orange-300">API_BASE</code> falls back to{" "}
          <code className="bg-slate-800 px-1 rounded text-orange-300">api.skillad.in</code>.
          If that host is unreachable, <code className="bg-slate-800 px-1 rounded text-orange-300">apiPostProvider()</code> previously had a silent{" "}
          <code className="bg-slate-800 px-1 rounded text-orange-300">catch {"{}"}</code> that swallowed the error.
          The Supabase write succeeded (provider visible in the app) but no subscription was ever created.
        </p>
        <p>
          <span className="text-slate-300 font-medium">Fix applied:</span>{" "}
          <code className="bg-slate-800 px-1 rounded text-orange-300">apiPostProvider()</code> now retries once after 2 s and logs failures with{" "}
          <code className="bg-slate-800 px-1 rounded text-orange-300">console.warn</code>.
          New registrations will surface API connectivity issues clearly.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-slate-300 font-semibold">All providers have subscription records</p>
          <p className="text-slate-500 text-sm mt-1">No orphaned providers found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Registered</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {list.map((p) => (
                <tr key={p.id} className="bg-slate-900/40 hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{p.name}</div>
                    <div className="text-slate-500 text-xs">{p.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.category}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{p.location}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(p.startDate ?? null)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={granting.has(p.id)}
                      onClick={() => grantTrial(p)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500/20 border border-orange-500/40 hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {granting.has(p.id) ? "Granting…" : "Grant 180d Trial"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function Subscriptions() {
  const [tab, setTab] = useState<"providers" | "renewals" | "plans" | "repair">("providers");

  const TABS = [
    { key: "providers", label: "Provider Subscriptions", icon: "👥" },
    { key: "renewals",  label: "Renewal Requests",       icon: "💳" },
    { key: "plans",     label: "Plans & Settings",       icon: "⚙️" },
    { key: "repair",    label: "Repair",                 icon: "🔧" },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Subscriptions</h2>
        <p className="text-slate-400 text-sm mt-1">Manage provider subscriptions, renewal requests, and pricing</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1">
        {TABS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === key ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"}`}>
            <span>{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "providers" && <ProviderSubscriptions />}
      {tab === "renewals"  && <RenewalRequests />}
      {tab === "plans"     && <PlansSettings />}
      {tab === "repair"    && <OrphanedRepair />}
    </div>
  );
}
