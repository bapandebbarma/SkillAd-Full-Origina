import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

type ContactStatus = "new" | "read" | "replied" | "closed";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  status: ContactStatus;
  readAt: string | null;
  repliedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  source: string;
};

const STATUS_FILTERS = ["all", "new", "read", "replied", "closed"] as const;
const PAGE_SIZE = 10;

const STATUS_COLOR: Record<ContactStatus, string> = {
  new: "text-amber-400",
  read: "text-sky-400",
  replied: "text-emerald-400",
  closed: "text-slate-400",
};

export default function ContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getContactMessages({
        status: filter,
        search,
        page,
        limit: PAGE_SIZE,
      });
      setMessages(d.messages ?? []);
      setTotal(d.total ?? 0);
      setUnreadCount(d.unreadCount ?? 0);
    } catch {
      setMessages([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const viewing = messages.find((m) => m.id === viewId) ?? null;

  async function patch(id: string, status: ContactStatus) {
    setBusyId(id);
    try {
      await api.updateContactMessage(id, { status });
      showToast(`Marked ${status}`);
      await load();
    } catch (e: any) {
      showToast(e?.message ?? "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this contact message permanently?")) return;
    setBusyId(id);
    try {
      await api.deleteContactMessage(id);
      if (viewId === id) setViewId(null);
      showToast("Deleted");
      await load();
    } catch (e: any) {
      showToast(e?.message ?? "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">
            Contact Messages
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Messages from the SkillAd landing page contact form.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            placeholder="Search name, email, subject…"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
          />
          <button
            onClick={applySearch}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-200 border border-slate-700"
          >
            Search
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize ${
              filter === s
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            {s}
            {s === "new" && unreadCount > 0 && (
              <span className="ml-1 opacity-70">({unreadCount})</span>
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

      {!loading && messages.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center text-sm text-slate-500">
          No contact messages in this filter yet.
        </div>
      )}

      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-white">{m.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
                  <a href={`mailto:${m.email}`} className="text-sky-400 hover:underline">
                    {m.email}
                  </a>
                  {m.phone ? <span>· {m.phone}</span> : null}
                  <span>· {new Date(m.createdAt).toLocaleString()}</span>
                  <span className={STATUS_COLOR[m.status]}>· {m.status}</span>
                </p>
                <p className="text-sm text-slate-300 mt-2 font-medium truncate">{m.subject}</p>
                <p className="text-sm text-slate-400 mt-1 line-clamp-2 whitespace-pre-wrap">{m.message}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                disabled={busyId === m.id}
                onClick={() => setViewId(m.id)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-slate-200 border border-slate-700"
              >
                View
              </button>
              {m.status !== "read" && (
                <button
                  disabled={busyId === m.id}
                  onClick={() => void patch(m.id, "read")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-600/20 text-sky-400 border border-sky-600/30"
                >
                  Mark Read
                </button>
              )}
              {m.status !== "replied" && (
                <button
                  disabled={busyId === m.id}
                  onClick={() => void patch(m.id, "replied")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                >
                  Mark Replied
                </button>
              )}
              {m.status !== "closed" && (
                <button
                  disabled={busyId === m.id}
                  onClick={() => void patch(m.id, "closed")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 border border-slate-700"
                >
                  Mark Closed
                </button>
              )}
              <button
                disabled={busyId === m.id}
                onClick={() => void remove(m.id)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 ml-auto"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-700 text-slate-300 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages} · {total} total
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-700 text-slate-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setViewId(null)} />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">{viewing.name}</h2>
                <p className={`text-xs mt-1 capitalize ${STATUS_COLOR[viewing.status]}`}>
                  {viewing.status}
                </p>
              </div>
              <button
                onClick={() => setViewId(null)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd className="text-sky-400">{viewing.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="text-slate-200">{viewing.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Subject</dt>
                <dd className="text-slate-200">{viewing.subject}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Date & Time</dt>
                <dd className="text-slate-200">{new Date(viewing.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">IP Address</dt>
                <dd className="text-slate-200">{viewing.ipAddress || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Source</dt>
                <dd className="text-slate-200">{viewing.source}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 mb-1">Message</dt>
                <dd className="text-slate-200 whitespace-pre-wrap leading-relaxed rounded-xl border border-slate-800 bg-slate-950 p-3">
                  {viewing.message}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              {viewing.status === "new" && (
                <button
                  onClick={() => void patch(viewing.id, "read")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-600/20 text-sky-400 border border-sky-600/30"
                >
                  Mark Read
                </button>
              )}
              <button
                onClick={() => void patch(viewing.id, "replied")}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
              >
                Mark Replied
              </button>
              <button
                onClick={() => void patch(viewing.id, "closed")}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 border border-slate-700"
              >
                Mark Closed
              </button>
              <button
                onClick={() => void remove(viewing.id)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 ml-auto"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
