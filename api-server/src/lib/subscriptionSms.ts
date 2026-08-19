/**
 * Orchestrates transactional subscription/payment SMS with duplicate prevention.
 * All entry points are non-throwing — SMS failure never blocks business logic.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import {
  sendPaymentSuccessSms,
  sendSubscriptionActivatedSms,
  sendSubscriptionReminderSms,
} from "./msg91Service.js";

const PLAN_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  halfYearly: "Half Yearly",
  yearly: "Yearly",
  trial: "Trial",
};

function getPlanName(planId: string): string {
  try {
    const plans = readJson<{ key: string; label: string }[]>("plans", []);
    const found = plans.find((p) => p.key === planId);
    if (found?.label) return found.label;
  } catch {
    /* fall through */
  }
  return PLAN_LABELS[planId] ?? planId;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

function dataFile(name: string): string {
  return resolve(DATA_DIR, `${name}.json`);
}

function readJson<T>(name: string, fallback: T): T {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const f = dataFile(name);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8")) as T;
  } catch {
    /* fall through */
  }
  return fallback;
}

function writeJsonAtomic(name: string, data: unknown): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const f = dataFile(name);
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmp, f);
}

interface SubscriptionSmsFields {
  smsActivatedForEndDate?: string;
  smsNotified7?: boolean;
  smsNotified3?: boolean;
  smsNotified1?: boolean;
}

interface PaymentSmsFields {
  smsPaymentSuccessSent?: boolean;
  smsSubscriptionActivatedSent?: boolean;
}

function markSubscriptionActivatedSent(providerId: string, userId: string, endDate: string): void {
  const subs = readJson<(SubscriptionSmsFields & { providerId?: string; userId?: string })[]>(
    "subscriptions",
    [],
  );
  const idx = subs.findIndex((s) => s.providerId === providerId || s.userId === userId);
  if (idx >= 0) {
    subs[idx]!.smsActivatedForEndDate = endDate;
    writeJsonAtomic("subscriptions", subs);
  }
}

function markPaymentSmsFlags(
  razorpayPaymentId: string,
  flags: Partial<PaymentSmsFields>,
): void {
  const history = readJson<(PaymentSmsFields & { razorpayPaymentId?: string })[]>(
    "payment_history",
    [],
  );
  const idx = history.findIndex((h) => h.razorpayPaymentId === razorpayPaymentId);
  if (idx >= 0) {
    Object.assign(history[idx]!, flags);
    writeJsonAtomic("payment_history", history);
  }
}

function shouldSendSubscriptionActivated(
  providerId: string,
  userId: string,
  endDate: string,
): boolean {
  const subs = readJson<(SubscriptionSmsFields & { providerId?: string; userId?: string })[]>(
    "subscriptions",
    [],
  );
  const sub = subs.find((s) => s.providerId === providerId || s.userId === userId);
  return sub?.smsActivatedForEndDate !== endDate;
}

/**
 * After Razorpay payment activation writes succeed (first processing only).
 * Sends Payment_Success_v1 + Subscription_Activated; updates dedupe flags on success.
 */
export async function sendPostPaymentTransactionalSms(input: {
  userId: string;
  providerId: string;
  planId: string;
  planName: string;
  amount: number;
  expiryDate: string;
  razorpayPaymentId: string;
}): Promise<void> {
  const { userId, providerId, planId, planName, amount, expiryDate, razorpayPaymentId } =
    input;

  try {
    const payResult = await sendPaymentSuccessSms(userId, providerId, planName, amount);
    if (payResult.ok) {
      markPaymentSmsFlags(razorpayPaymentId, { smsPaymentSuccessSent: true });
    }

    if (shouldSendSubscriptionActivated(providerId, userId, expiryDate)) {
      const actResult = await sendSubscriptionActivatedSms(userId, providerId, planName);
      if (actResult.ok) {
        markSubscriptionActivatedSent(providerId, userId, expiryDate);
        markPaymentSmsFlags(razorpayPaymentId, { smsSubscriptionActivatedSent: true });
      }
    }
  } catch (e) {
    logger.warn(
      {
        kind: "post_payment_sms",
        userId,
        providerId,
        planId,
        paymentId: razorpayPaymentId,
        message: e instanceof Error ? e.message : String(e),
      },
      "Post-payment transactional SMS failed (non-fatal)",
    );
  }
}

/**
 * Subscription activated outside Razorpay (admin, trial, manual POST).
 * One SMS per unique endDate per subscription.
 */
export async function notifySubscriptionActivatedIfNeeded(input: {
  userId: string;
  providerId: string;
  planId: string;
  endDate: string;
}): Promise<void> {
  const { userId, providerId, planId, endDate } = input;

  if (!shouldSendSubscriptionActivated(providerId, userId, endDate)) {
    return;
  }

  try {
    const planName = getPlanName(planId);
    const result = await sendSubscriptionActivatedSms(userId, providerId, planName);
    if (result.ok) {
      markSubscriptionActivatedSent(providerId, userId, endDate);
    }
  } catch (e) {
    logger.warn(
      {
        kind: "subscription_activated_sms",
        userId,
        providerId,
        planId,
        message: e instanceof Error ? e.message : String(e),
      },
      "Subscription activated SMS failed (non-fatal)",
    );
  }
}

type ReminderThreshold = 7 | 3 | 1;

function smsFlagKey(threshold: ReminderThreshold): "smsNotified7" | "smsNotified3" | "smsNotified1" {
  if (threshold === 7) return "smsNotified7";
  if (threshold === 3) return "smsNotified3";
  return "smsNotified1";
}

/**
 * Fire-and-forget reminder SMS. Updates smsNotified* only after successful send.
 */
export function queueSubscriptionReminderSms(input: {
  subscriptionId: string;
  userId: string;
  providerId: string;
  planId: string;
  daysRemaining: number;
  threshold: ReminderThreshold;
}): void {
  const { subscriptionId, userId, providerId, planId, daysRemaining, threshold } = input;
  const flagKey = smsFlagKey(threshold);

  void (async () => {
    try {
      const subs = readJson<
        (SubscriptionSmsFields & { id?: string; plan?: string })[]
      >("subscriptions", []);
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx < 0 || subs[idx]![flagKey]) return;

      const planName = getPlanName(planId || subs[idx]!.plan || "subscription");
      const result = await sendSubscriptionReminderSms(
        userId,
        providerId,
        planName,
        daysRemaining,
      );
      if (result.ok) {
        subs[idx]![flagKey] = true;
        writeJsonAtomic("subscriptions", subs);
      }
    } catch (e) {
      logger.warn(
        {
          kind: "subscription_reminder_sms",
          subscriptionId,
          threshold,
          message: e instanceof Error ? e.message : String(e),
        },
        "Subscription reminder SMS failed (non-fatal)",
      );
    }
  })();
}
