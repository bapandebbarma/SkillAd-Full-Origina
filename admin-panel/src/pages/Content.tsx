import { useEffect, useRef, useState } from "react";
import { api, API_BASE } from "../lib/api";

const ADMIN_KEY = "skillad-admin";

let _uploadConfig: { supabaseUrl: string; supabaseAnonKey: string; bucket: string } | null = null;

async function getUploadConfig() {
  if (_uploadConfig) return _uploadConfig;
  const res = await fetch(`${API_BASE}/admin/upload-config`, {
    headers: { "x-admin-key": ADMIN_KEY },
  });
  if (!res.ok) return null;
  _uploadConfig = (await res.json()) as {
    supabaseUrl: string;
    supabaseAnonKey: string;
    bucket: string;
  };
  return _uploadConfig;
}

async function uploadScreenshotImage(file: File): Promise<string> {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    throw new Error("Only JPG, PNG, WebP, or GIF images are allowed.");
  }

  try {
    const cfg = await getUploadConfig();
    if (cfg) {
      const filename = `screenshots/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
      const uploadUrl = `${cfg.supabaseUrl}/storage/v1/object/${cfg.bucket}/${filename}`;
      const putRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.supabaseAnonKey}`,
          apikey: cfg.supabaseAnonKey,
          "Content-Type": file.type,
          "x-upsert": "true",
        },
        body: file,
      });
      if (putRes.ok) {
        return `${cfg.supabaseUrl}/storage/v1/object/public/${cfg.bucket}/${filename}`;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const presignRes = await fetch(`${API_BASE}/admin/upload-presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ folder: "screenshots" }),
    });
    if (presignRes.ok) {
      const { signedUrl, publicUrl } = (await presignRes.json()) as {
        signedUrl: string;
        publicUrl: string;
      };
      if (signedUrl && publicUrl) {
        const putRes = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/webp" },
          body: file,
        });
        if (putRes.ok) return publicUrl;
      }
    }
  } catch {
    /* fall through */
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const res = await fetch(`${API_BASE}/admin/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
    body: JSON.stringify({ data: base64, filename: file.name }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `Upload failed (${res.status})`);
  }
  const json = (await res.json()) as { url?: string; fileUrl?: string };
  const url = json.url ?? json.fileUrl;
  if (!url) throw new Error("Server did not return a file URL");
  return url;
}

const TEXT_SECTIONS = [
  { key: "aboutUs", label: "About Us", icon: "ℹ️" },
  { key: "termsOfService", label: "Terms of Service", icon: "📋" },
  { key: "privacyPolicy", label: "Privacy Policy", icon: "🔒" },
  { key: "refundPolicy", label: "Refund Policy", icon: "💸" },
  { key: "helpCentre", label: "Help Centre", icon: "🆘" },
];

const ALL_TABS = [
  ...TEXT_SECTIONS,
  { key: "faqs", label: "FAQ", icon: "❓" },
  { key: "landingHero", label: "Landing (Hero)", icon: "🏠" },
  { key: "features", label: "Features", icon: "✨" },
  { key: "howItWorks", label: "How it Works", icon: "🧭" },
  { key: "screenshots", label: "Screenshots", icon: "📱" },
  { key: "providerCta", label: "Provider CTA", icon: "🚀" },
  { key: "announcements", label: "Announcements", icon: "📣" },
];

const inputClass =
  "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600";
const textareaClass =
  "w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500 resize-none";

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={textareaClass}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </div>
  );
}

export default function Content() {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("aboutUs");
  const [announcementText, setAnnouncementText] = useState("");
  const [uploadingShotId, setUploadingShotId] = useState<string | null>(null);
  const shotFileRef = useRef<HTMLInputElement | null>(null);
  const shotTargetId = useRef<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    api.getContent().then((d: any) => {
      setContent(d.content ?? {});
      setLoading(false);
    });
  }, []);

  function landing() {
    return content?.landing ?? {};
  }

  function updateLanding(patch: Record<string, any>) {
    setContent((c: any) => ({
      ...c,
      landing: { ...(c.landing ?? {}), ...patch },
    }));
  }

  function updateLandingList(key: string, list: any[]) {
    updateLanding({ [key]: list });
  }

  async function saveSection(key: string) {
    setSaving(key);
    try {
      await api.updateContent({ [key]: content[key] });
      showToast("Saved!");
    } catch (e: any) {
      showToast(e.message);
    }
    setSaving(null);
  }

  async function saveLanding(sectionKey: string) {
    setSaving(sectionKey);
    try {
      await api.updateContent({ landing: { ...(content.landing ?? {}) } });
      showToast("Saved!");
    } catch (e: any) {
      showToast(e.message);
    }
    setSaving(null);
  }

  async function saveFaqs() {
    setSaving("faqs");
    try {
      await api.updateContent({ faqs: content.faqs ?? [] });
      showToast("Saved!");
    } catch (e: any) {
      showToast(e.message);
    }
    setSaving(null);
  }

  async function addAnnouncement() {
    if (!announcementText.trim()) return;
    const ann = {
      id: String(Date.now()),
      text: announcementText,
      createdAt: new Date().toISOString(),
    };
    const announcements = [ann, ...(content.announcements ?? [])];
    await api.updateContent({ announcements });
    setContent((c: any) => ({ ...c, announcements }));
    setAnnouncementText("");
    showToast("Announcement added.");
  }

  async function deleteAnnouncement(id: string) {
    const announcements = (content.announcements ?? []).filter((a: any) => a.id !== id);
    await api.updateContent({ announcements });
    setContent((c: any) => ({ ...c, announcements }));
  }

  function addFaq() {
    const faqs = [
      ...(content.faqs ?? []),
      { id: String(Date.now()), question: "", answer: "" },
    ];
    setContent((c: any) => ({ ...c, faqs }));
  }

  function updateFaq(id: string, patch: { question?: string; answer?: string }) {
    const faqs = (content.faqs ?? []).map((f: any) =>
      f.id === id ? { ...f, ...patch } : f
    );
    setContent((c: any) => ({ ...c, faqs }));
  }

  function deleteFaq(id: string) {
    const faqs = (content.faqs ?? []).filter((f: any) => f.id !== id);
    setContent((c: any) => ({ ...c, faqs }));
  }

  function addListItem(listKey: string, item: Record<string, any>) {
    const list = [...(landing()[listKey] ?? []), { id: String(Date.now()), ...item }];
    updateLandingList(listKey, list);
  }

  function updateListItem(listKey: string, id: string, patch: Record<string, any>) {
    const list = (landing()[listKey] ?? []).map((item: any) =>
      item.id === id ? { ...item, ...patch } : item
    );
    updateLandingList(listKey, list);
  }

  function deleteListItem(listKey: string, id: string) {
    const list = (landing()[listKey] ?? []).filter((item: any) => item.id !== id);
    updateLandingList(listKey, list);
  }

  function moveListItem(listKey: string, id: string, dir: -1 | 1) {
    const list = [...(landing()[listKey] ?? [])];
    const idx = list.findIndex((item: any) => item.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[next];
    list[next] = tmp;
    updateLandingList(listKey, list);
  }

  async function onScreenshotFileSelected(file: File | undefined) {
    const id = shotTargetId.current;
    shotTargetId.current = null;
    if (!file || !id) return;
    setUploadingShotId(id);
    try {
      const url = await uploadScreenshotImage(file);
      updateListItem("appScreenshots", id, { url });
      showToast("Screenshot uploaded — remember to Save.");
    } catch (e: any) {
      showToast(e?.message ?? "Upload failed");
    } finally {
      setUploadingShotId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const SaveBtn = ({ sectionKey }: { sectionKey: string }) => (
    <div className="flex justify-end">
      <button
        onClick={() =>
          sectionKey === "faqs"
            ? saveFaqs()
            : ["landingHero", "features", "howItWorks", "screenshots", "providerCta"].includes(sectionKey)
              ? saveLanding(sectionKey)
              : saveSection(sectionKey)
        }
        disabled={saving === sectionKey}
        className="px-5 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50 flex items-center gap-2"
        style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}
      >
        {saving === sectionKey ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…
          </>
        ) : (
          "💾 Save"
        )}
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-white">Content / CMS</h2>
        <p className="text-slate-400 text-sm mt-1">Edit all app content and pages from here</p>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2">
        {ALL_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
              activeSection === s.key
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Text sections */}
      {TEXT_SECTIONS.map(
        (s) =>
          activeSection === s.key && (
            <div key={s.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-white">
                {s.icon} {s.label}
              </h3>
              <textarea
                value={content[s.key] ?? ""}
                onChange={(e) => setContent((c: any) => ({ ...c, [s.key]: e.target.value }))}
                rows={10}
                className={`${textareaClass} font-mono`}
              />
              <SaveBtn sectionKey={s.key} />
            </div>
          )
      )}

      {/* FAQ */}
      {activeSection === "faqs" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">❓ FAQ</h3>
              <button
                onClick={addFaq}
                className="px-3 py-1.5 text-xs font-bold text-white rounded-xl"
                style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}
              >
                + Add FAQ
              </button>
            </div>
            <p className="text-xs text-slate-400">Manage frequently asked questions shown on the landing page and in-app help.</p>
          </div>

          {(content.faqs ?? []).map((f: any, idx: number) => (
            <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 font-medium">FAQ #{idx + 1}</p>
                <button onClick={() => deleteFaq(f.id)} className="text-red-400 hover:text-red-300 text-sm">
                  🗑️
                </button>
              </div>
              <Field
                label="Question"
                value={f.question ?? ""}
                onChange={(v) => updateFaq(f.id, { question: v })}
                placeholder="e.g. How do I book a service?"
              />
              <Field
                label="Answer"
                value={f.answer ?? ""}
                onChange={(v) => updateFaq(f.id, { answer: v })}
                placeholder="Write the answer..."
                rows={3}
              />
            </div>
          ))}

          {(content.faqs ?? []).length === 0 && (
            <p className="text-center text-slate-500 text-sm py-4">No FAQs yet. Click "+ Add FAQ" to create one.</p>
          )}

          <SaveBtn sectionKey="faqs" />
        </div>
      )}

      {/* Landing Hero */}
      {activeSection === "landingHero" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white">🏠 Landing (Hero)</h3>
          <p className="text-xs text-slate-400">Hero section copy on the public landing page.</p>
          <Field
            label="Hero Heading"
            value={landing().heroHeading ?? ""}
            onChange={(v) => updateLanding({ heroHeading: v })}
            placeholder="Nearby Skills. Right When You Need."
            rows={2}
          />
          <Field
            label="Hero Subtitle"
            value={landing().heroSubtitle ?? ""}
            onChange={(v) => updateLanding({ heroSubtitle: v })}
            placeholder="Find verified local professionals..."
            rows={3}
          />
          <Field
            label="Hero Announcement"
            value={landing().heroAnnouncement ?? ""}
            onChange={(v) => updateLanding({ heroAnnouncement: v })}
            placeholder="Optional banner text above the hero"
          />
          <Field
            label="USP Title"
            value={landing().uspTitle ?? ""}
            onChange={(v) => updateLanding({ uspTitle: v })}
            placeholder="No more asking for contact numbers."
          />
          <Field
            label="USP Subtitle"
            value={landing().uspSubtitle ?? ""}
            onChange={(v) => updateLanding({ uspSubtitle: v })}
            placeholder="No more asking friends, neighbours..."
            rows={3}
          />
          <SaveBtn sectionKey="landingHero" />
        </div>
      )}

      {/* Features */}
      {activeSection === "features" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">✨ Feature Cards</h3>
                <p className="text-xs text-slate-400 mt-0.5">Cards shown in the Features section of the landing page.</p>
              </div>
              <button
                onClick={() => addListItem("featureCards", { title: "", description: "" })}
                className="px-3 py-1.5 text-xs font-bold text-white rounded-xl shrink-0"
                style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}
              >
                + Add Card
              </button>
            </div>
          </div>

          {(landing().featureCards ?? []).map((card: any, idx: number) => (
            <div key={card.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 font-medium">Card #{idx + 1}</p>
                <button
                  onClick={() => deleteListItem("featureCards", card.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  🗑️
                </button>
              </div>
              <Field
                label="Title"
                value={card.title ?? ""}
                onChange={(v) => updateListItem("featureCards", card.id, { title: v })}
                placeholder="e.g. Verified Providers"
              />
              <Field
                label="Description"
                value={card.description ?? ""}
                onChange={(v) => updateListItem("featureCards", card.id, { description: v })}
                placeholder="Short description..."
                rows={2}
              />
            </div>
          ))}

          {(landing().featureCards ?? []).length === 0 && (
            <p className="text-center text-slate-500 text-sm py-4">No feature cards yet.</p>
          )}

          <SaveBtn sectionKey="features" />
        </div>
      )}

      {/* How it Works */}
      {activeSection === "howItWorks" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">🧭 How it Works</h3>
                <p className="text-xs text-slate-400 mt-0.5">Step-by-step section on the landing page.</p>
              </div>
              <button
                onClick={() => addListItem("howItWorks", { title: "", description: "" })}
                className="px-3 py-1.5 text-xs font-bold text-white rounded-xl shrink-0"
                style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}
              >
                + Add Step
              </button>
            </div>
          </div>

          {(landing().howItWorks ?? []).map((step: any, idx: number) => (
            <div key={step.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 font-medium">Step #{idx + 1}</p>
                <button
                  onClick={() => deleteListItem("howItWorks", step.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  🗑️
                </button>
              </div>
              <Field
                label="Title"
                value={step.title ?? ""}
                onChange={(v) => updateListItem("howItWorks", step.id, { title: v })}
                placeholder="e.g. Search"
              />
              <Field
                label="Description"
                value={step.description ?? ""}
                onChange={(v) => updateListItem("howItWorks", step.id, { description: v })}
                placeholder="Short description..."
                rows={2}
              />
            </div>
          ))}

          {(landing().howItWorks ?? []).length === 0 && (
            <p className="text-center text-slate-500 text-sm py-4">No steps yet.</p>
          )}

          <SaveBtn sectionKey="howItWorks" />
        </div>
      )}

      {/* Screenshots */}
      {activeSection === "screenshots" && (
        <div className="space-y-4">
          <input
            ref={shotFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void onScreenshotFileSelected(f);
            }}
          />
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">📱 App Screenshots</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload, caption, reorder. Shown inside the landing page phone frame.
                </p>
              </div>
              <button
                onClick={() => addListItem("appScreenshots", { label: "", url: "" })}
                className="px-3 py-1.5 text-xs font-bold text-white rounded-xl shrink-0"
                style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}
              >
                + Add Screenshot
              </button>
            </div>
          </div>

          {(landing().appScreenshots ?? []).map((shot: any, idx: number) => (
            <div key={shot.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 font-medium">Screenshot #{idx + 1}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Move up"
                    onClick={() => moveListItem("appScreenshots", shot.id, -1)}
                    className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded-lg border border-slate-700"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    onClick={() => moveListItem("appScreenshots", shot.id, 1)}
                    className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded-lg border border-slate-700"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => deleteListItem("appScreenshots", shot.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <Field
                label="Caption / Label"
                value={shot.label ?? ""}
                onChange={(v) => updateListItem("appScreenshots", shot.id, { label: v })}
                placeholder="e.g. Dashboard, Search, Booking…"
              />
              <Field
                label="Image URL"
                value={shot.url ?? ""}
                onChange={(v) => updateListItem("appScreenshots", shot.id, { url: v })}
                placeholder="https://… or upload below"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={uploadingShotId === shot.id}
                  onClick={() => {
                    shotTargetId.current = shot.id;
                    shotFileRef.current?.click();
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
                >
                  {uploadingShotId === shot.id ? "Uploading…" : "Upload image"}
                </button>
                {shot.url && (
                  <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800 w-28 h-48">
                    <img
                      src={shot.url}
                      alt={shot.label || "screenshot"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {(landing().appScreenshots ?? []).length === 0 && (
            <p className="text-center text-slate-500 text-sm py-4">
              No screenshots yet. Add one and upload an image.
            </p>
          )}

          <SaveBtn sectionKey="screenshots" />
        </div>
      )}

      {/* Provider CTA */}
      {activeSection === "providerCta" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white">🚀 Provider CTA</h3>
          <p className="text-xs text-slate-400">Call-to-action section encouraging providers to register.</p>
          <Field
            label="Title"
            value={landing().providerCtaTitle ?? ""}
            onChange={(v) => updateLanding({ providerCtaTitle: v })}
            placeholder="Offer your skills. Get discovered nearby."
          />
          <Field
            label="Subtitle"
            value={landing().providerCtaSubtitle ?? ""}
            onChange={(v) => updateLanding({ providerCtaSubtitle: v })}
            placeholder="Register as a provider..."
            rows={3}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Primary Button Label"
              value={landing().providerCtaPrimaryLabel ?? ""}
              onChange={(v) => updateLanding({ providerCtaPrimaryLabel: v })}
              placeholder="Register as Provider"
            />
            <Field
              label="Secondary Button Label"
              value={landing().providerCtaSecondaryLabel ?? ""}
              onChange={(v) => updateLanding({ providerCtaSecondaryLabel: v })}
              placeholder="View Subscription Plans"
            />
          </div>
          <SaveBtn sectionKey="providerCta" />
        </div>
      )}

      {/* Announcements */}
      {activeSection === "announcements" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-white">📣 New Announcement</h3>
            <textarea
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="Write your announcement..."
              rows={3}
              className={textareaClass}
            />
            <button
              onClick={addAnnouncement}
              className="px-4 py-2 text-sm font-bold text-white rounded-xl"
              style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}
            >
              📣 Publish Announcement
            </button>
          </div>

          <div className="space-y-3">
            {(content.announcements ?? []).map((a: any) => (
              <div
                key={a.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="text-sm text-white">{a.text}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {a.createdAt ? new Date(a.createdAt).toLocaleString("en-IN") : ""}
                  </p>
                </div>
                <button onClick={() => deleteAnnouncement(a.id)} className="text-red-400 hover:text-red-300 text-sm">
                  🗑️
                </button>
              </div>
            ))}
            {(content.announcements ?? []).length === 0 && (
              <p className="text-center text-slate-500 text-sm py-4">No announcements yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
