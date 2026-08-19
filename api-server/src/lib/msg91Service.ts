/**
 * MSG91 transactional SMS via Flow API (/api/v5/flow).
 * OTP delivery remains in routes/auth.ts — do not use this module for OTP.
 */
import { logger } from "./logger.js";
import { resolveProviderPhone, toMsg91Mobile } from "./providerPhone.js";

const MSG91_API_KEY = process.env["MSG91_API_KEY"] ?? "";
const FLOW_URL = "https://control.msg91.com/api/v5/flow/";

const TEMPLATE_SUBSCRIPTION_ACTIVATED =
  process.env["MSG91_TEMPLATE_SUBSCRIPTION_ACTIVATED"] ?? "";
const TEMPLATE_SUBSCRIPTION_REMINDER =
  process.env["MSG91_TEMPLATE_SUBSCRIPTION_REMINDER"] ?? "";
const TEMPLATE_PAYMENT_SUCCESS = process.env["MSG91_TEMPLATE_PAYMENT_SUCCESS"] ?? "";

export interface FlowSmsResult {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

function warnMissingTemplate(name: string, envKey: string): FlowSmsResult {
  logger.warn(
    { kind: "msg91_flow", template: name, envKey },
    `MSG91 transactional SMS skipped — ${envKey} is not configured`,
  );
  return { ok: false, skipped: true, reason: `${envKey} not configured` };
}

function warnMissingApiKey(): FlowSmsResult {
  logger.warn(
    { kind: "msg91_flow" },
    "MSG91 transactional SMS skipped — MSG91_API_KEY is not configured",
  );
  return { ok: false, skipped: true, reason: "MSG91_API_KEY not configured" };
}

/** Send one Flow SMS. Never throws. */
export async function sendFlowSms(
  flowId: string,
  mobile91: string,
  variables: Record<string, string>,
): Promise<FlowSmsResult> {
  if (!MSG91_API_KEY) return warnMissingApiKey();
  if (!flowId) {
    return { ok: false, skipped: true, reason: "flow_id missing" };
  }

  try {
    const res = await fetch(FLOW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: MSG91_API_KEY,
      },
      body: JSON.stringify({
        flow_id: flowId,
        recipients: [
          {
            mobiles: mobile91,
            ...variables,
          },
        ],
      }),
    });

    const data = (await res.json()) as { type?: string; message?: string };
    if (data.type === "success") {
      logger.info(
        { kind: "msg91_flow", flowId, mobile: `***${mobile91.slice(-4)}` },
        "MSG91 Flow SMS sent",
      );
      return { ok: true };
    }

    const errMsg = data.message ?? `MSG91 Flow error (http=${res.status})`;
    logger.warn({ kind: "msg91_flow", flowId, error: errMsg }, "MSG91 Flow SMS failed");
    return { ok: false, error: errMsg };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Network error";
    logger.warn({ kind: "msg91_flow", flowId, error: errMsg }, "MSG91 Flow SMS request failed");
    return { ok: false, error: errMsg };
  }
}

/** Subscription_Activated — variable: alp (plan name). */
export async function sendSubscriptionActivatedSms(
  userId: string,
  providerId: string,
  planName: string,
): Promise<FlowSmsResult> {
  if (!TEMPLATE_SUBSCRIPTION_ACTIVATED) {
    return warnMissingTemplate("Subscription_Activated", "MSG91_TEMPLATE_SUBSCRIPTION_ACTIVATED");
  }
  const digits = await resolveProviderPhone(userId, providerId);
  if (!digits) {
    logger.warn(
      { kind: "msg91_flow", template: "Subscription_Activated", userId, providerId },
      "MSG91 SMS skipped — provider phone not found",
    );
    return { ok: false, skipped: true, reason: "phone not found" };
  }
  return sendFlowSms(TEMPLATE_SUBSCRIPTION_ACTIVATED, toMsg91Mobile(digits), {
    alp: planName,
  });
}

/** Subscription_Reminder — variables: alp (plan), num (days remaining). */
export async function sendSubscriptionReminderSms(
  userId: string,
  providerId: string,
  planName: string,
  daysRemaining: number,
): Promise<FlowSmsResult> {
  if (!TEMPLATE_SUBSCRIPTION_REMINDER) {
    return warnMissingTemplate("Subscription_Reminder", "MSG91_TEMPLATE_SUBSCRIPTION_REMINDER");
  }
  const digits = await resolveProviderPhone(userId, providerId);
  if (!digits) {
    logger.warn(
      { kind: "msg91_flow", template: "Subscription_Reminder", userId, providerId },
      "MSG91 SMS skipped — provider phone not found",
    );
    return { ok: false, skipped: true, reason: "phone not found" };
  }
  return sendFlowSms(TEMPLATE_SUBSCRIPTION_REMINDER, toMsg91Mobile(digits), {
    alp: planName,
    num: String(daysRemaining),
  });
}

/** Payment_Success_v1 — variables: num (amount), alp (plan name). */
export async function sendPaymentSuccessSms(
  userId: string,
  providerId: string,
  planName: string,
  amountInr: number,
): Promise<FlowSmsResult> {
  if (!TEMPLATE_PAYMENT_SUCCESS) {
    return warnMissingTemplate("Payment_Success_v1", "MSG91_TEMPLATE_PAYMENT_SUCCESS");
  }
  const digits = await resolveProviderPhone(userId, providerId);
  if (!digits) {
    logger.warn(
      { kind: "msg91_flow", template: "Payment_Success_v1", userId, providerId },
      "MSG91 SMS skipped — provider phone not found",
    );
    return { ok: false, skipped: true, reason: "phone not found" };
  }
  const num = Number.isFinite(amountInr) ? amountInr.toFixed(2) : String(amountInr);
  return sendFlowSms(TEMPLATE_PAYMENT_SUCCESS, toMsg91Mobile(digits), {
    num,
    alp: planName,
  });
}

/** Startup diagnostic for transactional templates (no secrets logged). */
export function logTransactionalSmsConfig(): void {
  logger.info(
    {
      kind: "msg91_transactional_config",
      apiKeyConfigured: !!MSG91_API_KEY,
      subscriptionActivatedTemplate: TEMPLATE_SUBSCRIPTION_ACTIVATED ? "configured" : "NOT SET",
      subscriptionReminderTemplate: TEMPLATE_SUBSCRIPTION_REMINDER ? "configured" : "NOT SET",
      paymentSuccessTemplate: TEMPLATE_PAYMENT_SUCCESS ? "configured" : "NOT SET",
    },
    "MSG91 transactional SMS configuration",
  );
  if (!MSG91_API_KEY) {
    logger.warn("MSG91 transactional SMS disabled — MSG91_API_KEY not set");
  }
  if (!TEMPLATE_SUBSCRIPTION_ACTIVATED) {
    logger.warn("MSG91 Subscription_Activated SMS disabled — MSG91_TEMPLATE_SUBSCRIPTION_ACTIVATED not set");
  }
  if (!TEMPLATE_SUBSCRIPTION_REMINDER) {
    logger.warn("MSG91 Subscription_Reminder SMS disabled — MSG91_TEMPLATE_SUBSCRIPTION_REMINDER not set");
  }
  if (!TEMPLATE_PAYMENT_SUCCESS) {
    logger.warn("MSG91 Payment_Success_v1 SMS disabled — MSG91_TEMPLATE_PAYMENT_SUCCESS not set");
  }
}

logTransactionalSmsConfig();
