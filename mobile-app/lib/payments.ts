/**
 * Razorpay payment API helpers (mobile).
 * Uses API_BASE — never hardcodes host URLs.
 * Phase 1 client: create order + verify signature only (no subscription activation).
 */
import { API_BASE } from "@/lib/db";

export interface CreateOrderResult {
  success: true;
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
}

export interface CreateOrderError {
  success: false;
  error?: string;
}

export async function createPaymentOrder(input: {
  amount: number;
  currency: string;
  planId: string;
  userId: string;
}): Promise<CreateOrderResult> {
  const res = await fetch(`${API_BASE}/payments/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as CreateOrderResult | CreateOrderError & { error?: string };
  if (!res.ok || !data || (data as CreateOrderError).success === false) {
    const err = (data as CreateOrderError)?.error ?? `HTTP ${res.status}`;
    throw new Error(err);
  }
  const ok = data as CreateOrderResult;
  if (!ok.orderId || !ok.razorpayKeyId) {
    throw new Error("Invalid order response from server");
  }
  return ok;
}

export async function verifyPayment(input: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  userId: string;
  planId: string;
}): Promise<boolean> {
  const res = await fetch(`${API_BASE}/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { success?: boolean };
  return res.ok && data?.success === true;
}
