import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = resolve(__dirname, "../data");

function readJson<T>(name: string, fallback: T): T {
  try {
    const f = resolve(DATA_DIR, `${name}.json`);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8")) as T;
  } catch { /* fall through */ }
  return fallback;
}

function writeJson(name: string, value: unknown): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, `${name}.json`), JSON.stringify(value, null, 2), "utf-8");
}

const router = Router();

// ── Supabase env vars ──────────────────────────────────────────────────────────
const SUPABASE_URL = (() => {
  const raw = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw.replace(/\/rest\/v1.*$/, "").replace(/\/$/, "");
  }
})();
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

// ── MSG91 SMS (only live OTP delivery provider) ────────────────────────────────
// MSG91_TEMPLATE_ID must be the DLT-verified SkillAd_Login_OTP template ID.
const MSG91_API_KEY     = process.env["MSG91_API_KEY"]     ?? "";
const MSG91_TEMPLATE_ID = process.env["MSG91_TEMPLATE_ID"] ?? "";
const MSG91_CONFIGURED  = !!MSG91_API_KEY && !!MSG91_TEMPLATE_ID;

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

// ── OTP Test Mode ──────────────────────────────────────────────────────────────
// Demo OTP "123456" is accepted only when OTP_TEST_MODE is explicitly true/1/yes.
// Missing OTP_TEST_MODE is treated as false (including production).
function envFlagTrue(name: string): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
const OTP_TEST_MODE = envFlagTrue("OTP_TEST_MODE");

if (IS_PRODUCTION && OTP_TEST_MODE) {
  logger.warn("⚠️  OTP_TEST_MODE is explicitly ON in production — demo OTP '123456' is enabled. Disable unless this is intentional.");
}

// ── Startup diagnostic ─────────────────────────────────────────────────────────
logger.info(
  {
    nodeEnv:           process.env["NODE_ENV"] ?? "(not set)",
    otpTestMode:       OTP_TEST_MODE,
    msg91Configured:   MSG91_CONFIGURED,
    msg91Template:     MSG91_TEMPLATE_ID ? "SkillAd_Login_OTP" : "(NOT SET)",
    supabaseUrl:       SUPABASE_URL || "(NOT SET)",
    supabaseKey:       SUPABASE_SERVICE_KEY ? `***${SUPABASE_SERVICE_KEY.slice(-4)}` : "(NOT SET)",
  },
  "🔐 Auth service startup",
);

if (OTP_TEST_MODE) {
  logger.warn("⚠️  OTP_TEST_MODE is ON — demo OTP '123456' accepted & OTPs returned in responses.");
}

if (!MSG91_CONFIGURED && !OTP_TEST_MODE) {
  logger.warn("⚠️  MSG91 is not configured — OTP sending will fail for all requests");
}

// ── Supabase admin helpers ─────────────────────────────────────────────────────
function supabaseAdminHeaders() {
  return {
    apikey:          SUPABASE_SERVICE_KEY,
    Authorization:   `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type":  "application/json",
  };
}

async function supabaseAdminCreateUser(payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method:  "POST",
    headers: supabaseAdminHeaders(),
    body:    JSON.stringify(payload),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) return { user: null, error: data };
  return { user: data, error: null };
}

async function supabaseAdminGenerateMagicLink(email: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method:  "POST",
    headers: supabaseAdminHeaders(),
    body:    JSON.stringify({ type: "magiclink", email }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) return { hashed_token: null };
  return { hashed_token: (data.hashed_token as string) ?? null };
}

// ── OTP store ─────────────────────────────────────────────────────────────────
interface OtpRecord {
  otp:      string;
  expiry:   number;
  sentAt:   number;
  attempts: number;
  channel:  "sms";
}
const otpStore = new Map<string, OtpRecord>();

// Clean expired entries every 5 minutes
setInterval(() => {
  try {
    const now = Date.now();
    for (const [key, rec] of otpStore.entries()) {
      if (now > rec.expiry) otpStore.delete(key);
    }
  } catch (err) {
    logger.error(
      {
        kind: "otp_store_cleanup",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        err,
      },
      "OTP store cleanup failed",
    );
  }
}, 5 * 60 * 1000);

// ── OTP activity log (last 200 events) ────────────────────────────────────────
interface OtpLogEntry {
  ts:      string;
  phone:   string;
  event:   "send" | "resend" | "verify_ok" | "verify_fail" | "expired" | "blocked";
  channel?: string;
  detail?: string;
}
const otpLog: OtpLogEntry[] = [];

function addLog(phone: string, event: OtpLogEntry["event"], channel?: string, detail?: string) {
  const masked = phone.length >= 4 ? `+91 XXXXXX${phone.slice(-4)}` : phone;
  otpLog.unshift({ ts: new Date().toISOString(), phone: masked, event, channel, detail });
  if (otpLog.length > 200) otpLog.pop();
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── MSG91 SMS delivery ─────────────────────────────────────────────────────────
async function sendMsg91Otp(digits: string, otp: string): Promise<{ ok: boolean; error?: string }> {
  if (!MSG91_CONFIGURED) return { ok: false, error: "MSG91 not configured" };
  try {
    // MSG91 Send OTP v5. `otp` maps to ##OTP## on SkillAd_Login_OTP.
    // otp_length/otp_expiry must match generateOtp() (6 digits) and in-memory expiry (10 min).
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "authkey": MSG91_API_KEY },
      body:    JSON.stringify({
        template_id: MSG91_TEMPLATE_ID,
        mobile:      `91${digits}`,
        otp,
        otp_length:  6,
        otp_expiry:  10,
      }),
    });
    const data = (await res.json()) as { type?: string; message?: string };
    if (data.type === "success") return { ok: true };
    return { ok: false, error: data.message ?? `MSG91 error (http=${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

async function deliverOtp(
  digits: string,
  otp:    string,
): Promise<{ ok: boolean; channel: "sms"; error?: string }> {
  if (!MSG91_CONFIGURED) {
    return { ok: false, channel: "sms", error: "MSG91 not configured" };
  }

  const smsResult = await sendMsg91Otp(digits, otp);
  if (smsResult.ok) {
    logger.info({ digits: `***${digits.slice(-4)}`, template: "SkillAd_Login_OTP" }, "OTP delivered via MSG91 SMS ✓");
    return { ok: true, channel: "sms" };
  }
  return { ok: false, channel: "sms", error: smsResult.error };
}

// ── GET /api/auth/status ───────────────────────────────────────────────────────
router.get("/auth/status", (_req, res) => {
  const resp: Record<string, unknown> = {
    ok:                 true,
    whatsappConfigured: false,
    msg91Configured:    MSG91_CONFIGURED,
    msg91Fallback:      MSG91_CONFIGURED,
    supabaseReady:      !!SUPABASE_URL && !!SUPABASE_SERVICE_KEY,
    nodeEnv:            process.env["NODE_ENV"] ?? "(not set)",
    otpTestMode:        OTP_TEST_MODE,
    version:            "v28",
    otpDelivery:        MSG91_CONFIGURED ? "sms" : "none",
    note: OTP_TEST_MODE
      ? "OTP_TEST_MODE is ON. Demo OTP 123456 accepted. Real OTP returned in send-otp response."
      : MSG91_CONFIGURED
        ? "OTPs delivered via MSG91 SMS (SkillAd_Login_OTP)."
        : "WARNING: MSG91 is not configured. OTP delivery unavailable.",
  };
  if (OTP_TEST_MODE) {
    resp["warning"] = "⚠️ TEST MODE ACTIVE — OTP 123456 bypasses real SMS. Disable OTP_TEST_MODE before going live.";
  }
  res.json(resp);
});

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
router.post("/auth/send-otp", async (req, res) => {
  const { phone } = req.body as { phone?: string };

  logger.info({ phone: phone ? `***${String(phone).slice(-4)}` : "(missing)" }, "send-otp request");

  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }

  const digits = normalizePhone(phone);
  if (digits.length !== 10) {
    res.status(400).json({ error: "Enter a valid 10-digit mobile number" });
    return;
  }

  // Rate limit: 60 seconds between sends
  const existing = otpStore.get(digits);
  if (existing && Date.now() - existing.sentAt < 60 * 1000) {
    const waitSec = Math.ceil((60 * 1000 - (Date.now() - existing.sentAt)) / 1000);
    addLog(digits, "blocked", undefined, `Rate limited — ${waitSec}s remaining`);
    res.status(429).json({ error: `Please wait ${waitSec} seconds before requesting another OTP.` });
    return;
  }

  // In local/test mode allow OTP generation even without MSG91
if (!OTP_TEST_MODE && !MSG91_CONFIGURED) {
  addLog(digits, "blocked", undefined, "No OTP service configured");
  res.status(503).json({
    error: "OTP service is not configured. Please contact support."
  });
  return;
}

  const otp = generateOtp();
  otpStore.set(digits, {
    otp,
    expiry:   Date.now() + 10 * 60 * 1000,
    sentAt:   Date.now(),
    attempts: 0,
    channel:  "sms",
  });

  const { ok, channel, error: deliveryErr } = await deliverOtp(digits, otp);

  if (ok) {
    // Update stored channel so logs are accurate
    const rec = otpStore.get(digits);
    if (rec) rec.channel = channel;
    addLog(digits, "send", channel);
    if (!IS_PRODUCTION) logger.info({ otp, channel }, "DEV: OTP (server logs only)");
    // In test mode: return the OTP in the response so testers don't need real SMS
    if (OTP_TEST_MODE) {
      logger.warn({ otp, channel }, "OTP_TEST_MODE: returning OTP in response");
      res.json({ success: true, channel, devOtp: otp });
    } else {
      res.json({ success: true, channel });
    }
  } else {
    addLog(digits, "blocked", channel, deliveryErr);
    if (OTP_TEST_MODE) {
      logger.warn({ deliveryErr }, "send-otp: delivery failed but OTP kept in store (OTP_TEST_MODE) — use devOtp or '123456'");
      res.json({ success: true, channel: "dev", devOtp: otp });
    } else {
      otpStore.delete(digits);
      logger.error({ deliveryErr }, "send-otp failed — MSG91 delivery failed");
      res.status(503).json({ error: "Unable to send OTP. Please try again or contact support." });
    }
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
router.post("/auth/verify-otp", async (req, res) => {
  const { phone, otp, name, isProvider } = req.body as {
    phone?:      string;
    otp?:        string;
    name?:       string;
    isProvider?: boolean;
  };

  logger.info(
    { phone: phone ? `***${String(phone).slice(-4)}` : "(missing)", otpLen: otp?.length ?? 0 },
    "verify-otp request",
  );

  if (!phone || !otp) {
    res.status(400).json({ error: "phone and otp are required" });
    return;
  }

  const digits    = normalizePhone(phone);
  const fullPhone = `+91${digits}`;

  // Validate OTP
  const stored = otpStore.get(digits);
  if (!stored || Date.now() > stored.expiry) {
    addLog(digits, "expired");
    res.status(400).json({ error: "OTP expired. Please request a new one." });
    return;
  }

  stored.attempts += 1;

  if (stored.attempts > 5) {
    otpStore.delete(digits);
    addLog(digits, "blocked", stored.channel, "Max attempts exceeded");
    res.status(429).json({ error: "Too many failed attempts. Please request a new OTP." });
    return;
  }

  // Demo OTP "123456" is accepted only when OTP_TEST_MODE is explicitly true.
  const isDemoOtp = OTP_TEST_MODE && otp === "123456";

  if (!isDemoOtp && stored.otp !== otp) {
    const left = 5 - stored.attempts;
    addLog(digits, "verify_fail", stored.channel, `Attempt ${stored.attempts}/5`);
    res.status(400).json({
      error: `Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} remaining.`,
    });
    return;
  }

  // OTP correct — clear it
  otpStore.delete(digits);
  addLog(digits, "verify_ok", stored.channel);
  logger.info({ digits: `***${digits.slice(-4)}` }, "verify-otp: OTP correct ✓");

  if (!supabase || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    res.status(503).json({ error: "Authentication service not configured. Contact support." });
    return;
  }

  try {
    const syntheticEmail = `${digits}@users.skillad.in`;

    const { data: profileRecord } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, is_provider, blocked")
      .eq("phone", fullPhone)
      .maybeSingle();

    // Blocked users cannot log in
    if ((profileRecord as any)?.blocked === true) {
      logger.warn({ digits: `***${digits.slice(-4)}` }, "verify-otp: login rejected — account blocked");
      res.status(403).json({ error: "Your account has been blocked. Please contact support." });
      return;
    }

    let userId: string;

    if (profileRecord?.id) {
      // Existing user — found via profiles table (most common path)
      userId = profileRecord.id;
      if (name) await supabase.from("profiles").update({ name }).eq("id", userId);
    } else {
      // New user (or edge case: auth user exists without a profiles row).
      // Try to create a new Supabase auth user first.
      const { user: newUser, error: createErr } = await supabaseAdminCreateUser({
        email:          syntheticEmail,
        email_confirm:  true,
        phone:          fullPhone,
        phone_confirm:  true,
        user_metadata:  { name: name || "User" },
      });

      if (newUser && (newUser as Record<string, unknown>).id) {
        // Brand new user created successfully
        userId = (newUser as Record<string, unknown>).id as string;
        logger.info({ digits: `***${digits.slice(-4)}`, userId }, "verify-otp: new Supabase user created ✓");
      } else {
        // Creation failed — auth user probably already exists with this email.
        // Search the users list page-by-page and match by exact email (client-side).
        // NOTE: The admin users list API does NOT support email filtering via query params —
        //       passing ?email=... returns ALL users, not filtered results. Must search manually.
        let existingId: string | null = null;
        try {
          let page = 1;
          searchLoop: while (page <= 10) {
            const listRes = await fetch(
              `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`,
              { headers: supabaseAdminHeaders() },
            );
            if (!listRes.ok) break;
            const listData = await listRes.json() as { users?: { id: string; email?: string }[] };
            const users = listData.users ?? [];
            if (users.length === 0) break;
            const match = users.find(u => u.email === syntheticEmail);
            if (match) { existingId = match.id; break searchLoop; }
            if (users.length < 100) break;
            page++;
          }
        } catch (searchErr) {
          logger.warn({ searchErr }, "verify-otp: user list search failed");
        }

        if (!existingId) {
          logger.error({ createErr }, "verify-otp: supabase admin createUser failed and could not find existing user");
          res.status(500).json({ error: "Account creation failed. Please try again." });
          return;
        }
        userId = existingId;
        logger.info({ digits: `***${digits.slice(-4)}`, userId }, "verify-otp: found existing auth user by email ✓");
      }

      await supabase.from("profiles").upsert({
        id:    userId,
        name:  name || "User",
        phone: fullPhone,
      }, { onConflict: "id" });
    }

    // Resolve provider role without demoting existing providers.
    // Login screen defaults to "customer"; writing is_provider=false on every customer
    // login wiped Dashboard access for registered/verified providers (Minakshi, Bpn, etc.).
    // Rule: promote when login chooses provider OR profile already provider OR providers row exists.
    let resolvedIsProvider = isProvider === true;
    try {
      const { data: existingRole } = await supabase
        .from("profiles")
        .select("is_provider")
        .eq("id", userId)
        .maybeSingle();
      if (existingRole?.is_provider === true) resolvedIsProvider = true;

      if (!resolvedIsProvider) {
        const { data: provByUser } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (provByUser) resolvedIsProvider = true;
      }
      if (!resolvedIsProvider && fullPhone) {
        const { data: provByPhone } = await supabase
          .from("providers")
          .select("id")
          .eq("phone", fullPhone)
          .maybeSingle();
        if (provByPhone) resolvedIsProvider = true;
      }

      await supabase
        .from("profiles")
        .update({
          is_provider: resolvedIsProvider,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } catch {
      // non-fatal — column may not exist yet; clients fall back to request param
    }

    const { data: finalProfile } = await supabase
      .from("profiles")
      .select("name, avatar_url, is_provider")
      .eq("id", userId)
      .single();

    const { hashed_token: tokenHash } = await supabaseAdminGenerateMagicLink(syntheticEmail);

    const resolvedName = finalProfile?.name || name || "User";
    const finalIsProvider =
      finalProfile?.is_provider === true || resolvedIsProvider;

    // ── Fix 1: Save user to local users.json so admin panel can list them
    //    even when Supabase Service Role Key is not configured on the server.
    try {
      const users = readJson<any[]>("users", []);
      const idx   = users.findIndex((u: any) => u.id === userId || normalizePhone(u.phone ?? "") === digits);
      const entry = {
        id:         userId,
        name:       resolvedName,
        phone:      fullPhone,
        isProvider: finalIsProvider,
        createdAt:  idx >= 0 ? (users[idx].createdAt ?? new Date().toISOString()) : new Date().toISOString(),
        source:     "otp",
      };
      if (idx >= 0) { users[idx] = { ...users[idx], ...entry }; } else { users.unshift(entry); }
      writeJson("users", users);
    } catch (writeErr) {
      logger.warn({ writeErr }, "verify-otp: could not persist user to users.json");
    }

    // ── Fix 2: Re-link provider record with userId when this account is a provider.
    //    Also returns the provider's JSON record ID so the app can query conversations directly.
    let providerJsonId: string | null = null;
    if (finalIsProvider) {
      try {
        const providers = readJson<any[]>("providers", []);
        const pIdx = providers.findIndex(
          (p: any) => normalizePhone(p.phone ?? "") === digits,
        );
        if (pIdx >= 0) {
          providerJsonId = providers[pIdx].id ?? null;
          if (providers[pIdx].userId !== userId) {
            providers[pIdx] = { ...providers[pIdx], userId };
            writeJson("providers", providers);
            logger.info({ digits: `***${digits.slice(-4)}`, userId }, "verify-otp: re-linked provider userId in JSON ✓");
          }
        }
      } catch (linkErr) {
        logger.warn({ linkErr }, "verify-otp: could not re-link provider userId in JSON");
      }

      // Also sync user_id to Supabase providers table (for providers registered via Supabase)
      if (supabase) {
        try {
          const { error: syncErr } = await supabase
            .from("providers")
            .update({ user_id: userId })
            .eq("phone", fullPhone);
          if (!syncErr) {
            logger.info({ digits: `***${digits.slice(-4)}`, userId }, "verify-otp: synced provider user_id to Supabase ✓");
          }
        } catch {
          // non-fatal
        }
      }
    }

    res.json({
      success:    true,
      userId,
      tokenHash:  tokenHash ?? null,
      name:       resolvedName,
      phone:      fullPhone,
      isProvider: finalIsProvider,
      avatarUrl:  finalProfile?.avatar_url ?? null,
      providerId: providerJsonId ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Verification failed. Please try again.";
    logger.error({ err: msg }, "verify-otp: unexpected error");
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/auth/resend-otp ─────────────────────────────────────────────────
router.post("/auth/resend-otp", async (req, res) => {
  const { phone } = req.body as { phone?: string };

  if (!phone) { res.status(400).json({ error: "phone is required" }); return; }

  const digits = normalizePhone(phone);
  if (digits.length !== 10) {
    res.status(400).json({ error: "Enter a valid 10-digit mobile number" });
    return;
  }

  if (!MSG91_CONFIGURED && !OTP_TEST_MODE) {
    res.status(503).json({ error: "OTP service is not configured. Please contact support." });
    return;
  }

  // Rate limit: 60 seconds between resends
  const existing = otpStore.get(digits);
  if (existing && Date.now() - existing.sentAt < 60 * 1000) {
    const waitSec = Math.ceil((60 * 1000 - (Date.now() - existing.sentAt)) / 1000);
    res.status(429).json({ error: `Please wait ${waitSec} seconds before requesting another OTP.` });
    return;
  }

  const otp = generateOtp();
  otpStore.set(digits, {
    otp,
    expiry:   Date.now() + 10 * 60 * 1000,
    sentAt:   Date.now(),
    attempts: 0,
    channel:  "sms",
  });

  const { ok, channel, error: deliveryErr } = await deliverOtp(digits, otp);

  if (ok) {
    const rec = otpStore.get(digits);
    if (rec) rec.channel = channel;
    addLog(digits, "resend", channel);
    if (!IS_PRODUCTION) logger.info({ otp, channel }, "DEV: resend OTP (server logs only)");
    if (OTP_TEST_MODE) {
      res.json({ success: true, channel, devOtp: otp });
    } else {
      res.json({ success: true, channel });
    }
  } else if (OTP_TEST_MODE) {
    addLog(digits, "resend", "dev", deliveryErr);
    res.json({ success: true, channel: "dev", devOtp: otp });
  } else {
    otpStore.delete(digits);
    addLog(digits, "blocked", channel, deliveryErr);
    res.status(503).json({ error: "Unable to resend OTP. Please try again." });
  }
});

// ── GET /api/auth/profile/:userId ─────────────────────────────────────────────
// Returns fresh name, avatarUrl, and isProvider from Supabase for a given user UUID.
// Used by the mobile app on startup/focus to validate and overwrite stale AsyncStorage values.
router.get("/auth/profile/:userId", async (req, res) => {
  const userId = req.params["userId"] ?? "";
  if (!userId || !supabase) { res.json({ found: false }); return; }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(userId)) { res.json({ found: false }); return; }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, is_provider")
      .eq("id", userId)
      .single();
    if (!profile) { res.json({ found: false }); return; }

    // Heal stale is_provider=false when a providers row already exists (e.g. after
    // an older customer-login overwrite). Keeps Profile "My Dashboard" consistent.
    let isProvider = (profile as any).is_provider === true;
    if (!isProvider) {
      const { data: prow } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (prow) {
        isProvider = true;
        await supabase.from("profiles").update({ is_provider: true }).eq("id", userId);
      }
    }

    res.json({
      found: true,
      userId: profile.id,
      name: profile.name ?? null,
      avatarUrl: (profile as any).avatar_url ?? null,
      isProvider,
    });
  } catch {
    res.json({ found: false });
  }
});

// ── GET /api/auth/resolve/:phone ──────────────────────────────────────────────
// Given a phone number, return the Supabase user UUID from the profiles table.
// Used by the mobile app to upgrade old phone-based stored IDs to real UUIDs.
router.get("/auth/resolve/:phone", async (req, res) => {
  const raw = decodeURIComponent(req.params["phone"] ?? "");
  if (!raw) { res.json({ userId: null }); return; }
  if (!supabase) { res.json({ userId: null }); return; }

  const digits = raw.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const phonesToTry = [`+91${last10}`, `91${last10}`, last10].filter(Boolean);

  for (const phone of phonesToTry) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (data?.id) { res.json({ userId: data.id }); return; }
  }

  res.json({ userId: null });
});

// ── GET /api/admin/otp-logs ────────────────────────────────────────────────────
router.get("/admin/otp-logs", (_req, res) => {
  res.json({ logs: otpLog, total: otpLog.length });
});

export default router;
