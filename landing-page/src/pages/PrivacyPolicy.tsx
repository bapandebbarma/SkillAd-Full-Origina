import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ICON, fetchSettings, type AppSettings } from "@/lib/api";

const SUPPORT_EMAIL_FALLBACK = "support@skillad.in";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-foreground pt-2">{title}</h2>
      <div className="space-y-3 text-sm sm:text-[15px] text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    document.title = "Privacy Policy — SkillAd";
    fetchSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
    return () => {
      document.title = "SkillAd — Find Nearby Skilled Professionals in India";
    };
  }, []);

  const email = settings?.supportEmail?.trim() || SUPPORT_EMAIL_FALLBACK;
  const phone = settings?.supportPhone?.trim() ?? "";
  const showPhone = phone.length > 0 && !/^(\+91-?)?9{8,}$/.test(phone.replace(/\s/g, ""));
  const year = new Date().getFullYear();

  return (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground shrink-0">
            <img src={ICON} alt="SkillAd" className="h-8 w-8 rounded-lg" />
            <span>
              Skill<span className="text-primary">Ad</span>
            </span>
          </Link>
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Legal</p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: 19 August 2026 · Canonical URL:{" "}
            <a href="https://skillad.in/privacy-policy" className="text-primary hover:underline">
              https://skillad.in/privacy-policy
            </a>
          </p>

          <div className="space-y-8">
            <Section title="1. Who we are">
              <p>
                SkillAd (“SkillAd”, “we”, “us”, or “our”) is an India-wide skills marketplace that
                connects customers with nearby independent service providers. This Privacy Policy
                explains what information we collect through the SkillAd mobile app, website
                (skillad.in), and related services, how we use it, and the choices available to you.
              </p>
              <p>
                SkillAd respects the privacy of its users and service providers. We collect only
                information needed to operate the marketplace: helping users find nearby
                professionals, enabling communication and bookings, processing provider
                subscriptions, and keeping accounts secure.
              </p>
            </Section>

            <Section title="2. Information we collect">
              <p>
                Depending on how you use SkillAd, we may collect the following categories of
                information.
              </p>
              <h3 className="text-foreground font-semibold text-[15px]">
                Account registration and mobile-number OTP authentication
              </h3>
              <p>
                To create an account you provide a mobile number. We send a one-time password (OTP)
                by SMS to verify that you control that number. We store the verified mobile number
                with your account and use it for sign-in, account security, and important service
                messages. We do not use passwords for SkillAd login.
              </p>
              <h3 className="text-foreground font-semibold text-[15px]">Name and profile information</h3>
              <p>
                We collect your name and other profile details you choose to provide (for example
                city or area, languages, and a short bio) so other users can identify you and so we
                can display your profile in the app.
              </p>
              <h3 className="text-foreground font-semibold text-[15px]">Profile photos</h3>
              <p>
                If you upload a profile photo, we store that image and display it on your profile.
                Users are responsible for the photos they upload. Sexually explicit, fake, abusive,
                or unlawful images may result in removal, account suspension, or permanent ban.
              </p>
              <h3 className="text-foreground font-semibold text-[15px]">
                Location / GPS and nearby-service functionality
              </h3>
              <p>
                With your permission, SkillAd uses device location (GPS / network location) to show
                nearby services and improve search accuracy. Location is used to match customers
                with providers whose service area covers the customer’s location. You can deny or
                withdraw location permission in your device settings; nearby discovery will then be
                limited or unavailable.
              </p>
              <h3 className="text-foreground font-semibold text-[15px]">
                Provider skills, categories, and service area
              </h3>
              <p>
                Providers may add skills, service categories, and a service area or radius. This
                information is used to appear in customer search results and on public / in-app
                provider profiles.
              </p>
              <h3 className="text-foreground font-semibold text-[15px]">
                Messaging and communication
              </h3>
              <p>
                Customers and providers can message each other in the app to discuss work. We store
                message content and related metadata as needed to deliver chat, show history, and
                moderate abuse or fraud.
              </p>
              <h3 className="text-foreground font-semibold text-[15px]">Bookings, ratings, and reviews</h3>
              <p>
                When you request or accept a booking, we store booking details and status. After a
                job, users may leave ratings and reviews. Ratings and reviews may be shown on
                provider profiles to help other customers choose a professional.
              </p>
              <h3 className="text-foreground font-semibold text-[15px]">Push notifications</h3>
              <p>
                With your permission, we may send push notifications about bookings, messages,
                subscription reminders, and similar account activity. You can disable notifications
                in device or in-app settings. We store a device notification token for this purpose.
              </p>
              <h3 className="text-foreground font-semibold text-[15px]">Subscriptions</h3>
              <p>
                Providers may purchase a subscription to remain visible and receive booking
                requests. We store plan type, activation and expiry dates, and related status so we
                can provide the paid features you bought.
              </p>
            </Section>

            <Section title="3. Payments (Razorpay)">
              <p>
                Provider subscription payments are processed by Razorpay, a third-party payment
                service. When you pay, Razorpay collects payment details (such as UPI or card
                information) according to Razorpay’s own privacy policy. SkillAd receives
                confirmation of payment, amount, order/payment identifiers, and related status so we
                can activate or renew your subscription. SkillAd does not store full card numbers or
                UPI PINs on SkillAd servers.
              </p>
              <p>
                Razorpay’s privacy policy is available at{" "}
                <a
                  href="https://razorpay.com/privacy/"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://razorpay.com/privacy/
                </a>
                .
              </p>
            </Section>

            <Section title="4. Transactional SMS (MSG91)">
              <p>
                We use MSG91 to send SMS, including login OTPs and transactional messages such as
                payment confirmation, subscription activation, and subscription expiry reminders.
                Your mobile number is shared with MSG91 solely to deliver those messages.
              </p>
            </Section>

            <Section title="5. How we store data (Supabase and SkillAd servers)">
              <p>
                Account, profile, booking, chat, and related application data are stored on SkillAd
                backend systems, including infrastructure provided by Supabase and SkillAd’s own
                API servers. We use these systems to operate the app, authenticate users, and keep
                data available to you.
              </p>
            </Section>

            <Section title="6. How we use information">
              <p>We use the information described above to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>create and secure your account (including OTP login);</li>
                <li>show nearby providers and match service areas to location;</li>
                <li>display profiles, skills, categories, photos, ratings, and reviews;</li>
                <li>enable in-app messaging, bookings, and notifications;</li>
                <li>process provider subscriptions and related receipts;</li>
                <li>prevent fraud, abuse, and illegal content;</li>
                <li>provide customer support; and</li>
                <li>comply with applicable law.</li>
              </ul>
            </Section>

            <Section title="7. Public profile information">
              <p>
                SkillAd does not sell personal user information to unauthorized third parties.
                However, basic profile information such as name, service category, ratings, profile
                photo, and contact options may be visible to other users in the app, and in some
                cases on public web profile pages, so that customers can find and contact providers.
              </p>
            </Section>

            <Section title="8. Third-party service providers">
              <p>
                We share information with service providers only as needed to run SkillAd, including:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>MSG91 — SMS delivery (OTP and transactional messages);</li>
                <li>Razorpay — payment processing for subscriptions;</li>
                <li>Supabase — backend database, authentication-related storage, and hosting;</li>
                <li>hosting and infrastructure providers that store or transmit SkillAd data;</li>
                <li>
                  Google (Play services / Firebase-related device services, where used) for app
                  distribution and push notifications.
                </li>
              </ul>
              <p>
                These providers process information under their own terms and only for the purpose
                of providing their services to SkillAd.
              </p>
            </Section>

            <Section title="9. Data security">
              <p>
                We use reasonable technical and organisational measures to protect personal
                information, including encrypted transport (HTTPS), access controls on
                administrative tools, and mobile-number OTP verification. No method of transmission
                or storage is completely secure. While SkillAd attempts to maintain a safe platform
                through mobile verification and moderation, we cannot guarantee the behaviour or
                authenticity of every user or provider. Please use your own judgment when hiring or
                offering services.
              </p>
            </Section>

            <Section title="10. Data retention">
              <p>
                We keep account and profile information while your account is active. Booking,
                chat, payment history, and subscription records are retained as long as needed to
                provide the service, resolve disputes, prevent fraud, and meet legal, tax, or
                accounting requirements. When you delete your account, we delete or de-identify
                associated personal data as described below, except where we must retain limited
                records by law.
              </p>
            </Section>

            <Section title="11. Account deletion and deletion of associated data">
              <p>
                You may delete your SkillAd account from the mobile app (Profile → Delete Account).
                This permanently deletes your account and associated user data, including profile
                information, photos you uploaded, and in-app records tied to your account, and
                cannot be undone.
              </p>
              <p>
                You may also request deletion by emailing{" "}
                <a href={`mailto:${email}`} className="text-primary hover:underline">
                  {email}
                </a>
                . We will process verified requests within a reasonable period.
              </p>
              <p>
                Some information may remain in backups or legal/audit logs for a limited time.
                Public reviews you posted may be anonymised rather than fully removed where needed
                to preserve other users’ records. Payment processors may retain transaction records
                under their own legal obligations.
              </p>
            </Section>

            <Section title="12. Children">
              <p>
                SkillAd is intended for adults who can enter into service arrangements. We do not
                knowingly collect personal information from children. If you believe a child has
                created an account, contact us and we will delete it.
              </p>
            </Section>

            <Section title="13. Your choices">
              <ul className="list-disc pl-5 space-y-1">
                <li>Edit profile name, photo, skills, and service area in the app.</li>
                <li>Control location and notification permissions in device settings.</li>
                <li>Sign out or delete your account at any time.</li>
                <li>Contact support to ask what data we hold or to request correction.</li>
              </ul>
            </Section>

            <Section title="14. Changes to this policy">
              <p>
                We may update this Privacy Policy from time to time. The updated version will be
                posted at{" "}
                <a href="https://skillad.in/privacy-policy" className="text-primary hover:underline">
                  https://skillad.in/privacy-policy
                </a>
                . Continued use of SkillAd after an update means you accept the revised policy.
              </p>
            </Section>

            <Section title="15. Contact / privacy support">
              <p>
                For privacy questions, data requests, or account-deletion help, contact SkillAd
                support:
              </p>
              <p>
                Email:{" "}
                <a href={`mailto:${email}`} className="text-primary font-medium hover:underline">
                  {email}
                </a>
                <br />
                Website:{" "}
                <a href="https://skillad.in/" className="text-primary hover:underline">
                  https://skillad.in/
                </a>
                {showPhone ? (
                  <>
                    <br />
                    Phone:{" "}
                    <a href={`tel:${phone}`} className="text-primary hover:underline">
                      {phone}
                    </a>
                  </>
                ) : null}
              </p>
              <p>
                You may also use the contact form on{" "}
                <Link href="/#contact" className="text-primary hover:underline">
                  skillad.in
                </Link>
                .
              </p>
            </Section>
          </div>
        </article>
      </main>

      <footer className="bg-[#0B1220] py-10 text-white/55 border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between gap-3 text-sm">
          <p>© {year} SkillAd. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <a href="/privacy-policy" className="hover:text-white">
              Privacy Policy
            </a>
            <a href={`mailto:${email}`} className="hover:text-white">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
