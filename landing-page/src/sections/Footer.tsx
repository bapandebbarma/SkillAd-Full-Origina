import { useEffect, useState } from "react";
import { ICON, fetchSettings, type AppSettings } from "@/lib/api";

export type FooterModal = "privacy" | "terms" | "contact" | "refund" | null;

interface FooterProps {
  onModal: (t: FooterModal) => void;
  onDownload: () => void;
}

export default function Footer({ onModal, onDownload }: FooterProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  const socials = [
    { label: "Facebook", href: settings?.socialFacebook },
    { label: "Instagram", href: settings?.socialInstagram },
    { label: "Twitter", href: settings?.socialTwitter },
    { label: "YouTube", href: settings?.socialYoutube },
    { label: "LinkedIn", href: settings?.socialLinkedin },
  ].filter((s) => s.href);

  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0B1220] py-16 text-white/55 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={ICON} alt="SkillAd" className="w-8 h-8 rounded-xl" />
              <span className="font-extrabold text-lg text-white">
                Skill<span className="text-primary">Ad</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              India&apos;s local skills marketplace — find nearby professionals and grow your service business.
            </p>
            {settings?.supportEmail ? (
              <a href={`mailto:${settings.supportEmail}`} className="block mt-4 text-sm text-white/70 hover:text-white">
                {settings.supportEmail}
              </a>
            ) : null}
            {settings?.supportPhone ? (
              <a href={`tel:${settings.supportPhone}`} className="block mt-1 text-sm text-white/70 hover:text-white">
                {settings.supportPhone}
              </a>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/35 mb-4">Quick links</p>
            <div className="flex flex-col gap-2 text-sm">
              <a href="/#how-it-works" className="hover:text-white transition-colors">How it Works</a>
              <a href="/#categories" className="hover:text-white transition-colors">Categories</a>
              <a href="/#nearby" className="hover:text-white transition-colors">Providers</a>
              <a href="/#faq" className="hover:text-white transition-colors">FAQ</a>
              <a href="/#contact" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/35 mb-4">Legal</p>
            <div className="flex flex-col gap-2 text-sm">
              <a href="/privacy-policy" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <button type="button" onClick={() => onModal("terms")} className="text-left hover:text-white transition-colors">
                Terms of Service
              </button>
              <button type="button" onClick={() => onModal("refund")} className="text-left hover:text-white transition-colors">
                Refund Policy
              </button>
              <button type="button" onClick={() => onModal("contact")} className="text-left hover:text-white transition-colors">
                Support
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/35 mb-4">Get the app</p>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              Download App
            </button>
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-5">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:text-white transition-colors"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-3 text-xs text-white/40">
          <p>© {year} {settings?.appName || "SkillAd"}. All rights reserved.</p>
          <p>Made for India&apos;s skilled workforce</p>
        </div>
      </div>
    </footer>
  );
}
