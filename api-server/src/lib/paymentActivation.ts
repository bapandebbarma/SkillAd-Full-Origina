/**
 * Activate / renew a subscription after a verified Razorpay payment.
 * Uses the same JSON stores as the existing subscriptions module (no SQL schema changes).
 * Writes are applied as one logical transaction (rollback snapshots on failure).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "./supabase.js";
import { logger } from "./logger.js";
import { getRazorpayClient } from "./razorpay.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

/** Same plan durations as src/routes/subscriptions.ts */
export const PLAN_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  halfYearly: 180,
  yearly: 365,
  trial: 14,
};

const PLAN_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  halfYearly: "Half Yearly",
  yearly: "Yearly",
  trial: "Trial",
};

export interface SubscriptionRecord {
  id: string;
  userId: string;
  providerId: string;
  plan: string;
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "cancelled";
  notified7: boolean;
  notified3: boolean;
  notified1: boolean;
  notifiedExpired: boolean;
  /** Paid activation metadata (additive) */
  planId?: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  paymentStatus?: string;
  activatedAt?: string;
  expiryDate?: string;
}

export interface PaymentHistoryRecord {
  id: string;
  userId: string;
  providerId: string;
  planId: string;
  planName: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  amount: number;
  amountPaise: number;
  gstAmount: number;
  currency: string;
  paymentMethod: string | null;
  status: "SUCCESS";
  activatedAt: string;
  expiryDate: string;
  createdAt: string;
}

export interface ActivationResult {
  activated: true;
  expiryDate: string;
  planName: string;
  planId: string;
  providerId: string;
  alreadyProcessed?: boolean;
}

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

function resolveProviderId(userId: string): string {
  const providers = readJson<any[]>("providers", []);
  const match = providers.find((p: any) => p.userId === userId || p.id === userId);
  if (match?.id) return String(match.id);
  return `sb-${userId}`;
}

export function getPlanName(planId: string): string {
  try {
    const plans = readJson<{ key: string; label: string }[]>("plans", []);
    const found = plans.find((p) => p.key === planId);
    if (found?.label) return found.label;
  } catch {
    /* fall through */
  }
  return PLAN_LABELS[planId] ?? planId;
}

function calcExpiryDate(existingEnd: string | undefined, planDays: number, now: Date): Date {
  const base =
    existingEnd && new Date(existingEnd) > now ? new Date(existingEnd) : now;
  return new Date(base.getTime() + planDays * 86400000);
}

/** Split GST-inclusive paise total (18%) into base + GST (rupees, 2 dp). */
function splitGstInclusive(amountPaise: number): { amount: number; gstAmount: number } {
  const total = amountPaise / 100;
  const base = Math.round((total / 1.18) * 100) / 100;
  const gst = Math.round((total - base) * 100) / 100;
  return { amount: total, gstAmount: gst };
}

async function fetchPaymentMeta(
  paymentId: string,
  orderId: string,
): Promise<{ amountPaise: number; currency: string; method: string | null }> {
  try {
    const rz = getRazorpayClient();
    const payment = (await rz.payments.fetch(paymentId)) as {
      amount?: number;
      currency?: string;
      method?: string;
    };
    if (typeof payment.amount === "number" && payment.amount > 0) {
      return {
        amountPaise: payment.amount,
        currency: (payment.currency ?? "INR").toUpperCase(),
        method: payment.method ?? null,
      };
    }
  } catch (e) {
    logger.warn(
      { kind: "payment_fetch", paymentId, message: e instanceof Error ? e.message : String(e) },
      "Could not fetch Razorpay payment; trying order",
    );
  }

  try {
    const rz = getRazorpayClient();
    const order = (await rz.orders.fetch(orderId)) as { amount?: number; currency?: string };
    if (typeof order.amount === "number" && order.amount > 0) {
      return {
        amountPaise: order.amount,
        currency: (order.currency ?? "INR").toUpperCase(),
        method: null,
      };
    }
  } catch (e) {
    logger.warn(
      { kind: "order_fetch", orderId, message: e instanceof Error ? e.message : String(e) },
      "Could not fetch Razorpay order amount",
    );
  }

  return { amountPaise: 0, currency: "INR", method: null };
}

async function syncProviderSubscription(
  providerId: string,
  userId: string,
  endDateIso: string,
): Promise<void> {
  const providers = readJson<any[]>("providers", []);
  const idx = providers.findIndex(
    (p: any) => p.id === providerId || p.userId === userId || p.id === userId,
  );
  if (idx >= 0) {
    providers[idx].subscriptionActive = true;
    providers[idx].subscriptionEndDate = endDateIso;
    providers[idx].subscriptionExpiry = endDateIso;
  } else {
    providers.push({
      id: providerId,
      userId,
      subscriptionActive: true,
      subscriptionEndDate: endDateIso,
      subscriptionExpiry: endDateIso,
    });
  }
  writeJsonAtomic("providers", providers);

  if (supabase) {
    try {
      await supabase
        .from("providers")
        .update({ subscription_end_date: endDateIso })
        .or(`id.eq.${providerId},user_id.eq.${userId}`);
    } catch (e) {
      logger.warn(
        {
          kind: "supabase_subscription_sync",
          providerId,
          message: e instanceof Error ? e.message : String(e),
        },
        "Supabase subscription_end_date update failed (non-fatal)",
      );
    }
  }
}

/**
 * After a valid Razorpay signature: activate/renew subscription + append payment history.
 * Idempotent on razorpayPaymentId.
 */
export async function activateSubscriptionAfterPayment(input: {
  userId: string;
  planId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
}): Promise<ActivationResult> {
  const { userId, planId, razorpayPaymentId, razorpayOrderId } = input;
  const planDays = PLAN_DAYS[planId];
  if (!planDays) {
    throw new Error(`Unknown planId: ${planId}`);
  }

  const planName = getPlanName(planId);
  const history = readJson<PaymentHistoryRecord[]>("payment_history", []);
  const existingPay = history.find((h) => h.razorpayPaymentId === razorpayPaymentId);
  if (existingPay) {
    return {
      activated: true,
      expiryDate: existingPay.expiryDate,
      planName: existingPay.planName,
      planId: existingPay.planId,
      providerId: existingPay.providerId,
      alreadyProcessed: true,
    };
  }

  const meta = await fetchPaymentMeta(razorpayPaymentId, razorpayOrderId);
  const { amount, gstAmount } = splitGstInclusive(meta.amountPaise);
  const providerId = resolveProviderId(userId);
  const now = new Date();
  const activatedAt = now.toISOString();

  // Snapshots for rollback
  const subsBefore = readJson<SubscriptionRecord[]>("subscriptions", []);
  const providersBefore = readJson<any[]>("providers", []);
  const historyBefore = [...history];

  try {
    const subs = [...subsBefore];
    const existingIdx = subs.findIndex(
      (s) => s.providerId === providerId || s.userId === userId,
    );
    const existing = existingIdx >= 0 ? subs[existingIdx] : undefined;
    const expiry = calcExpiryDate(existing?.endDate, planDays, now);
    const expiryDate = expiry.toISOString();

    const sub: SubscriptionRecord = {
      id: existing?.id ?? `sub_${Date.now()}`,
      userId,
      providerId,
      plan: planId,
      planId,
      startDate: existing?.startDate && new Date(existing.endDate) > now
        ? existing.startDate
        : activatedAt,
      endDate: expiryDate,
      status: "active",
      notified7: false,
      notified3: false,
      notified1: false,
      notifiedExpired: false,
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      amount,
      paymentStatus: "SUCCESS",
      activatedAt,
      expiryDate,
    };

    if (existingIdx >= 0) {
      subs[existingIdx] = sub;
    } else {
      subs.push(sub);
    }

    const paymentRecord: PaymentHistoryRecord = {
      id: `pay_${Date.now()}`,
      userId,
      providerId,
      planId,
      planName,
      razorpayPaymentId,
      razorpayOrderId,
      amount,
      amountPaise: meta.amountPaise,
      gstAmount,
      currency: meta.currency,
      paymentMethod: meta.method,
      status: "SUCCESS",
      activatedAt,
      expiryDate,
      createdAt: activatedAt,
    };
    const nextHistory = [paymentRecord, ...historyBefore];

    // Atomic multi-file write (logical transaction)
    writeJsonAtomic("subscriptions", subs);
    writeJsonAtomic("payment_history", nextHistory);
    await syncProviderSubscription(providerId, userId, expiryDate);

    logger.info(
      {
        kind: "payment_activation",
        userId,
        providerId,
        planId,
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        expiryDate,
      },
      "Subscription activated after payment",
    );

    return {
      activated: true,
      expiryDate,
      planName,
      planId,
      providerId,
    };
  } catch (err) {
    // Rollback JSON stores
    try {
      writeJsonAtomic("subscriptions", subsBefore);
      writeJsonAtomic("providers", providersBefore);
      writeJsonAtomic("payment_history", historyBefore);
    } catch (rollbackErr) {
      logger.error(
        {
          kind: "payment_activation_rollback",
          message: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        },
        "Failed to rollback after activation error",
      );
    }
    throw err;
  }
}
