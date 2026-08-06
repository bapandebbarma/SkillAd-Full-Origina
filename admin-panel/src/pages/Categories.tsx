import { useEffect, useState } from "react";
import { api } from "../lib/api";

const ICON_OPTIONS = [
  "flash","git-branch","build","hammer","color-palette","school","medkit","rose",
  "car","restaurant","sparkles","heart","leaf","snow","business","fitness","bicycle","construct",
  "home","briefcase","camera","code","globe","music","paw","pizza","radio","ribbon","shield",
  "star","trophy","wallet","wifi","wine","car-sport","cut","thermometer","shirt","apps",
  "phone-portrait","refresh-circle","body","barbell","laptop","sunny",
  "accessibility","home-outline","water","shield-checkmark","fast-food","volume-high",
  "planet","language","calculator","grid","umbrella","lock-closed","eye",
  "battery-charging","contrast","videocam","brush","code-slash",
  "musical-note","musical-notes","nutrition","cube","easel","happy",
];

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "home">("all");
  const [form, setForm] = useState({
    name: "", icon: "star", subcategories: "", active: true,
    showOnHome: false, homeOrder: "",
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    api.getCategories().then((d: any) => {
      setCategories((d.categories ?? []).sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99)));
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    const data = {
      name: form.name,
      icon: form.icon,
      subcategories: form.subcategories.split(",").map((s) => s.trim()).filter(Boolean),
      active: form.active,
      showOnHome: form.showOnHome,
      homeOrder: form.homeOrder !== "" ? Number(form.homeOrder) : null,
    };
    if (!data.name) { showToast("Name is required"); return; }
    try {
      if (editItem) {
        const res = await api.updateCategory(editItem.id, data);
        setCategories((prev) => prev.map((c) => c.id === editItem.id ? res.category : c));
        showToast("Category updated.");
      } else {
        const res = await api.createCategory({ ...data, order: categories.length + 1, searchCount: 0 });
        setCategories((prev) => [...prev, res.category]);
        showToast("Category created.");
      }
      setEditItem(null);
      setAddOpen(false);
      setForm({ name: "", icon: "star", subcategories: "", active: true, showOnHome: false, homeOrder: "" });
    } catch (e: any) { showToast(e.message); }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    await api.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    showToast("Deleted.");
  }

  async function handleToggleActive(cat: any) {
    const updated = { ...cat, active: !cat.active };
    await api.updateCategory(cat.id, { active: updated.active });
    setCategories((prev) => prev.map((c) => c.id === cat.id ? updated : c));
    showToast(updated.active ? "Category enabled." : "Category disabled.");
  }

  async function handleToggleShowOnHome(cat: any) {
    const updated = { ...cat, showOnHome: !cat.showOnHome };
    await api.updateCategory(cat.id, { showOnHome: updated.showOnHome });
    setCategories((prev) => prev.map((c) => c.id === cat.id ? updated : c));
    showToast(updated.showOnHome ? `"${cat.name}" added to home page.` : `"${cat.name}" removed from home page.`);
  }

  function openEdit(cat: any) {
    setEditItem(cat);
    setForm({
      name: cat.name,
      icon: cat.icon ?? "star",
      subcategories: (cat.subcategories ?? []).join(", "),
      active: cat.active ?? true,
      showOnHome: cat.showOnHome ?? false,
      homeOrder: cat.homeOrder != null ? String(cat.homeOrder) : "",
    });
    setAddOpen(true);
  }

  function openAdd() {
    setEditItem(null);
    setForm({ name: "", icon: "star", subcategories: "", active: true, showOnHome: false, homeOrder: "" });
    setAddOpen(true);
  }

  // In home view show ALL 62 categories so admin can toggle any of them
  const displayed = categories;

  // Sort: home view — showOnHome first (by homeOrder/searchCount), then the rest
  const sorted = viewMode === "home"
    ? [...displayed].sort((a, b) => {
        if (a.showOnHome && !b.showOnHome) return -1;
        if (!a.showOnHome && b.showOnHome) return 1;
        if (a.showOnHome && b.showOnHome) {
          if (a.homeOrder != null && b.homeOrder != null) return a.homeOrder - b.homeOrder;
          if (a.homeOrder != null) return -1;
          if (b.homeOrder != null) return 1;
          return (b.searchCount ?? 0) - (a.searchCount ?? 0);
        }
        return (a.order ?? 99) - (b.order ?? 99);
      })
    : displayed;

  const homeCount = categories.filter((c) => c.showOnHome).length;
  const totalSearches = categories.reduce((s, c) => s + (c.searchCount ?? 0), 0);

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Service Categories</h2>
          <p className="text-slate-400 text-sm mt-1">
            {categories.length} total · <span className="text-orange-400 font-medium">{homeCount} on home page</span>
            {totalSearches > 0 && <span className="text-slate-500"> · {totalSearches} total searches</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openAdd}
            className="px-4 py-2 text-sm font-semibold text-white rounded-xl"
            style={{ background: "linear-gradient(135deg, #FF6B35, #E55020)" }}
          >
            + Add Category
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("all")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${viewMode === "all" ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        >
          All Categories ({categories.length})
        </button>
        <button
          onClick={() => setViewMode("home")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${viewMode === "home" ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        >
          🏠 Home Page ({homeCount})
        </button>
      </div>

      {viewMode === "home" && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
          <span className="font-semibold">All {categories.length} categories are shown below.</span> Toggle the 🏠 switch on any category to show or hide it on the mobile home screen. Categories already on the home page appear first. Within the home group, those with a manual "Home Position" number come first; the rest rank by user search popularity.
        </div>
      )}

      {/* Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-white text-lg">{editItem ? "Edit Category" : "Add Category"}</h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Icon</label>
              <select
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
              >
                {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Subcategories (comma-separated)</label>
              <input
                type="text"
                value={form.subcategories}
                onChange={(e) => setForm((f) => ({ ...f, subcategories: e.target.value }))}
                placeholder="e.g. Wiring, Repair, Installation"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
              />
            </div>

            {/* Home Page Controls */}
            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3 border border-slate-700">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">🏠 Home Page Settings</p>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm((f) => ({ ...f, showOnHome: !f.showOnHome }))}
                  className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${form.showOnHome ? "bg-orange-500" : "bg-slate-700"}`}
                >
                  <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-transform shadow ${form.showOnHome ? "translate-x-5" : "translate-x-1"}`} />
                </div>
                <span className="text-sm text-slate-300">Show on home page</span>
              </label>

              {form.showOnHome && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Home Position (optional — leave blank for auto)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.homeOrder}
                    onChange={(e) => setForm((f) => ({ ...f, homeOrder: e.target.value }))}
                    placeholder="e.g. 1 = top, 2 = second…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Lower number = shown first. Leave blank to sort by popularity automatically.</p>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-slate-300">Active (visible in app)</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setAddOpen(false); setEditItem(null); }} className="flex-1 py-2 text-sm font-medium text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2 text-sm font-bold text-white rounded-xl" style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}>
                {editItem ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🏠</p>
          <p className="font-medium text-slate-400">No categories on home page yet</p>
          <p className="text-sm mt-1">Toggle "Show on Home" for categories you want users to see first</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((cat, i) => (
            <div
              key={cat.id}
              className={`bg-slate-900 border rounded-2xl p-4 transition-all ${cat.active ? "border-slate-800" : "border-slate-800 opacity-50"}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-lg">
                    🏷️
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white text-sm">{cat.name}</p>
                      {cat.showOnHome && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">HOME</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      #{i + 1} · Icon: {cat.icon}
                      {cat.homeOrder != null && <span className="text-blue-400"> · Pos: {cat.homeOrder}</span>}
                      {(cat.searchCount ?? 0) > 0 && <span className="text-emerald-400"> · 🔥 {cat.searchCount} searches</span>}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer" title="Active in app">
                  <input type="checkbox" checked={cat.active} onChange={() => handleToggleActive(cat)} className="sr-only" />
                  <div className={`w-9 h-5 rounded-full transition-colors ${cat.active ? "bg-orange-500" : "bg-slate-700"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ml-0.5 ${cat.active ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                </label>
              </div>

              {/* Show on Home toggle */}
              <div className={`flex items-center justify-between rounded-xl px-3 py-2 mb-3 ${cat.showOnHome ? "bg-orange-500/10 border border-orange-500/25" : "bg-slate-800"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏠</span>
                  <span className={`text-xs font-medium ${cat.showOnHome ? "text-orange-400" : "text-slate-400"}`}>
                    {cat.showOnHome ? "Shown on home page" : "Not on home page"}
                  </span>
                </div>
                <button
                  onClick={() => handleToggleShowOnHome(cat)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${cat.showOnHome ? "bg-orange-500" : "bg-slate-700"}`}
                >
                  <div className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform shadow ${cat.showOnHome ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>

              {cat.subcategories?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {cat.subcategories.map((s: string) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full">{s}</span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(cat)}
                  className="flex-1 py-1.5 text-xs font-medium bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDelete(cat.id, cat.name)}
                  className="flex-1 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
