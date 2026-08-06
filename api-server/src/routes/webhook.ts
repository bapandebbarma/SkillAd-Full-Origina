import { Router } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const VERIFY_TOKEN = process.env["WHATSAPP_VERIFY_TOKEN"] ?? "skilladd_whatsapp_hook_v1";

// ── GET /api/webhook/whatsapp — Meta verification challenge ───────────────────
router.get("/webhook/whatsapp", (req, res) => {
  const mode      = req.query["hub.mode"]        as string | undefined;
  const token     = req.query["hub.verify_token"] as string | undefined;
  const challenge = req.query["hub.challenge"]   as string | undefined;

  logger.info({ mode, hasToken: !!token }, "WhatsApp webhook verification request");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("WhatsApp webhook verified ✓");
    res.status(200).send(challenge);
  } else {
    logger.warn({ mode, tokenMatch: token === VERIFY_TOKEN }, "WhatsApp webhook verification FAILED");
    res.status(403).json({ error: "Verification failed" });
  }
});

// ── POST /api/webhook/whatsapp — incoming events (status, messages) ───────────
router.post("/webhook/whatsapp", (req, res) => {
  const body = req.body as any;

  // Always respond 200 quickly — Meta retries if we don't
  res.status(200).json({ received: true });

  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    // ── Delivery status updates ───────────────────────────────────────────────
    if (value?.statuses?.length) {
      for (const status of value.statuses) {
        logger.info(
          { msgId: status.id, status: status.status, recipient: `...${(status.recipient_id ?? "").slice(-4)}` },
          "WhatsApp delivery status",
        );
      }
    }

    // ── Incoming messages (customer replies to the business) ──────────────────
    if (value?.messages?.length) {
      for (const msg of value.messages) {
        const from = msg.from as string;
        const type = msg.type as string;
        const text = msg.text?.body ?? "(non-text)";

        logger.info(
          { from: `...${from.slice(-4)}`, type, text: text.slice(0, 80) },
          "WhatsApp incoming message",
        );
        // Future: route incoming WhatsApp messages to in-app conversations
      }
    }
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : e }, "WhatsApp webhook processing error");
  }
});

export default router;
