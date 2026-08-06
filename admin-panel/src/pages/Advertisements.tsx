import { useEffect, useRef, useState } from "react";
import { api, API_BASE } from "../lib/api";

const ADMIN_KEY = "skillad-admin";

const BLANK = {
  title: "",
  subtitle: "",
  imageUrl: "",
  linkUrl: "",
  targetCategory: "",
  startDate: "",
  endDate: "",
  active: true,
};

const BUILD_VER = "v4";

// Cache upload config so we only fetch it once per session
let _uploadConfig: { supabaseUrl: string; supabaseAnonKey: string; bucket: string } | null = null;

async function getUploadConfig() {
  if (_uploadConfig) return _uploadConfig;
  const res = await fetch(`${API_BASE}/admin/upload-config`, {
    headers: { "x-admin-key": ADMIN_KEY },
  });
  if (!res.ok) return null;
  _uploadConfig = await res.json() as { supabaseUrl: string; supabaseAnonKey: string; bucket: string };
  return _uploadConfig;
}

async function uploadImage(file: File): Promise<string> {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    throw new Error("Only JPG, PNG, WebP, or GIF images are allowed.");
  }

  // ── Strategy 1: upload directly to Supabase Storage from the browser ─────────
  // Fetches the anon key from our server (tiny GET, no CORS issue), then PUTs
  // the image straight to supabase.co — which always allows cross-origin uploads.
  try {
    const cfg = await getUploadConfig();
    if (cfg) {
      const filename = `${Date.now()}.webp`;
      const uploadUrl = `${cfg.supabaseUrl}/storage/v1/object/${cfg.bucket}/${filename}`;
      const putRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfg.supabaseAnonKey}`,
          "apikey": cfg.supabaseAnonKey,
          "Content-Type": file.type,
          "x-upsert": "true",
        },
        body: file,
      });
      if (putRes.ok) {
        return `${cfg.supabaseUrl}/storage/v1/object/public/${cfg.bucket}/${filename}`;
      }
      // Non-ok from Supabase might mean policy missing — fall through
    }
  } catch { /* fall through to legacy upload */ }

  // ── Strategy 2: presigned URL via API server ──────────────────────────────────
  try {
    const presignRes = await fetch(`${API_BASE}/admin/upload-presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({}),
    });
    if (presignRes.ok) {
      const { signedUrl, publicUrl } = await presignRes.json() as { signedUrl: string; publicUrl: string };
      if (signedUrl && publicUrl) {
        const putRes = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/webp" },
          body: file,
        });
        if (putRes.ok) return publicUrl;
      }
    }
  } catch { /* fall through */ }

  // ── Strategy 3: legacy base64 through API server ──────────────────────────────
  const uploadUrl = `${API_BASE}/admin/upload`;
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ data: base64, filename: file.name }),
    });
  } catch (networkErr: any) {
    throw new Error(
      "Upload failed — all 3 methods tried.\n\n" +
      "Workaround: Upload your image to Supabase Storage manually (Storage → ads bucket → Upload file), copy the public URL, then paste it in the URL field below.\n\n" +
      `Detail: ${networkErr?.message ?? networkErr}`
    );
  }

  if (!res.ok) {
    let serverMsg = "";
    try { const j = await res.json() as { error?: string }; serverMsg = j.error ?? ""; } catch { /* ignore */ }
    throw new Error(`HTTP ${res.status}: ${serverMsg || res.statusText}`);
  }

  const json = await res.json() as { url?: string; fileUrl?: string };
  const url = json.url ?? json.fileUrl;
  if (!url) throw new Error("Server did not return a file URL");
  return url;
}

export default function Advertisements() {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    api.getAds().then((d: any) => { setAds(d.ads ?? []); setLoading(false); });
  }, []);

  function openCreate() {
    setEditItem(null);
    setForm({ ...BLANK });
    setFormOpen(true);
  }

  function openEdit(ad: any) {
    setEditItem(ad);
    setForm({
      title: ad.title ?? "",
      subtitle: ad.subtitle ?? "",
      imageUrl: ad.imageUrl ?? "",
      linkUrl: ad.linkUrl ?? "",
      targetCategory: ad.targetCategory ?? "",
      startDate: ad.startDate ?? "",
      endDate: ad.endDate ?? "",
      active: ad.active ?? true,
    });
    setFormOpen(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
      showToast("Image uploaded!");
    } catch (err: any) {
      showToast(err?.message ?? "Image upload failed. Please try again.");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!form.title) { showToast("Title is required"); return; }
    try {
      if (editItem) {
        const res = await api.updateAd(editItem.id, form);
        setAds((prev) => prev.map((a) => a.id === editItem.id ? res.ad : a));
        showToast("Ad updated.");
      } else {
        const res = await api.createAd(form);
        setAds((prev) => [res.ad, ...prev]);
        showToast("Ad created.");
      }
      setFormOpen(false);
      setEditItem(null);
    } catch (e: any) { showToast(e.message); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this ad?")) return;
    await api.deleteAd(id);
    setAds((prev) => prev.filter((a) => a.id !== id));
    showToast("Ad deleted.");
  }

  async function handleToggle(ad: any) {
    const updated = { ...ad, active: !ad.active };
    await api.updateAd(ad.id, { active: updated.active });
    setAds((prev) => prev.map((a) => a.id === ad.id ? updated : a));
    showToast(updated.active ? "Ad activated." : "Ad deactivated.");
  }

  const now = new Date().toISOString();
  const activeAds = ads.filter((a) => a.active && (!a.endDate || a.endDate > now));

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Advertisements <span className="text-xs font-normal text-orange-400 ml-2">{BUILD_VER}</span></h2>
          <p className="text-slate-400 text-sm mt-1">{ads.length} total • {activeAds.length} live in app</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 text-sm font-semibold text-white rounded-xl" style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}>
          + New Ad
        </button>
      </div>

      {/* Form modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-white text-lg">{editItem ? "Edit Ad" : "Create Ad"}</h3>

            {/* Image upload section */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Ad Image</label>

              {/* Current image preview */}
              {form.imageUrl && (
                <div className="relative mb-3 rounded-xl overflow-hidden border border-slate-700">
                  <img
                    src={form.imageUrl}
                    alt="Ad preview"
                    className="w-full h-40 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <button
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white text-sm flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Upload button */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 py-3 border-2 border-dashed border-slate-600 rounded-xl text-sm text-slate-400 hover:border-orange-500 hover:text-orange-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <><span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Uploading…</>
                  ) : (
                    <>📷 {form.imageUrl ? "Change Image" : "Upload Image"}</>
                  )}
                </button>
              </div>

              {/* Or paste URL */}
              <div className="mt-2">
                <p className="text-[10px] text-slate-500 mb-1">or paste an image URL:</p>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Other fields */}
            {[
              { key: "title", label: "Title *", placeholder: "e.g. Get 20% Off!" },
              { key: "subtitle", label: "Subtitle", placeholder: "e.g. First booking on home cleaning" },
              { key: "linkUrl", label: "Click-through URL (optional)", placeholder: "https://..." },
              { key: "targetCategory", label: "Target Category (optional)", placeholder: "e.g. Electrician" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <input
                  type="text"
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
              <span className="text-sm text-slate-300">Active (show in app immediately)</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setFormOpen(false); setEditItem(null); }} className="flex-1 py-2.5 text-sm font-medium text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl" style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}>
                {editItem ? "Update Ad" : "Create Ad"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-500">
          <p className="text-3xl mb-3">📢</p>
          <p className="text-sm">No advertisements yet.</p>
          <p className="text-xs mt-1">Create your first ad — it will appear on the mobile home screen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => {
            const isLive = ad.active && (!ad.endDate || ad.endDate > now);
            return (
              <div key={ad.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {ad.imageUrl ? (
                  <img src={ad.imageUrl} alt={ad.title} className="w-full h-36 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-full h-36 bg-gradient-to-br from-orange-500/20 to-purple-500/20 flex items-center justify-center text-4xl">📢</div>
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white text-sm">{ad.title || "(No title)"}</p>
                      {ad.subtitle && <p className="text-xs text-slate-400 mt-0.5">{ad.subtitle}</p>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isLive ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                      {isLive ? "🟢 Live" : "⚫ Inactive"}
                    </span>
                  </div>

                  {(ad.startDate || ad.endDate) && (
                    <p className="text-[10px] text-slate-500">
                      {ad.startDate && `From: ${ad.startDate}`}
                      {ad.startDate && ad.endDate && " · "}
                      {ad.endDate && `To: ${ad.endDate}`}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => handleToggle(ad)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${ad.active ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"}`}>
                      {ad.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => openEdit(ad)} className="flex-1 py-1.5 text-xs font-medium bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">✏️ Edit</button>
                    <button onClick={() => handleDelete(ad.id)} className="py-1.5 px-2.5 text-xs font-medium bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20">🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-xs text-slate-400">
        <p><span className="text-blue-400 font-medium">ℹ️ How it works:</span> Active ads appear in the banner slider on the mobile home screen. Ads with an image show the photo; ads without show a colored gradient. Changes go live immediately.</p>
      </div>
    </div>
  );
}
