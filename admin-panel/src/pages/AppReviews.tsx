import { useEffect, useState } from "react";
import { api } from "../lib/api";

type AppReview = {
  id: string;
  rating: number;
  text: string;
  suggestion?: string;
  displayName: string;
  userId?: string | null;
  userType?: "Customer" | "Provider" | null;
  city?: string | null;
  appVersion?: string | null;
  platform?: string | null;
  status: "pending" | "approved" | "hidden";
  featured: boolean;
  createdAt: string;
  updatedAt?: string;
};

const STATUS_FILTERS = ["all", "pending", "approved", "hidden"] as const;

export default function AppReviews() {
  const [reviews, setReviews] = useState<AppReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function load() {
    setLoading(true);
    try {
      const d = await api.getAppReviews();
      setReviews(d.reviews ?? []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = reviews.filter((r) => (filter === "all" ? true : r.status === filter));

  async function patch(id: string, body: Partial<AppReview>) {
    setBusyId(id);
    try {
      await api.updateAppReview(id, body);
      showToast("Updated");
      await load();
    } catch (e: any) {
      showToast(e?.message ?? "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this app review permanently?")) return;
    setBusyId(id);
    try {
      await api.deleteAppReview(id);
      showToast("Deleted");
      await load();
    } catch (e: any) {
      showToast(e?.message ?? "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">App Reviews</h1>
          <p className="text-sm text-slate-400 mt-1">
            Reviews of the SkillAd platform experience — not provider reviews.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize ${
              filter === s
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            {s}
            {s !== "all" && (
              <span className="ml-1 opacity-70">
                ({reviews.filter((r) => r.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      {loading && <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>}

      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center text-sm text-slate-500">
          No app reviews in this filter yet.
        </div>
      )}

      <div className="space-y-3">
        {visible.map((r) => (
          <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-white">{r.displayName || "SkillAd user"}</p>
                <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
                  <span
                    className={
                      r.userType === "Provider"
                        ? "text-sky-400"
                        : r.userType === "Customer"
                          ? "text-violet-400"
                          : "text-slate-500"
                    }
                  >
                    {r.userType || "Unknown"}
                  </span>
                  {r.city ? <span>· {r.city}</span> : null}
                  <span>· {new Date(r.createdAt).toLocaleString()}</span>
                  <span
                    className={
                      r.status === "approved"
                        ? "text-emerald-400"
                        : r.status === "hidden"
                          ? "text-slate-400"
                          : "text-amber-400"
                    }
                  >
                    · {r.status}
                  </span>
                  {r.featured ? <span className="text-orange-400">· Featured</span> : null}
                </p>
                {(r.appVersion || r.platform) && (
                  <p className="text-[11px] text-slate-600 mt-1">
                    {[r.platform, r.appVersion ? `v${r.appVersion}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="text-amber-400 text-sm font-bold shrink-0">
                {"★".repeat(r.rating)}
                <span className="text-slate-600">{"★".repeat(5 - r.rating)}</span>
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{r.text}</p>
            {r.suggestion ? (
              <p className="text-xs text-slate-400 border-t border-slate-800 pt-2">
                Suggestion: {r.suggestion}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              {r.status !== "approved" && (
                <button
                  disabled={busyId === r.id}
                  onClick={() => void patch(r.id, { status: "approved" })}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                >
                  Approve
                </button>
              )}
              {r.status !== "hidden" && (
                <button
                  disabled={busyId === r.id}
                  onClick={() => void patch(r.id, { status: "hidden" })}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 border border-slate-700"
                >
                  Hide
                </button>
              )}
              <button
                disabled={busyId === r.id}
                onClick={() => void patch(r.id, { featured: !r.featured })}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/25"
              >
                {r.featured ? "Unfeature" : "Feature"}
              </button>
              <button
                disabled={busyId === r.id}
                onClick={() => void remove(r.id)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 ml-auto"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
