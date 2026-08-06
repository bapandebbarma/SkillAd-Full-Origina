import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", city: "" });
  const [counts, setCounts] = useState<{ totalRegistered?: number; totalCustomers?: number; totalProviders?: number }>({});

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function loadUsers() {
    setLoading(true);
    setError(null);
    api.getUsers()
      .then((d: any) => {
        setUsers(d.users ?? []);
        setCounts({
          totalRegistered: d.totalRegistered,
          totalCustomers: d.totalCustomers,
          totalProviders: d.totalProviders,
        });
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message ?? "Failed to load users. Check API server.");
        setLoading(false);
      });
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleToggleBlock(user: any) {
    const updated = { ...user, blocked: !user.blocked };
    await api.updateUser(user.id, { blocked: updated.blocked });
    setUsers((prev) => prev.map((u) => u.id === user.id ? updated : u));
    showToast(updated.blocked ? "User blocked." : "User unblocked.");
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this user and all their data (messages, conversations, provider profile, auth account, avatar)?")) return;
    try {
      const result: any = await api.deleteUser(id);
      if (result && result.success === false) {
        const errMsg = Array.isArray(result.errors) ? result.errors.join("; ") : "Deletion failed";
        showToast(`❌ Delete failed: ${errMsg}`);
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast("User and all related data deleted.");
    } catch (err: any) {
      showToast(`❌ Delete error: ${err?.message ?? "Unknown error"}`);
    }
  }

  async function handleAdd() {
    if (!form.name || !form.phone) { showToast("Name and phone are required."); return; }
    const user = { id: `usr-${Date.now()}`, ...form, blocked: false, createdAt: new Date().toISOString() };
    await api.updateUser(user.id, user);
    setUsers((prev) => [user, ...prev]);
    setForm({ name: "", phone: "", city: "" });
    setAddOpen(false);
    showToast("User added.");
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.phone?.includes(q) || u.city?.toLowerCase().includes(q);
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
          <h2 className="text-2xl font-bold text-white">Customers / Buyers</h2>
          <p className="text-slate-400 text-sm mt-1">
            {users.length} customer{users.length !== 1 ? "s" : ""}
            {counts.totalProviders != null && counts.totalProviders > 0 && (
              <span className="ml-2 text-slate-500">· {counts.totalProviders} provider{counts.totalProviders !== 1 ? "s" : ""} (in Providers section)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadUsers}
            className="px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800 rounded-xl hover:bg-slate-700 transition-all"
            title="Refresh"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all"
            style={{ background: "linear-gradient(135deg, #FF6B35, #E55020)" }}
          >
            + Add User
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <span className="text-red-400 text-sm flex-1">⚠ {error}</span>
          <button onClick={loadUsers} className="text-xs text-red-400 underline">Retry</button>
        </div>
      )}

      <input
        type="text"
        placeholder="Search name, phone, city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500 transition-colors"
      />

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-white text-lg">Add User</h3>
            {["name", "phone", "city"].map((field) => (
              <div key={field}>
                <label className="block text-xs text-slate-400 mb-1 capitalize">{field}</label>
                <input
                  type="text"
                  value={(form as any)[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAddOpen(false)} className="flex-1 py-2 text-sm font-medium text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700">Cancel</button>
              <button onClick={handleAdd} className="flex-1 py-2 text-sm font-bold text-white rounded-xl" style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}>Add</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-2xl mb-2">👥</p>
            <p className="text-sm">{users.length === 0 ? "No users registered yet" : "No results"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  {["User", "Phone", "City", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                          {u.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-sm font-medium text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{u.phone}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{u.city ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${u.blocked ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        {u.blocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleBlock(u)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${u.blocked ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-red-500/15 text-red-400 hover:bg-red-500/25"}`}
                        >
                          {u.blocked ? "Unblock" : "Block"}
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
                        >
                          Delete
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
    </div>
  );
}
