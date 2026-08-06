import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Provider = any;
type ActionType = "verify" | "suspend" | "unsuspend" | "block" | "unblock" | "delete";
type TabType = "all" | "duplicates";

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ color, backgroundColor: color + "22" }}
    >
      {label}
    </span>
  );
}

function SubscriptionBadge({
  endDate,
  status,
  daysLeft: daysLeftProp,
}: {
  endDate: string | null;
  status?: string;
  daysLeft?: number | null;
}) {
  // Prefer server-computed daysLeft, fall back to local calculation
  const daysLeft = daysLeftProp ?? (endDate
    ? Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
    : null);
  const dateStr = endDate
    ? new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  // No subscription at all
  if (!status || status === "none") return <span className="text-xs text-slate-600">—</span>;

  if (status === "expired" || (daysLeft !== null && daysLeft <= 0)) return (
    <div className="flex flex-col gap-0.5">
      <Badge label="Expired" color="#EF4444" />
      {dateStr && <span className="text-[10px] text-slate-500">{dateStr}</span>}
    </div>
  );
  if (daysLeft !== null && daysLeft <= 3) return (
    <div className="flex flex-col gap-0.5">
      <Badge label={`${daysLeft}d left`} color="#EF4444" />
      {dateStr && <span className="text-[10px] text-slate-500">{dateStr}</span>}
    </div>
  );
  if (daysLeft !== null && daysLeft <= 7) return (
    <div className="flex flex-col gap-0.5">
      <Badge label={`${daysLeft}d left`} color="#F59E0B" />
      {dateStr && <span className="text-[10px] text-slate-500">{dateStr}</span>}
    </div>
  );
  // Active with a known expiry date
  if (daysLeft !== null) return (
    <div className="flex flex-col gap-0.5">
      <Badge label={`${daysLeft}d left`} color="#10B981" />
      {dateStr && <span className="text-[10px] text-slate-500">{dateStr}</span>}
    </div>
  );
  // Active but no expiry date resolvable (edge case)
  return <Badge label="Active" color="#10B981" />;
}

function fmt(n: number | undefined | null): string {
  return (n ?? 0).toString();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function SubStatusBadge({ status }: { status?: string }) {
  if (!status || status === "none") return <span className="text-xs text-slate-500">—</span>;
  if (status === "expired")  return <Badge label="Expired"  color="#EF4444" />;
  if (status === "expiring") return <Badge label="Expiring" color="#F59E0B" />;
  return <Badge label="Active" color="#10B981" />;
}

function MetricCard({ icon, label, value, sub, accent }: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-3 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium uppercase tracking-wide">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold truncate" style={{ color: accent ?? "#F1F5F9" }}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
    </div>
  );
}

function ProviderRow({ provider, onAction }: { provider: Provider; onAction: (id: string, action: ActionType) => void }) {
  const [open, setOpen] = useState(false);
  const suspended = !!provider.suspended;
  const blocked = !!provider.blocked;
  const verified = !!provider.verified;

  const total     = provider.totalBookings     ?? 0;
  const accepted  = provider.acceptedBookings  ?? 0;
  const rejected  = provider.rejectedBookings  ?? 0;
  const completed = provider.completedBookings ?? 0;
  const rating    = provider.rating            ?? 0;
  const reviews   = provider.reviewCount       ?? 0;
  const totalEarnings   = provider.totalEarnings   ?? 0;
  const monthlyEarnings = provider.monthlyEarnings ?? 0;

  function fmtRupees(n: number): string {
    if (n === 0) return "₹0";
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toLocaleString("en-IN")}`;
  }

  return (
    <>
      <tr
        className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
        onClick={() => setOpen(!open)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {provider.avatarUrl ? (
              <img
                src={provider.avatarUrl}
                alt={provider.name}
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: provider.avatarColor ?? "#FF6B35" }}
              >
                {provider.initials ?? "??"}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-white">{provider.name}</p>
              <p className="text-xs text-slate-400">{provider.phone}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-300">{provider.category}</td>
        <td className="px-4 py-3 text-sm text-slate-400">{provider.location}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {verified && <Badge label="Verified" color="#10B981" />}
            {suspended && <Badge label="Suspended" color="#F59E0B" />}
            {blocked && <Badge label="Blocked" color="#EF4444" />}
            {!verified && !suspended && !blocked && <Badge label="Pending" color="#94A3B8" />}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-xs text-slate-300">{rating.toFixed(1)}</span>
            <span className="text-xs text-slate-500">({reviews})</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-slate-400">
          {provider.registeredAt ? new Date(provider.registeredAt).toLocaleDateString("en-IN") : "-"}
        </td>
        <td className="px-4 py-3">
          <SubscriptionBadge
            endDate={provider.subscriptionExpiry ?? provider.subscriptionEndDate ?? null}
            status={provider.subscriptionStatus}
            daysLeft={provider.subscriptionDaysLeft ?? null}
          />
        </td>
        <td className="px-4 py-3 text-slate-400">{open ? "▲" : "▼"}</td>
      </tr>
      {open && (
        <tr className="bg-slate-800/30">
          <td colSpan={8} className="px-6 py-5">

            {/* ── Action buttons ────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 mb-5">
              {!verified && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction(provider.id, "verify"); }}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 transition-colors"
                >
                  ✅ Verify
                </button>
              )}
              {!suspended ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction(provider.id, "suspend"); }}
                  className="px-3 py-1.5 text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/25 transition-colors"
                >
                  ⚠️ Suspend
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction(provider.id, "unsuspend"); }}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/25 transition-colors"
                >
                  🔓 Unsuspend
                </button>
              )}
              {!blocked ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction(provider.id, "block"); }}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-colors"
                >
                  🚫 Block
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction(provider.id, "unblock"); }}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/25 transition-colors"
                >
                  🔓 Unblock
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete ${provider.name}? This cannot be undone.`)) {
                    onAction(provider.id, "delete");
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-colors"
              >
                🗑️ Delete
              </button>
            </div>

            {/* ── Performance metrics ───────────────────────────────────── */}
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Performance Metrics</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
              <MetricCard
                icon="📋"
                label="Total Requests"
                value={fmt(total)}
                sub="booking msgs"
              />
              <MetricCard
                icon="✅"
                label="Accepted"
                value={fmt(accepted)}
                accent={accepted > 0 ? "#10B981" : undefined}
                sub={total > 0 ? `${Math.round((accepted / total) * 100)}% of total` : "—"}
              />
              <MetricCard
                icon="❌"
                label="Rejected"
                value={fmt(rejected)}
                accent={rejected > 0 ? "#EF4444" : undefined}
                sub={total > 0 ? `${Math.round((rejected / total) * 100)}% of total` : "—"}
              />
              <MetricCard
                icon="🏁"
                label="Completed"
                value={fmt(completed)}
                accent={completed > 0 ? "#6366F1" : undefined}
                sub={accepted > 0 ? `${Math.round((completed / accepted) * 100)}% of accepted` : "—"}
              />
              <MetricCard
                icon="⭐"
                label="Avg Rating"
                value={rating > 0 ? rating.toFixed(1) : "—"}
                accent={rating >= 4 ? "#F59E0B" : rating >= 2.5 ? "#94A3B8" : rating > 0 ? "#EF4444" : undefined}
                sub={rating > 0 ? `out of 5.0` : "no ratings yet"}
              />
              <MetricCard
                icon="💬"
                label="Reviews"
                value={fmt(reviews)}
                sub={reviews === 1 ? "1 review" : `${reviews} reviews`}
              />
              <MetricCard
                icon="🔑"
                label="Subscription"
                value={
                  provider.subscriptionStatus === "active"   ? "Active"   :
                  provider.subscriptionStatus === "expiring" ? "Expiring" :
                  provider.subscriptionStatus === "expired"  ? "Expired"  : "None"
                }
                accent={
                  provider.subscriptionStatus === "active"   ? "#10B981" :
                  provider.subscriptionStatus === "expiring" ? "#F59E0B" :
                  provider.subscriptionStatus === "expired"  ? "#EF4444" : "#64748B"
                }
                sub={provider.subscriptionEndDate
                  ? `until ${new Date(provider.subscriptionEndDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                  : "no subscription"}
              />
              <MetricCard
                icon="🕐"
                label="Last Login"
                value={fmtDate(provider.lastLogin)}
                accent={
                  !provider.lastLogin ? "#64748B" :
                  (Date.now() - new Date(provider.lastLogin).getTime()) < 7 * 86400000 ? "#10B981" :
                  (Date.now() - new Date(provider.lastLogin).getTime()) < 30 * 86400000 ? "#F59E0B" : "#EF4444"
                }
                sub={provider.lastLogin ? new Date(provider.lastLogin).toLocaleDateString("en-IN") : "no login recorded"}
              />
              <MetricCard
                icon="💰"
                label="Total Earned"
                value={fmtRupees(totalEarnings)}
                accent={totalEarnings > 0 ? "#10B981" : undefined}
                sub="lifetime earnings"
              />
              <MetricCard
                icon="📅"
                label="Monthly Earned"
                value={fmtRupees(monthlyEarnings)}
                accent={monthlyEarnings > 0 ? "#6366F1" : undefined}
                sub="last 30 days"
              />
            </div>

            {/* ── Profile photo ─────────────────────────────────────────── */}
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Profile Photo</p>
            {provider.avatarUrl ? (
              <div className="flex items-start gap-5 mb-5 p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <img
                  src={provider.avatarUrl}
                  alt={provider.name}
                  className="w-28 h-28 rounded-2xl object-cover border-2 border-slate-600 shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-white">Uploaded by provider</p>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                    Review this photo before verifying the provider. Ensure it is a genuine professional profile photo and does not contain inappropriate or misleading content.
                  </p>
                  <a
                    href={provider.avatarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2 mt-1 w-fit"
                  >
                    Open full size ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-5 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-700 text-slate-400 text-xs font-bold shrink-0">
                  {provider.initials ?? "?"}
                </div>
                <p className="text-xs text-slate-500 italic">No profile photo uploaded by this provider.</p>
              </div>
            )}

            {/* ── Profile detail ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-400">
              <div><span className="text-slate-500">Experience:</span> {provider.experience}y</div>
              <div><span className="text-slate-500">Radius:</span> {provider.serviceRadius} km</div>
              <div><span className="text-slate-500">Charge:</span> {provider.serviceCharge ?? "—"}</div>
              <div><span className="text-slate-500">Hours:</span> {provider.workingHours ?? "—"}</div>
            </div>
            {provider.description && (
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{provider.description}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function DuplicateGroup({
  group,
  onMerge,
}: {
  group: { phone: string; count: number; providers: Provider[] };
  onMerge: (keepId: string, deleteIds: string[]) => Promise<void>;
}) {
  const [keepId, setKeepId] = useState(group.providers[0]?.id ?? "");
  const [merging, setMerging] = useState(false);

  async function handleMerge() {
    if (!keepId) return;
    const deleteIds = group.providers.filter((p) => p.id !== keepId).map((p) => p.id);
    if (!window.confirm(`Keep provider "${group.providers.find(p => p.id === keepId)?.name}" and delete ${deleteIds.length} duplicate(s)?`)) return;
    setMerging(true);
    await onMerge(keepId, deleteIds);
    setMerging(false);
  }

  return (
    <div className="bg-slate-900 border border-red-500/30 rounded-2xl overflow-hidden mb-4">
      <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-red-400 font-bold text-sm">📱 +91 {group.phone}</span>
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            {group.count} duplicate{group.count !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={handleMerge}
          disabled={merging}
          className="px-4 py-1.5 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {merging ? "Merging…" : "Keep Selected & Delete Others"}
        </button>
      </div>
      <div className="p-4 space-y-2">
        <p className="text-xs text-slate-500 mb-3">Select which account to keep — the others will be permanently deleted.</p>
        {group.providers.map((p) => (
          <label
            key={p.id}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              keepId === p.id
                ? "border-orange-500/60 bg-orange-500/10"
                : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              name={`keep-${group.phone}`}
              value={p.id}
              checked={keepId === p.id}
              onChange={() => setKeepId(p.id)}
              className="accent-orange-500"
            />
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: p.avatarColor ?? "#FF6B35" }}
            >
              {p.initials ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{p.name}</p>
              <p className="text-xs text-slate-400 truncate">{p.category}{p.subcategory ? ` › ${p.subcategory}` : ""} · {p.location}</p>
              <p className="text-xs text-slate-500">ID: {p.id} · Registered: {p.registeredAt ? new Date(p.registeredAt).toLocaleDateString("en-IN") : "—"}</p>
            </div>
            <div className="text-right shrink-0">
              {p.verified && <Badge label="Verified" color="#10B981" />}
              {p.suspended && <Badge label="Suspended" color="#F59E0B" />}
              {!p.verified && !p.suspended && <Badge label="Pending" color="#94A3B8" />}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Providers() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>("all");
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function load() {
    api.getProviders().then((d: any) => {
      setProviders(d.providers ?? []);
      setLoading(false);
    });
  }

  function loadDuplicates() {
    setLoadingDuplicates(true);
    api.getDuplicateProviders().then((d: any) => {
      setDuplicates(d.duplicates ?? []);
      setLoadingDuplicates(false);
    }).catch(() => setLoadingDuplicates(false));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab === "duplicates") loadDuplicates();
  }, [tab]);

  async function handleAction(id: string, action: ActionType) {
    try {
      if (action === "delete") {
        await api.deleteProvider(id);
        setProviders((prev) => prev.filter((p) => p.id !== id));
        showToast("Provider deleted.");
        return;
      }
      const update: Record<string, boolean> = ({
        verify: { verified: true },
        suspend: { suspended: true },
        unsuspend: { suspended: false },
        block: { blocked: true },
        unblock: { blocked: false },
      } as any)[action];
      await api.updateProvider(id, update);
      setProviders((prev) => prev.map((p) => p.id === id ? { ...p, ...update } : p));
      showToast(`Provider ${action}ed.`);
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    }
  }

  async function handleMerge(keepId: string, deleteIds: string[]) {
    try {
      await api.mergeProviders(keepId, deleteIds);
      setDuplicates((prev) =>
        prev
          .map((g) => ({
            ...g,
            providers: g.providers.filter((p: any) => !deleteIds.includes(p.id)),
          }))
          .filter((g) => g.providers.length > 1),
      );
      showToast(`✅ Merged — kept ${keepId}, removed ${deleteIds.length} duplicate(s).`);
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    }
  }

  const categories = [...new Set(providers.map((p) => p.category).filter(Boolean))].sort();

  const filtered = providers.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name?.toLowerCase().includes(q) || p.phone?.includes(q) || p.location?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
    const matchCat = !filterCategory || p.category === filterCategory;
    const matchStatus = !filterStatus ||
      (filterStatus === "verified" && p.verified && !p.suspended && !p.blocked) ||
      (filterStatus === "suspended" && p.suspended) ||
      (filterStatus === "blocked" && p.blocked) ||
      (filterStatus === "pending" && !p.verified && !p.suspended && !p.blocked) ||
      (filterStatus === "expiring" && !!p.subscriptionEndDate && (() => {
        const d = Math.ceil((new Date(p.subscriptionEndDate).getTime() - Date.now()) / 86400000);
        return d > 0 && d <= 7;
      })()) ||
      (filterStatus === "expired" && !!p.subscriptionEndDate && new Date(p.subscriptionEndDate) <= new Date());
    return matchSearch && matchCat && matchStatus;
  });

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Service Providers</h2>
          <p className="text-slate-400 text-sm mt-1">
            {providers.length} total · {providers.filter((p) => p.verified).length} verified
            {duplicates.length > 0 && (
              <span className="ml-2 text-red-400 font-medium">
                · ⚠️ {duplicates.length} duplicate phone{duplicates.length !== 1 ? "s" : ""} found
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("all")}
          className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
            tab === "all"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          All Providers
        </button>
        <button
          onClick={() => setTab("duplicates")}
          className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-2 ${
            tab === "duplicates"
              ? "bg-red-500/20 text-red-300"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Duplicates
          {duplicates.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {duplicates.length}
            </span>
          )}
        </button>
      </div>

      {tab === "all" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search name, phone, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500 transition-colors"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            >
              <option value="">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="blocked">Blocked</option>
              <option value="expiring">⏰ Expiring (≤7 days)</option>
              <option value="expired">🔴 Subscription Expired</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-2xl mb-2">👷</p>
                <p className="text-sm">{providers.length === 0 ? "No providers registered yet" : "No results match your filters"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Provider", "Category", "Location", "Status", "Rating", "Registered", "Subscription", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <ProviderRow key={p.id} provider={p} onAction={handleAction} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "duplicates" && (
        <div>
          {loadingDuplicates ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : duplicates.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
              <p className="text-3xl mb-3">✅</p>
              <p className="text-base font-medium text-white mb-1">No duplicates found</p>
              <p className="text-sm">Every mobile number maps to exactly one provider account.</p>
            </div>
          ) : (
            <>
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 mb-5 flex items-start gap-3">
                <span className="text-red-400 text-xl mt-0.5">⚠️</span>
                <div>
                  <p className="text-red-300 font-semibold text-sm">
                    {duplicates.length} phone number{duplicates.length !== 1 ? "s" : ""} with multiple provider accounts
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    For each group, select which account to keep — the others will be permanently deleted from both the server and Supabase.
                    The selected account retains its rating, reviews, and verification status.
                  </p>
                </div>
              </div>
              {duplicates.map((g) => (
                <DuplicateGroup key={g.phone} group={g} onMerge={handleMerge} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
