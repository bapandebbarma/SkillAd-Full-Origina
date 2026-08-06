import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Download, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON } from "@/lib/api";

export type HeaderModal = "privacy" | "terms" | "contact" | "download" | null;

interface HeaderProps {
  onModal: (t: HeaderModal) => void;
  onDownload: () => void;
  languages?: string[];
}

const NAV = [
  { href: "#how-it-works", label: "How it Works" },
  { href: "#categories", label: "Categories" },
  { href: "#nearby", label: "Providers" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export default function Header({ onModal, onDownload, languages = [] }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const langs = languages.length > 0 ? languages : ["English"];
  const [lang, setLang] = useState(langs[0]);

  useEffect(() => {
    if (languages.length > 0 && !languages.includes(lang)) {
      setLang(languages[0]);
    }
  }, [languages, lang]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/75 backdrop-blur-xl border-b border-white/50 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[4.25rem] flex items-center justify-between gap-3">
        <a href="#" className="flex items-center gap-2.5 shrink-0">
          <img src={ICON} alt="SkillAd" className="w-9 h-9 rounded-xl shadow-md ring-1 ring-black/5" />
          <span className="font-extrabold text-xl tracking-tight text-foreground">
            Skill<span className="text-primary">Ad</span>
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-7">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2.5 py-1.5">
            <Languages className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer max-w-[7rem]"
              aria-label="Language"
            >
              {langs.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={onDownload} className="hidden sm:inline-flex font-semibold shadow-sm rounded-xl">
            <Download className="mr-2 h-4 w-4" />
            Download App
          </Button>

          <motion.button
            type="button"
            className="lg:hidden h-10 w-10 rounded-xl border border-border flex items-center justify-center text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            whileTap={{ scale: 0.94 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-5 w-5" />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu className="h-5 w-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden overflow-hidden border-t border-border bg-white shadow-lg"
          >
            <div className="px-4 py-4 space-y-3">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block text-sm font-medium text-foreground py-2"
                >
                  {item.label}
                </a>
              ))}
              <div className="flex items-center gap-2 py-1">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-muted/40 px-2 py-2 text-sm"
                >
                  {langs.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={() => {
                  setOpen(false);
                  onDownload();
                }}
                className="w-full rounded-xl font-semibold"
              >
                <Download className="mr-2 h-4 w-4" />
                Download App
              </Button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onModal("contact");
                }}
                className="w-full text-sm text-muted-foreground py-2"
              >
                Contact
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
