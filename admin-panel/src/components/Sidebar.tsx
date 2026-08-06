import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api } from "../lib/api";

const NAV = [
  { path: "/", label: "Dashboard", icon: "📊" },
  { path: "/providers", label: "Providers", icon: "👷" },
  { path: "/users", label: "Users", icon: "👥" },
  { path: "/categories", label: "Categories", icon: "🗂️" },
  { path: "/subscriptions", label: "Subscriptions", icon: "💳" },
  { path: "/advertisements", label: "Advertisements", icon: "📢" },
  { path: "/notifications", label: "Notifications", icon: "🔔" },
  { path: "/content", label: "Content / CMS", icon: "📝" },
  { path: "/app-reviews", label: "App Reviews", icon: "⭐" },
  { path: "/contact-messages", label: "Contact Messages", icon: "✉️" },
  { path: "/rankings", label: "Provider Rankings", icon: "🏆" },
  { path: "/analytics", label: "India Analytics", icon: "🇮🇳" },
  { path: "/translations", label: "Language Manager", icon: "🌐" },
  { path: "/otp-logs", label: "OTP Logs", icon: "🔐" },
  { path: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const [location, navigate] = useLocation();
  const [unreadContact, setUnreadContact] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadBadge() {
      try {
        const d = await api.getContactMessages({ status: "new", page: 1, limit: 1 });
        if (!cancelled) setUnreadContact(d.unreadCount ?? 0);
      } catch {
        if (!cancelled) setUnreadContact(0);
      }
    }
    void loadBadge();
    const t = setInterval(() => void loadBadge(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [location]);

  function go(path: string) {
    navigate(path);
    onClose?.();
  }

  return (
    <aside
      className={`flex flex-col h-full bg-slate-900 border-r border-slate-800 ${mobile ? "w-72" : "w-64"}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
          <img src="/favicon.png" alt="SkillAd" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-none">SkillAd Admin</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">Platform Control Panel</p>
        </div>
        {mobile && (
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-white text-xl">
            ✕
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV.map((item) => {
          const active = item.path === "/" ? location === "/" : location.startsWith(item.path);
          const showBadge = item.path === "/contact-messages" && unreadContact > 0;
          return (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                active
                  ? "bg-orange-500/15 text-orange-400 border border-orange-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {showBadge && (
                <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadContact > 99 ? "99+" : unreadContact}
                </span>
              )}
              {active && !showBadge && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400">Super Admin</span>
        </div>
      </div>
    </aside>
  );
}
