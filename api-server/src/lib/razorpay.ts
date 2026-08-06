/**
 * Razorpay client factory — Key Secret never leaves the server.
 */
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "./logger.js";

export function getRazorpayKeyId(): string {
  return (process.env["RAZORPAY_KEY_ID"] ?? "").trim();
}

function getRazorpayKeySecret(): string {
  return (process.env["RAZORPAY_KEY_SECRET"] ?? "").trim();
}

export function isRazorpayConfigured(): boolean {
  return Boolean(getRazorpayKeyId() && getRazorpayKeySecret());
}

let client: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured");
  }
  if (!client) {
    client = new Razorpay({
      key_id: getRazorpayKeyId(),
      key_secret: getRazorpayKeySecret(),
    });
    logger.info({ kind: "razorpay_client_init" }, "Razorpay client initialized");
  }
  return client;
}

/**
 * Verify Razorpay payment signature (HMAC SHA256).
 * Does not call Razorpay APIs or mutate any database state.
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const secret = getRazorpayKeySecret();
  if (!secret || !orderId || !paymentId || !signature) return false;

  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
