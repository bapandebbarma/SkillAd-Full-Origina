import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { API_BASE } from "../lib/api";

const ADMIN_KEY = "skillad-admin";

const ALL_LANGUAGES = [
  "Hindi","Bengali","Tamil","Telugu","Marathi","Gujarati","Kannada",
  "Malayalam","Punjabi","Odia","Assamese","Urdu","Nepali","Maithili",
  "Sindhi","Konkani","Bodo","Dogri","Kashmiri","Kokborok","Manipuri",
  "Sanskrit","Santali",
];

interface Entry {
  key: string; // internal only — never shown to admin
  translations: Record<string, string>;
  updatedAt: string;
}

function apiFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY, ...(opts.headers ?? {}) },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Single editable cell
// ─────────────────────────────────────────────────────────────────────────────
function EditCell({
  entryKey, lang, value,
  onSave,
}: {
  entryKey: string; lang: string; value: string;
  onSave: (key: string, lang: string, val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [state,   setState]   = useState<"idle"|"saving"|"saved"|"error">("idle");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  function startEdit() {
    setDraft(value);
    setEditing(true);
    setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 0);
  }

  async function commit() {
    setEditing(false);
    if (draft.trim() === value.trim()) return;
    setState("saving");
    try {
      await onSave(entryKey, lang, draft.trim());
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setDraft(value);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape")            { setDraft(value); setEditing(false); }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void commit(); }
  }

  const empty   = !value.trim();
  const isRtl   = ["Urdu", "Kashmiri", "Sindhi", "Arabic"].includes(lang);

  return (
    <td
      onClick={!editing ? startEdit : undefined}
      className={[
        "relative border-b border-r border-slate-700/40 align-top",
        empty   ? "bg-red-950/50 hover:bg-red-900/40"
                : state === "saved" ? "bg-emerald-950/30 hover:bg-slate-700/20"
                : "hover:bg-slate-700/20",
        !editing && "cursor-text",
      ].join(" ")}
      style={{ minWidth: 170, maxWidth: 260 }}
    >
      {editing ? (
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={onKeyDown}
          dir={isRtl ? "rtl" : "ltr"}
          rows={2}
          className="absolute inset-0 w-full h-full resize-none bg-white text-slate-900 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-400 z-10"
        />
      ) : (
        <div className="px-3 py-2.5 flex items-start gap-2 min-h-[48px]">
          {empty ? (
            <span className="text-red-400/70 text-xs italic select-none flex-1">— not translated —</span>
          ) : (
            <span dir={isRtl ? "rtl" : "ltr"} className="text-sm text-white flex-1 leading-snug" title={value}>
              {value}
            </span>
          )}
          <span className="flex-shrink-0 text-xs mt-0.5">
            {state === "saving" && <span className="text-slate-400 animate-pulse">…</span>}
            {state === "saved"  && <span className="text-emerald-400">✓</span>}
            {state === "error"  && <span className="text-red-400">✗</span>}
          </span>
        </div>
      )}
    </td>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// "Add New Word" modal — English text only, key is auto-generated internally
// ─────────────────────────────────────────────────────────────────────────────
function AddWordModal({
  langs, onClose, onCreate,
}: {
  langs: string[];
  onClose: () => void;
  onCreate: (e: Entry) => void;
}) {
  const [english, setEnglish] = useState("");
  const [others,  setOthers]  = useState<Record<string,string>>({});
  const [error,   setError]   = useState("");
  const [busy,    setBusy]    = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!english.trim()) { setError("Please enter the English text"); return; }
    setBusy(true); setError("");
    // Generate an internal key from the English text — admin never sees this
    const key = english.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || `word_${Date.now()}`;
    const translations: Record<string,string> = { English: english.trim() };
    for (const [l, v] of Object.entries(others)) { if (v.trim()) translations[l] = v.trim(); }
    try {
      const r = await apiFetch("/admin/translations", {
        method: "POST",
        body: JSON.stringify({ key, translations }),
      });
      if (r.status === 409) {
        // Key collision — append timestamp to make unique
        const r2 = await apiFetch("/admin/translations", {
          method: "POST",
          body: JSON.stringify({ key: `${key}_${Date.now()}`, translations }),
        });
        if (!r2.ok) throw new Error();
        onCreate(await r2.json() as Entry);
      } else if (!r.ok) {
        throw new Error();
      } else {
        onCreate(await r.json() as Entry);
      }
      onClose();
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Add New App Text</h2>
            <p className="text-slate-400 text-xs mt-0.5">Type the English version — add translations below (optional)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center transition-colors">×</button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* English — primary field */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                English Text <span className="text-red-400">*</span>
              </label>
              <input
                value={english}
                onChange={(e) => setEnglish(e.target.value)}
                placeholder='e.g. "Edit Profile" or "Available Now"'
                autoFocus
                className="w-full bg-slate-900 border border-slate-600 focus:border-orange-500 text-white rounded-xl px-4 py-3 text-sm focus:outline-none placeholder-slate-500"
              />
            </div>

            {/* Language translations — optional */}
            {langs.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-400">
                  Add translations now <span className="font-normal text-slate-500">(or leave blank and fill in the table later)</span>
                </p>
                {langs.map((lang) => (
                  <div key={lang} className="flex items-center gap-3">
                    <span className="text-slate-300 text-sm w-24 flex-shrink-0">{lang}</span>
                    <input
                      value={others[lang] ?? ""}
                      onChange={(e) => setOthers((p) => ({ ...p, [lang]: e.target.value }))}
                      placeholder={`${lang}…`}
                      dir={["Urdu","Kashmiri","Sindhi"].includes(lang) ? "rtl" : "ltr"}
                      className="flex-1 bg-slate-900 border border-slate-700 focus:border-orange-500 text-white rounded-xl px-3 py-2 text-sm focus:outline-none placeholder-slate-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{error}</p>
            )}
          </div>

          <div className="flex gap-3 px-5 py-4 border-t border-slate-700 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={busy || !english.trim()}
              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
              {busy ? "Saving…" : "Add Text"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Language column picker
// ─────────────────────────────────────────────────────────────────────────────
function LangPicker({ selected, onToggle }: { selected: string[]; onToggle: (l: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-10 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm rounded-xl flex items-center gap-2 transition-colors"
      >
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        <span>Select Languages</span>
        <span className="bg-orange-500/25 text-orange-400 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {selected.length}
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-40 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 w-64">
          <p className="text-slate-500 text-xs px-1 pb-2 border-b border-slate-800 mb-2">
            Choose which languages to show as columns
          </p>
          <div className="grid grid-cols-2 gap-0.5 max-h-64 overflow-y-auto">
            {ALL_LANGUAGES.map((lang) => {
              const on = selected.includes(lang);
              return (
                <label key={lang}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
                    on ? "bg-orange-500/15 text-orange-300" : "text-slate-300 hover:bg-slate-800"
                  }`}>
                  <input type="checkbox" checked={on} onChange={() => onToggle(lang)}
                    className="accent-orange-500 w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{lang}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 30;

export default function Translations() {
  const [entries,      setEntries]      = useState<Entry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [selectedLangs, setSelected]   = useState<string[]>(["Hindi", "Bengali", "Kokborok"]);
  const [showMissing,  setShowMissing]  = useState(false);
  const [page,         setPage]         = useState(1);
  const [addOpen,      setAddOpen]      = useState(false);
  const [toast,        setToast]        = useState<{msg:string;ok:boolean}|null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch("/translations");
      if (r.ok) setEntries(await r.json() as Entry[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const saveCell = useCallback(async (key: string, lang: string, val: string) => {
    const r = await apiFetch(`/admin/translations/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ translations: { [lang]: val } }),
    });
    if (!r.ok) throw new Error("save failed");
    const updated = await r.json() as Entry;
    setEntries((prev) => prev.map((e) => e.key === key ? updated : e));
  }, []);

  function toggleLang(lang: string) {
    setSelected((prev) => prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]);
    setPage(1);
  }

  // Missing count per language (for the warning bar)
  const missingCounts = useMemo(() =>
    Object.fromEntries(selectedLangs.map((l) => [
      l, entries.filter((e) => !e.translations[l]?.trim()).length,
    ])),
    [entries, selectedLangs]
  );

  // Filtered rows
  const filtered = useMemo(() => {
    let list = entries;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        (e.translations["English"] ?? "").toLowerCase().includes(q)
      );
    }
    if (showMissing) {
      list = list.filter((e) =>
        selectedLangs.some((l) => !e.translations[l]?.trim())
      );
    }
    return list;
  }, [entries, search, showMissing, selectedLangs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalMissing = Object.values(missingCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 min-h-screen">

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl text-white ${toast.ok ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      {/* ── Add modal ─────────────────────────────────────────────────────── */}
      {addOpen && (
        <AddWordModal
          langs={selectedLangs}
          onClose={() => setAddOpen(false)}
          onCreate={(entry) => {
            setEntries((prev) => [...prev, entry]);
            showToast("New text added to the table");
          }}
        />
      )}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Translation Editor</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {loading ? "Loading…" : `${entries.length} texts · click any cell to correct a translation`}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Text
        </button>
      </div>

      {/* ── Missing translations warning ──────────────────────────────────── */}
      {!loading && totalMissing > 0 && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-red-300 font-semibold text-sm">⚠ Missing translations:</span>
          {selectedLangs.filter((l) => missingCounts[l] > 0).map((l) => (
            <span key={l} className="bg-red-900/50 text-red-300 text-xs px-2.5 py-1 rounded-lg font-medium">
              {l}: {missingCounts[l]} missing
            </span>
          ))}
          <button
            onClick={() => { setShowMissing(true); setPage(1); }}
            className="ml-auto text-xs text-red-400 hover:text-red-200 underline underline-offset-2 transition-colors"
          >
            Show only missing →
          </button>
        </div>
      )}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2.5 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder='Search by English text, e.g. "Edit Profile"'
            className="w-full h-10 bg-slate-800 border border-slate-700 focus:border-orange-500 text-white placeholder-slate-500 rounded-xl pl-9 pr-4 text-sm focus:outline-none"
          />
          {search && (
            <button onClick={() => { setSearch(""); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-lg leading-none transition-colors">×</button>
          )}
        </div>

        {/* Show missing toggle */}
        <button
          onClick={() => { setShowMissing((v) => !v); setPage(1); }}
          className={`h-10 px-4 rounded-xl text-sm font-medium flex items-center gap-2 border transition-colors ${
            showMissing
              ? "bg-red-900/40 border-red-700/50 text-red-300"
              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
          }`}
        >
          <span>🔴</span>
          <span>{showMissing ? "Showing missing" : "Show missing only"}</span>
          {showMissing && (
            <span className="bg-red-500/25 text-red-300 text-xs px-1.5 py-0.5 rounded-full">{filtered.length}</span>
          )}
        </button>

        {/* Language picker */}
        <LangPicker selected={selectedLangs} onToggle={toggleLang} />
      </div>

      {/* ── Active language pills ─────────────────────────────────────────── */}
      {selectedLangs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center -mt-1">
          <span className="text-slate-600 text-xs">Showing:</span>
          <span className="bg-slate-700/50 text-slate-300 text-xs px-2.5 py-1 rounded-full border border-slate-700">English</span>
          {selectedLangs.map((lang) => (
            <button key={lang} onClick={() => toggleLang(lang)} title={`Remove ${lang} column`}
              className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 transition-colors ${
                (missingCounts[lang] ?? 0) > 0
                  ? "bg-red-900/30 border-red-700/40 text-red-300 hover:bg-red-900/50"
                  : "bg-orange-500/15 border-orange-500/25 text-orange-300 hover:bg-slate-700 hover:border-slate-600 hover:text-slate-300"
              }`}>
              {lang}
              {(missingCounts[lang] ?? 0) > 0 && <span className="font-bold text-red-400">·{missingCounts[lang]}</span>}
              <span className="opacity-40 ml-0.5">×</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="border border-slate-700 rounded-2xl overflow-hidden flex-1">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-sm">Loading translations…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 space-y-3 text-slate-500">
            <p className="text-4xl">🌐</p>
            <p className="text-sm">
              {search
                ? `No texts match "${search}"`
                : showMissing
                  ? "Great! All selected languages are fully translated."
                  : "No texts yet — click \"Add New Text\" to start."}
            </p>
            {showMissing && (
              <button onClick={() => setShowMissing(false)}
                className="text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors">
                Show all texts
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {/* ── Column headers ── */}
              <thead>
                <tr className="bg-slate-900 border-b-2 border-slate-700">
                  {/* English header — sticky */}
                  <th className="text-left px-4 py-3.5 text-slate-300 font-semibold text-xs uppercase tracking-wider sticky left-0 bg-slate-900 z-10 border-r border-slate-700/60"
                    style={{ minWidth: 220 }}>
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      English
                      <span className="bg-blue-500/15 text-blue-400 text-xs px-1.5 py-0.5 rounded-full font-normal normal-case tracking-normal">
                        read only
                      </span>
                    </div>
                  </th>
                  {/* Language headers */}
                  {selectedLangs.map((lang) => (
                    <th key={lang} className="text-left px-4 py-3.5 text-slate-300 font-semibold text-xs"
                      style={{ minWidth: 180 }}>
                      <div className="flex items-center gap-2">
                        <span className="uppercase tracking-wider">{lang}</span>
                        {(missingCounts[lang] ?? 0) > 0 && (
                          <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full font-normal normal-case tracking-normal">
                            {missingCounts[lang]} missing
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* ── Rows ── */}
              <tbody>
                {rows.map((entry, ri) => {
                  const english = entry.translations["English"] ?? entry.key;
                  return (
                    <tr key={entry.key}
                      className={`group transition-colors ${ri % 2 === 0 ? "" : "bg-slate-800/20"}`}>

                      {/* English cell — read only, sticky */}
                      <td className="px-4 py-2.5 border-b border-r border-slate-700/40 sticky left-0 z-10 bg-slate-900/95 align-top"
                        style={{ minWidth: 220 }}>
                        <span className="text-slate-200 text-sm leading-snug">{english}</span>
                      </td>

                      {/* Editable language cells */}
                      {selectedLangs.map((lang) => (
                        <EditCell
                          key={lang}
                          entryKey={entry.key}
                          lang={lang}
                          value={entry.translations[lang] ?? ""}
                          onSave={saveCell}
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-slate-400 text-sm">
            Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length} texts
          </p>
          <div className="flex items-center gap-1">
            {[
              { label: "«", action: () => setPage(1),                  disabled: page === 1 },
              { label: "‹", action: () => setPage((p) => p - 1),       disabled: page === 1 },
            ].map(({ label, action, disabled }) => (
              <button key={label} onClick={action} disabled={disabled}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg disabled:opacity-30 transition-colors">
                {label}
              </button>
            ))}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              return start + i;
            }).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 text-xs rounded-lg transition-colors font-medium ${
                  p === page ? "bg-orange-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                }`}>
                {p}
              </button>
            ))}
            {[
              { label: "›", action: () => setPage((p) => p + 1),       disabled: page === totalPages },
              { label: "»", action: () => setPage(totalPages),          disabled: page === totalPages },
            ].map(({ label, action, disabled }) => (
              <button key={label} onClick={action} disabled={disabled}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg disabled:opacity-30 transition-colors">
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer hint ───────────────────────────────────────────────────── */}
      <p className="text-slate-700 text-xs text-center pb-1">
        Click any cell to correct a translation · Press Enter or click away to save · Red = not yet translated
      </p>
    </div>
  );
}
