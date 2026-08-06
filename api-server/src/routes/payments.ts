/**
 * Razorpay payment APIs.
 * create-order + verify (signature → activate subscription + payment history).
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import {
  getRazorpayClient,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyPaymentSignature,
} from "../lib/razorpay.js";
import {
  activateSubscriptionAfterPayment,
  getPlanName,
  PLAN_DAYS,
} from "../lib/paymentActivation.js";

const router: IRouter = Router();

const createOrderSchema = z.object({
  /** Amount in smallest currency unit (paise for INR). */
  amount: z.number().int().positive(),
  currency: z.string().trim().min(1).default("INR"),
  planId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
});

const verifySchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  planId: z.string().trim().min(1),
});

// ── POST /api/payments/create-order ───────────────────────────────────────────
router.post("/payments/create-order", async (req: Request, res: Response) => {
  try {
    if (!isRazorpayConfigured()) {
      logger.error({ kind: "payments_create_order" }, "Razorpay env keys missing");
      res.status(503).json({ success: false, error: "Payment service unavailable" });
      return;
    }

    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { amount, currency, planId, userId } = parsed.data;
    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount,
      currency: currency.toUpperCase(),
      receipt: `sa_${userId.slice(0, 8)}_${Date.now()}`.slice(0, 40),
      notes: {
        planId,
        userId,
      },
    });

    logger.info(
      {
        kind: "payments_create_order",
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        planId,
        userId,
      },
      "Razorpay order created",
    );

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      razorpayKeyId: getRazorpayKeyId(),
    });
  } catch (err) {
    logger.error(
      {
        kind: "payments_create_order",
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      "Failed to create Razorpay order",
    );
    res.status(500).json({ success: false, error: "Failed to create payment order" });
  }
});

// ── POST /api/payments/verify ─────────────────────────────────────────────────
// Valid signature → activate/renew subscription + write payment history.
// Invalid signature → no writes, success: false.
router.post("/payments/verify", async (req: Request, res: Response) => {
  try {
    if (!isRazorpayConfigured()) {
      logger.error({ kind: "payments_verify" }, "Razorpay env keys missing");
      res.status(503).json({ success: false });
      return;
    }

    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false });
      return;
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      planId,
    } = parsed.data;

    if (!PLAN_DAYS[planId]) {
      logger.warn({ kind: "payments_verify", planId }, "Unknown planId");
      res.json({ success: false });
      return;
    }

    const valid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!valid) {
      logger.warn(
        {
          kind: "payments_verify",
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          userId,
          planId,
        },
        "Razorpay signature verification failed",
      );
      res.json({ success: false });
      return;
    }

    const result = await activateSubscriptionAfterPayment({
      userId,
      planId,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
    });

    logger.info(
      {
        kind: "payments_verify",
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        userId,
        planId,
        expiryDate: result.expiryDate,
        alreadyProcessed: result.alreadyProcessed ?? false,
      },
      "Razorpay payment verified and subscription activated",
    );

    res.json({
      success: true,
      activated: true,
      expiryDate: result.expiryDate,
      planName: result.planName || getPlanName(planId),
    });
  } catch (err) {
    logger.error(
      {
        kind: "payments_verify",
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      "Payment verification / activation error",
    );
    res.status(500).json({ success: false });
  }
});

export default router;
