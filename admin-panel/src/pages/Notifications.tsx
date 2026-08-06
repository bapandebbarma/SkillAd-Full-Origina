import { useEffect, useState } from "react";
import { api } from "../lib/api";

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Users & Providers" },
  { value: "providers", label: "Service Providers Only" },
  { value: "users", label: "Buyers / Users Only" },
  { value: "expiring_soon", label: "⏰ Expiring Subscriptions (≤7 days)" },
  { value: "category", label: "By Category" },
];

const TYPE_OPTIONS = [
  { value: "general", label: "📢 General Announcement", color: "#3B82F6" },
  { value: "promotional", label: "🎁 Promotional", color: "#FF6B35" },
  { value: "alert", label: "⚠️ Alert / Warning", color: "#F59E0B" },
  { value: "reminder", label: "🔔 Subscription Reminder", color: "#8B5CF6" },
];

export default function Notifications() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    audience: "all",
    type: "general",
    category: "",
  });

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    api.getNotifications().then((d: any) => { setHistory(d.notifications ?? []); setLoading(false); });
  }, []);

  async function handleSend() {
    if (!form.title.trim() || !form.body.trim()) { showToast("Title and message are required.", false); return; }
    setSending(true);
    try {
      const res = await api.sendNotification(form);
      setHistory((prev) => [res.notification, ...prev]);
      setForm({ title: "", body: "", audience: "all", type: "general", category: "" });
      showToast("Notification sent successfully!");
    } catch (e: any) { showToast(`Error: ${e.message}`, false); }
    setSending(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.deleteNotification(id);
      setHistory((prev) => prev.filter((n) => n.id !== id));
      showToast("Notification deleted.");
    } catch (e: any) { showToast(`Error: ${e.message}`, false); }
    setDeletingId(null);
  }

  const typeColors: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.color]));

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 border text-white text-sm px-4 py-3 rounded-xl shadow-xl ${toast.ok ? "bg-slate-800 border-slate-700" : "bg-red-900 border-red-700"}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-white">Notifications</h2>
        <p className="text-slate-400 text-sm mt-1">Send push notifications to users and providers</p>
      </div>

      {/* Compose */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-white text-base">Compose Notification</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Audience</label>
            <select
              value={form.audience}
              onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            >
              {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            >
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {form.audience === "category" && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Electrician"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Notification title"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Message *</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Write your notification message here..."
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500 resize-none"
          />
        </div>

        {/* Preview */}
        {(form.title || form.body) && (
          <div className="bg-slate-800 rounded-xl p-4 border-l-4" style={{ borderColor: typeColors[form.type] ?? "#FF6B35" }}>
            <p className="text-xs text-slate-400 mb-2">Preview</p>
            <p className="font-semibold text-white text-sm">{form.title || "Title"}</p>
            <p className="text-xs text-slate-400 mt-1">{form.body || "Message body"}</p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full py-3 text-sm font-bold text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}
        >
          {sending
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
            : "🔔 Send Notification"}
        </button>
      </div>

      {/* History */}
      <div>
        <h3 className="font-semibold text-white text-sm mb-3">Recent Notifications ({history.length})</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm">
            No notifications sent yet.
          </div>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 50).map((n) => (
              <div key={n.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: typeColors[n.type] ?? "#FF6B35" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{n.audience}</span>
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full capitalize">{n.type}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {n.sentAt ? new Date(n.sentAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  disabled={deletingId === n.id}
                  title="Delete notification"
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40"
                >
                  {deletingId === n.id
                    ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
