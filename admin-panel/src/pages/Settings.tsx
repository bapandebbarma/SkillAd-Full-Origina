import { useEffect, useState } from "react";
import { api } from "../lib/api";

function Field({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600"
      />
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    api.getSettings().then((d: any) => { setSettings(d.settings ?? {}); setLoading(false); });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      showToast("Settings saved!");
    } catch (e: any) { showToast(e.message); }
    setSaving(false);
  }

  function update(key: string, value: any) {
    setSettings((s: any) => ({ ...s, [key]: value }));
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-white">Platform Settings</h2>
        <p className="text-slate-400 text-sm mt-1">Configure global app settings</p>
      </div>

      {/* Basic info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm">Basic Information</h3>

        {[
          { key: "appName", label: "App Name", type: "text" },
          { key: "websiteUrl", label: "Website URL (used in invitations & links)", type: "url" },
          { key: "supportEmail", label: "Support Email", type: "email" },
          { key: "supportPhone", label: "Support Phone", type: "tel" },
          { key: "defaultCity", label: "Default City", type: "text" },
        ].map(({ key, label, type }) => (
          <div key={key}>
            <label className="block text-xs text-slate-400 mb-1">{label}</label>
            <input
              type={type}
              value={settings[key] ?? ""}
              onChange={(e) => update(key, e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>
        ))}
      </div>

      {/* ── Website / Social ── */}
      <div className="bg-slate-900 border border-orange-500/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🌐</span>
          <div>
            <h3 className="font-semibold text-white text-sm">Website / Social</h3>
            <p className="text-xs text-slate-400 mt-0.5">Footer social links and office address on the landing page</p>
          </div>
        </div>

        <Field
          label="Facebook URL"
          value={settings.socialFacebook ?? ""}
          onChange={(v) => update("socialFacebook", v)}
          placeholder="https://facebook.com/skillad"
        />
        <Field
          label="Instagram URL"
          value={settings.socialInstagram ?? ""}
          onChange={(v) => update("socialInstagram", v)}
          placeholder="https://instagram.com/skillad"
        />
        <Field
          label="Twitter / X URL"
          value={settings.socialTwitter ?? ""}
          onChange={(v) => update("socialTwitter", v)}
          placeholder="https://twitter.com/skillad"
        />
        <Field
          label="YouTube URL"
          value={settings.socialYoutube ?? ""}
          onChange={(v) => update("socialYoutube", v)}
          placeholder="https://youtube.com/@skillad"
        />
        <Field
          label="LinkedIn URL"
          value={settings.socialLinkedin ?? ""}
          onChange={(v) => update("socialLinkedin", v)}
          placeholder="https://linkedin.com/company/skillad"
        />
        <div>
          <label className="block text-xs text-slate-400 mb-1">Office Address</label>
          <textarea
            value={settings.officeAddress ?? ""}
            onChange={(e) => update("officeAddress", e.target.value)}
            rows={3}
            placeholder="e.g. Agartala, Tripura, India"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600 resize-none"
          />
        </div>
      </div>

      {/* ── App Store Links ── */}
      <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🔗</span>
          <div>
            <h3 className="font-semibold text-white text-sm">App Download Links</h3>
            <p className="text-xs text-slate-400 mt-0.5">Used on the "Invite Friends" share screen in the mobile app</p>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Google Play Store Link</label>
          <input
            type="url"
            value={settings.playStoreLink ?? ""}
            onChange={(e) => update("playStoreLink", e.target.value)}
            placeholder="https://play.google.com/store/apps/details?id=com.skillad"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Apple App Store Link</label>
          <input
            type="url"
            value={settings.appStoreLink ?? ""}
            onChange={(e) => update("appStoreLink", e.target.value)}
            placeholder="https://apps.apple.com/app/skillad/id123456789"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600"
          />
        </div>

        {(settings.playStoreLink || settings.appStoreLink) && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
            ✅ When users tap <span className="font-semibold">"Invite Friends"</span> in the app, the Play Store link will be shared. Update this field whenever your store listing URL changes.
          </div>
        )}
        {!settings.playStoreLink && !settings.appStoreLink && (
          <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-400">
            💡 Once you publish on Google Play / App Store, paste your store link here. Until then, the app shares <span className="font-mono text-slate-300">https://skillad.in</span> as a fallback.
          </div>
        )}
      </div>

      {/* ── Bank Account Details ── */}
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🏦</span>
          <div>
            <h3 className="font-semibold text-white text-sm">Bank Account Details</h3>
            <p className="text-xs text-slate-400 mt-0.5">For receiving subscription payments from service providers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Field
            label="Account Holder Name"
            value={settings.bankAccountName ?? ""}
            onChange={(v) => update("bankAccountName", v)}
            placeholder="e.g. Raju Tripura Services Pvt Ltd"
          />
          <Field
            label="Bank Name"
            value={settings.bankName ?? ""}
            onChange={(v) => update("bankName", v)}
            placeholder="e.g. State Bank of India"
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Account Number"
              value={settings.bankAccountNumber ?? ""}
              onChange={(v) => update("bankAccountNumber", v)}
              placeholder="e.g. 1234567890"
            />
            <Field
              label="Confirm Account Number"
              value={settings.bankAccountNumberConfirm ?? ""}
              onChange={(v) => update("bankAccountNumberConfirm", v)}
              placeholder="Re-enter account number"
            />
          </div>

          {settings.bankAccountNumber && settings.bankAccountNumberConfirm && settings.bankAccountNumber !== settings.bankAccountNumberConfirm && (
            <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">⚠️ Account numbers do not match</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="IFSC Code"
              value={settings.bankIfsc ?? ""}
              onChange={(v) => update("bankIfsc", v.toUpperCase())}
              placeholder="e.g. SBIN0001234"
            />
            <Field
              label="Branch Name"
              value={settings.bankBranch ?? ""}
              onChange={(v) => update("bankBranch", v)}
              placeholder="e.g. Agartala Main Branch"
            />
          </div>
        </div>

        {/* Account number preview (masked) */}
        {settings.bankAccountNumber && settings.bankAccountNumber.length >= 4 && (
          <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center gap-2">
            <span>🔐</span>
            <span>Stored account: <span className="text-slate-300 font-mono">{"•".repeat(Math.max(0, settings.bankAccountNumber.length - 4))}{settings.bankAccountNumber.slice(-4)}</span></span>
          </div>
        )}
      </div>

      {/* ── UPI Details ── */}
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📱</span>
          <div>
            <h3 className="font-semibold text-white text-sm">UPI Payment Details</h3>
            <p className="text-xs text-slate-400 mt-0.5">Providers can pay instantly via UPI — most common in India</p>
          </div>
        </div>

        <Field
          label="UPI ID"
          value={settings.upiId ?? ""}
          onChange={(v) => update("upiId", v)}
          placeholder="e.g. skillad@ybl or 9876543210@paytm"
        />

        <Field
          label="UPI Name (shown to payers)"
          value={settings.upiName ?? ""}
          onChange={(v) => update("upiName", v)}
          placeholder="e.g. SkillAd Payments"
        />

        <Field
          label="UPI Phone Number (optional)"
          value={settings.upiPhone ?? ""}
          onChange={(v) => update("upiPhone", v)}
          placeholder="e.g. 9876543210"
        />

        {settings.upiId && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300">
            💡 Providers will see your UPI ID <span className="font-mono font-bold">{settings.upiId}</span> when paying for subscriptions.
          </div>
        )}
      </div>

      {/* ── Payment Instructions ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-white text-sm">Payment Instructions for Providers</h3>
        <p className="text-xs text-slate-400">This message is shown to providers on the subscription payment screen in the app.</p>
        <div>
          <textarea
            value={settings.paymentInstructions ?? ""}
            onChange={(e) => update("paymentInstructions", e.target.value)}
            rows={4}
            placeholder={`e.g. Pay via UPI to skillad@ybl or bank transfer and send a screenshot to our WhatsApp at +91 XXXXXXXXXX for activation.`}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600 resize-none"
          />
          <p className="text-[10px] text-slate-500 mt-1">{(settings.paymentInstructions ?? "").length}/500 characters</p>
        </div>
      </div>

      {/* Platform controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm">Platform Controls</h3>

        {[
          { key: "registrationOpen", label: "Registration Open", desc: "Allow new providers to register" },
          { key: "paymentGatewayEnabled", label: "Payment Gateway", desc: "Enable paid subscriptions" },
          { key: "maintenanceMode", label: "Maintenance Mode", desc: "Show maintenance page to all users" },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <button
              onClick={() => update(key, !settings[key])}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${settings[key] ? "bg-orange-500" : "bg-slate-700"}`}
            >
              <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-transform shadow ${settings[key] ? "translate-x-7" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Language Management */}
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🌐</span>
          <div>
            <h3 className="font-semibold text-white text-sm">Language Management</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control which languages users can select in the app. Enable a language when expanding to that region.
            </p>
          </div>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300">
          💡 <strong>English</strong> is always enabled and cannot be turned off. Changes take effect immediately when users open the app.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { code: "English",   native: "English",        script: "Latin",      flag: "🇮🇳", locked: true },
            { code: "Assamese",  native: "অসমীয়া",         script: "Assamese",   flag: "🇮🇳" },
            { code: "Bengali",   native: "বাংলা",           script: "Bengali",    flag: "🇮🇳" },
            { code: "Bodo",      native: "बड़ो",            script: "Devanagari", flag: "🇮🇳" },
            { code: "Dogri",     native: "डोगरी",           script: "Devanagari", flag: "🇮🇳" },
            { code: "Gujarati",  native: "ગુજરાતી",         script: "Gujarati",   flag: "🇮🇳" },
            { code: "Hindi",     native: "हिंदी",           script: "Devanagari", flag: "🇮🇳" },
            { code: "Kannada",   native: "ಕನ್ನಡ",           script: "Kannada",    flag: "🇮🇳" },
            { code: "Kashmiri",  native: "कश्मीरी",         script: "Devanagari", flag: "🇮🇳" },
            { code: "Kokborok",  native: "ককবরক",          script: "Bengali",    flag: "🇮🇳" },
            { code: "Konkani",   native: "कोंकणी",          script: "Devanagari", flag: "🇮🇳" },
            { code: "Maithili",  native: "मैथिली",          script: "Devanagari", flag: "🇮🇳" },
            { code: "Malayalam", native: "മലയാളം",          script: "Malayalam",  flag: "🇮🇳" },
            { code: "Manipuri",  native: "মণিপুরী",         script: "Bengali",    flag: "🇮🇳" },
            { code: "Marathi",   native: "मराठी",           script: "Devanagari", flag: "🇮🇳" },
            { code: "Nepali",    native: "नेपाली",          script: "Devanagari", flag: "🇮🇳" },
            { code: "Odia",      native: "ଓଡ଼ିଆ",           script: "Odia",       flag: "🇮🇳" },
            { code: "Punjabi",   native: "ਪੰਜਾਬੀ",          script: "Gurmukhi",   flag: "🇮🇳" },
            { code: "Sanskrit",  native: "संस्कृत",         script: "Devanagari", flag: "🇮🇳" },
            { code: "Santali",   native: "ᱥᱟᱱᱛᱟᱲᱤ",       script: "Ol Chiki",   flag: "🇮🇳" },
            { code: "Sindhi",    native: "سندھی",           script: "Devanagari", flag: "🇮🇳" },
            { code: "Tamil",     native: "தமிழ்",           script: "Tamil",      flag: "🇮🇳" },
            { code: "Telugu",    native: "తెలుగు",          script: "Telugu",     flag: "🇮🇳" },
            { code: "Urdu",      native: "اردو",            script: "Nastaliq",   flag: "🇮🇳" },
          ].map(({ code, native, script, locked }) => {
            const enabled = (settings.enabledLanguages ?? ["English", "Bengali", "Hindi", "Kokborok", "Manipuri"]).includes(code);
            return (
              <div
                key={code}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
                  enabled ? "bg-indigo-500/10 border-indigo-500/30" : "bg-slate-800/50 border-slate-700/50"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{code}</p>
                  <p className="text-xs text-slate-400 truncate">{native} · {script}</p>
                </div>
                {locked ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 shrink-0">Always ON</span>
                ) : (
                  <button
                    onClick={() => {
                      const current: string[] = settings.enabledLanguages ?? ["English", "Bengali", "Hindi", "Kokborok", "Manipuri"];
                      const next = enabled
                        ? current.filter((l: string) => l !== code)
                        : [...current, code];
                      update("enabledLanguages", next);
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? "bg-indigo-500" : "bg-slate-700"}`}
                  >
                    <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-transform shadow ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-500">
          {(settings.enabledLanguages ?? ["English", "Bengali", "Hindi", "Kokborok", "Manipuri"]).length} of 24 languages enabled · Click <strong className="text-slate-400">Save Settings</strong> to apply changes
        </p>
      </div>

      {/* Numeric settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm">Service Settings</h3>

        {[
          { key: "maxServiceRadius", label: "Max Service Radius (km)", min: 1, max: 500 },
          { key: "freeTrialDays", label: "Free Trial Days", min: 0, max: 365 },
        ].map(({ key, label, min, max }) => (
          <div key={key}>
            <label className="block text-xs text-slate-400 mb-1">{label}</label>
            <input
              type="number"
              min={min}
              max={max}
              value={settings[key] ?? 0}
              onChange={(e) => update(key, Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>
        ))}
      </div>

      {/* Security */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm">Security</h3>
        <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-xs text-slate-400">
          <p><span className="text-slate-300 font-medium">Admin Key:</span> Set via <code className="bg-slate-700 text-orange-300 px-1.5 py-0.5 rounded">ADMIN_KEY</code> environment variable on the API server.</p>
          <p><span className="text-slate-300 font-medium">Current Key:</span> <code className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">skillad-admin</code> (default)</p>
          <p>To change it, update the <code className="bg-slate-700 text-orange-300 px-1.5 py-0.5 rounded">ADMIN_KEY</code> secret in your deployment environment.</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-xs text-slate-400">
          <p className="text-slate-300 font-medium">Admin Roles</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-sm">👑</div>
            <div>
              <p className="text-slate-300 text-sm font-medium">Super Admin</p>
              <p className="text-xs text-slate-500">Full access to all features</p>
            </div>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">Active</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 flex items-center gap-2"
          style={{ background: "linear-gradient(135deg,#FF6B35,#E55020)" }}
        >
          {saving ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : "💾 Save Settings"}
        </button>
      </div>
    </div>
  );
}
