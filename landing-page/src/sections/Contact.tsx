import { useEffect, useState, type FormEvent } from "react";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSettings, submitContact, type AppSettings } from "@/lib/api";

export default function Contact() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      await submitContact({
        name,
        email,
        phone,
        message,
        subject: subject || "Website contact",
        website: honeypot,
      });
      setStatus("ok");
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
      setHoneypot("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to send");
    }
  }

  const emailAddr = settings?.supportEmail || "";
  const phoneAddr = settings?.supportPhone || "";
  const office = settings?.officeAddress || "";

  const socials = [
    { label: "Facebook", href: settings?.socialFacebook },
    { label: "Instagram", href: settings?.socialInstagram },
    { label: "Twitter", href: settings?.socialTwitter },
    { label: "YouTube", href: settings?.socialYoutube },
    { label: "LinkedIn", href: settings?.socialLinkedin },
  ].filter((s) => s.href);

  const mapsSrc = office
    ? `https://www.google.com/maps?q=${encodeURIComponent(office)}&output=embed`
    : "";

  return (
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Contact us</h2>
          <p className="text-lg text-muted-foreground">
            Questions about SkillAd? Send a message or reach us directly.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2 space-y-4">
            {emailAddr ? (
              <a
                href={`mailto:${emailAddr}`}
                className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 hover:bg-muted/50 transition-colors"
              >
                <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                  <p className="font-medium text-foreground">{emailAddr}</p>
                </div>
              </a>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Support email not configured.
              </div>
            )}

            {phoneAddr ? (
              <a
                href={`tel:${phoneAddr}`}
                className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 hover:bg-muted/50 transition-colors"
              >
                <Phone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                  <p className="font-medium text-foreground">{phoneAddr}</p>
                </div>
              </a>
            ) : null}

            {office ? (
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
                <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Office</p>
                  <p className="font-medium text-foreground whitespace-pre-line">{office}</p>
                </div>
              </div>
            ) : null}

            {socials.length > 0 && (
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-2">Social</p>
                <div className="flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {mapsSrc ? (
              <div className="rounded-2xl overflow-hidden border border-border aspect-[4/3] bg-muted/30">
                <iframe
                  title="Office location"
                  src={mapsSrc}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                <MapPin className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                Office address not available — map will appear when configured.
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="relative lg:col-span-3 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email *</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message *</label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </div>

            {/* Honeypot — hidden from users; bots that fill it are rejected silently */}
            <div className="absolute -left-[9999px] opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input
                id="contact-website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {status === "ok" && (
              <p className="text-sm text-green-600 font-medium whitespace-pre-line">
                Thank you for contacting SkillAd.{"\n"}Your message has been received successfully.
              </p>
            )}
            {status === "error" && (
              <p className="text-sm text-destructive font-medium">{error || "Something went wrong."}</p>
            )}

            <Button type="submit" disabled={status === "sending"} className="rounded-xl font-semibold">
              <Send className="mr-2 h-4 w-4" />
              {status === "sending" ? "Sending…" : "Send message"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
