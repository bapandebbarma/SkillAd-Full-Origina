import { logger } from "./logger.js";

// ── WhatsApp Cloud API configuration ─────────────────────────────────────────
const PHONE_NUMBER_ID   = process.env["WHATSAPP_PHONE_NUMBER_ID"]   ?? "";
const ACCESS_TOKEN      = process.env["WHATSAPP_ACCESS_TOKEN"]       ?? "";
const OTP_TEMPLATE      = process.env["WHATSAPP_OTP_TEMPLATE"]       ?? "otp";
const NOTIFY_TEMPLATE   = process.env["WHATSAPP_NOTIFY_TEMPLATE"]    ?? "skilladd_notification";
const WA_API_VERSION    = "v19.0";
const WA_BASE           = `https://graph.facebook.com/${WA_API_VERSION}`;

export const WA_CONFIGURED = !!PHONE_NUMBER_ID && !!ACCESS_TOKEN;

logger.info(
  {
    waConfigured:   WA_CONFIGURED,
    phoneNumberId:  PHONE_NUMBER_ID || "(NOT SET)",
    accessToken:    ACCESS_TOKEN ? `***${ACCESS_TOKEN.slice(-6)}` : "(NOT SET)",
    otpTemplate:    OTP_TEMPLATE,
  },
  "📱 WhatsApp service initialized",
);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface WaResult {
  ok:       boolean;
  messageId?: string;
  error?:   string;
}

// ── Core send helper (with 2 retries) ────────────────────────────────────────
async function waPost(payload: object, attempt = 1): Promise<WaResult> {
  try {
    const res = await fetch(`${WA_BASE}/${PHONE_NUMBER_ID}/messages`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const raw  = await res.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { /* raw text fallback */ }

    logger.info(
      { httpStatus: res.status, msgId: data?.messages?.[0]?.id, error: data?.error?.message },
      `WhatsApp API response (attempt ${attempt})`,
    );

    if (res.ok && data?.messages?.[0]?.id) {
      return { ok: true, messageId: data.messages[0].id };
    }

    const errMsg = data?.error?.message ?? `HTTP ${res.status}: ${raw.slice(0, 200)}`;

    // Retry on transient errors (5xx, rate limit 429)
    if (attempt < 3 && (res.status >= 500 || res.status === 429)) {
      const delay = attempt * 1500;
      await new Promise((r) => setTimeout(r, delay));
      return waPost(payload, attempt + 1);
    }

    return { ok: false, error: errMsg };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    logger.error({ err: msg, attempt }, "WhatsApp API exception");
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 1500));
      return waPost(payload, attempt + 1);
    }
    return { ok: false, error: msg };
  }
}

// ── Send OTP via WhatsApp template ───────────────────────────────────────────
// Uses the approved OTP template (default: "otp").
// The template must be approved in WhatsApp Business Manager.
// Standard Meta OTP template has one body variable (the OTP code) and
// an optional copy-code button.
export async function sendWhatsAppOtp(phone: string, otp: string): Promise<WaResult> {
  if (!WA_CONFIGURED) {
    return { ok: false, error: "WhatsApp not configured (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN missing)" };
  }

  const to = phone.replace(/\D/g, "").replace(/^91/, "");
  const internationalPhone = `91${to}`;

  logger.info({ to: `+91...${to.slice(-4)}`, template: OTP_TEMPLATE }, "WhatsApp sendOtp →");

  const payload = {
    messaging_product: "whatsapp",
    to:                internationalPhone,
    type:              "template",
    template: {
      name:     OTP_TEMPLATE,
      language: { code: "en" },
      components: [
        {
          type:       "body",
          parameters: [{ type: "text", text: otp }],
        },
        {
          type:      "button",
          sub_type:  "url",
          index:     "0",
          parameters: [{ type: "text", text: otp }],
        },
      ],
    },
  };

  return waPost(payload);
}

// ── Send a text notification (works only within 24h customer-service window) ─
export async function sendWhatsAppText(phone: string, message: string): Promise<WaResult> {
  if (!WA_CONFIGURED) {
    return { ok: false, error: "WhatsApp not configured" };
  }

  const to = phone.replace(/\D/g, "").replace(/^91/, "");

  logger.info({ to: `+91...${to.slice(-4)}` }, "WhatsApp sendText →");

  return waPost({
    messaging_product: "whatsapp",
    to:    `91${to}`,
    type:  "text",
    text:  { body: message },
  });
}

// ── Send a notification via template ─────────────────────────────────────────
// Requires an approved template. Falls back to text if template send fails.
export async function sendWhatsAppNotification(
  phone:    string,
  params:   string[],
  template: string = NOTIFY_TEMPLATE,
): Promise<WaResult> {
  if (!WA_CONFIGURED) {
    return { ok: false, error: "WhatsApp not configured" };
  }

  const to = phone.replace(/\D/g, "").replace(/^91/, "");

  logger.info({ to: `+91...${to.slice(-4)}`, template }, "WhatsApp sendNotification →");

  return waPost({
    messaging_product: "whatsapp",
    to:   `91${to}`,
    type: "template",
    template: {
      name:     template,
      language: { code: "en" },
      components: [
        {
          type:       "body",
          parameters: params.map((p) => ({ type: "text", text: p })),
        },
      ],
    },
  });
}

// ── Send booking notification ─────────────────────────────────────────────────
// Sends a booking alert to a provider's WhatsApp number.
// Uses free-text (within 24h window) or template.
export async function notifyBooking(
  providerPhone:  string,
  customerName:   string,
  service:        string,
  date:           string,
): Promise<void> {
  if (!WA_CONFIGURED) return;

  const msg = `📅 *New Booking Request*\n\nCustomer: ${customerName}\nService: ${service}\nDate: ${date}\n\nOpen SkillAd to accept or decline.`;
  const result = await sendWhatsAppText(providerPhone, msg);
  if (!result.ok) {
    logger.warn({ error: result.error, providerPhone: `...${providerPhone.slice(-4)}` }, "WhatsApp booking notify failed");
  }
}

// ── Send registration confirmation ────────────────────────────────────────────
export async function notifyProviderRegistered(
  providerPhone: string,
  providerName:  string,
): Promise<void> {
  if (!WA_CONFIGURED) return;

  const msg = `✅ *Welcome to SkillAd, ${providerName}!*\n\nYour provider profile has been submitted.\nOur team will review and verify it shortly.\n\nYou can manage your profile anytime in the SkillAd app.`;
  await sendWhatsAppText(providerPhone, msg);
}
