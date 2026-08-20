/**
 * Public contact form + secured Admin Contact Messages inbox.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger.js";
import { sendMailSafe } from "../lib/mailService.js";
import {
  appendContactAudit,
  createContactMessage,
  deleteContactMessage,
  deletionWorkflowStatus,
  getContactMessage,
  listContactMessages,
  updateContactStatus,
  type ContactStatus,
} from "../lib/contactMessagesStore.js";
import { supabase } from "../lib/supabase.js";

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const STATUSES: ContactStatus[] = ["new", "read", "replied", "closed"];

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env["ADMIN_KEY"] ?? "skillad-admin";
  const provided = req.headers["x-admin-key"];
  if (provided !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function readSupportEmail(): string {
  try {
    const f = resolve(DATA_DIR, "settings.json");
    if (!existsSync(f)) return "support@skillad.in";
    const s = JSON.parse(readFileSync(f, "utf-8")) as { supportEmail?: string };
    return (s.supportEmail ?? "support@skillad.in").trim() || "support@skillad.in";
  } catch {
    return "support@skillad.in";
  }
}

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(",")[0]?.trim() || "unknown";
  return req.socket.remoteAddress ?? "unknown";
}

function isValidStatus(v: unknown): v is ContactStatus {
  return typeof v === "string" && STATUSES.includes(v as ContactStatus);
}

// ── POST /api/contact — public landing form ───────────────────────────────────
router.post("/contact", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;

    // Honeypot — bots fill hidden fields; respond as success without storing
    const honeypot = String(body.website ?? body.company ?? body.honeypot ?? "").trim();
    if (honeypot) {
      logger.info({ ip: clientIp(req) }, "contact: honeypot triggered");
      res.status(201).json({ success: true, id: "ok" });
      return;
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const subject = String(body.subject ?? "").trim() || "Website contact";
    const message = String(body.message ?? "").trim();

    if (!name || !email || !message) {
      res.status(400).json({ error: "name, email, and message are required" });
      return;
    }
    if (name.length > 120) {
      res.status(400).json({ error: "Name is too long" });
      return;
    }
    if (!EMAIL_RE.test(email) || email.length > 200) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }
    if (!message || !message.replace(/\s/g, "").length) {
      res.status(400).json({ error: "Message cannot be empty" });
      return;
    }
    if (message.length > 5000) {
      res.status(400).json({ error: "Message is too long" });
      return;
    }

    const ipAddress = clientIp(req);
    const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 500) || null;

    const entry = await createContactMessage({
      name: name.slice(0, 120),
      email: email.slice(0, 200),
      phone: phone.slice(0, 40),
      subject: subject.slice(0, 200),
      message: message.slice(0, 5000),
      ipAddress,
      userAgent,
      source: "Landing Page",
    });

    logger.info({ id: entry.id, email: entry.email }, "contact: message received");

    const supportEmail = readSupportEmail();
    const submittedAt = new Date(entry.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const notifyText = [
      "New Contact Message - SkillAd",
      "",
      `Name: ${entry.name}`,
      `Email: ${entry.email}`,
      `Phone: ${entry.phone || "—"}`,
      `Subject: ${entry.subject}`,
      `Submission Time: ${submittedAt}`,
      "",
      "Message:",
      entry.message,
    ].join("\n");

    void sendMailSafe({
      to: supportEmail,
      subject: "New Contact Message - SkillAd",
      text: notifyText,
      replyTo: entry.email,
    });

    void sendMailSafe({
      to: entry.email,
      subject: "We received your message",
      text: [
        "Thank you for contacting SkillAd.",
        "",
        "We have received your enquiry and our team will contact you soon.",
        "",
        "This is an automated acknowledgement.",
        "",
        "— SkillAd Team",
      ].join("\n"),
    });

    res.status(201).json({ success: true, id: entry.id });
  } catch (e) {
    logger.error({ e }, "contact: submit failed");
    res.status(500).json({ error: "Failed to send message. Please try again later." });
  }
});

function maskEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  if (at <= 1) return "***";
  return `${e[0]}***${e.slice(at)}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 4) return "***";
  return `+91 XXXXXX${digits.slice(-4)}`;
}

async function lookupProfileIdByPhone(phone: string): Promise<string | null> {
  if (!supabase) return null;
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return null;
  const variants = [`+91${digits}`, `91${digits}`, digits];
  for (const p of variants) {
    const { data } = await supabase.from("profiles").select("id").eq("phone", p).maybeSingle();
    if (data?.id) return String(data.id);
  }
  return null;
}

// ── Admin: account deletion requests (filtered contact_messages) ──────────────
router.get("/admin/deletion-requests", adminAuth, async (req, res) => {
  try {
    const statusRaw = String(req.query.status ?? "all");
    const status =
      statusRaw === "all" || isValidStatus(statusRaw) ? (statusRaw as ContactStatus | "all") : "all";
    const search = String(req.query.search ?? "");
    const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
    const limit = parseInt(String(req.query.limit ?? "20"), 10) || 20;

    const result = await listContactMessages({
      status,
      search,
      page,
      limit,
      deletionRequestsOnly: true,
    });

    const requests = await Promise.all(
      result.messages.map(async (m) => {
        const userId = await lookupProfileIdByPhone(m.phone);
        return {
          id: m.id,
          userId,
          name: m.name,
          emailMasked: maskEmail(m.email),
          phoneMasked: maskPhone(m.phone),
          email: m.email,
          phone: m.phone,
          subject: m.subject,
          message: m.message,
          createdAt: m.createdAt,
          status: m.status,
          workflowStatus: deletionWorkflowStatus(m.status),
          readAt: m.readAt,
          repliedAt: m.repliedAt,
          source: m.source,
          ipAddress: m.ipAddress,
        };
      }),
    );

    res.json({
      requests,
      total: result.total,
      pendingCount: result.unreadCount,
    });
  } catch (e) {
    logger.error({ e }, "contact: deletion-requests list failed");
    res.status(500).json({ error: "Failed to load deletion requests" });
  }
});

// ── Admin: list ───────────────────────────────────────────────────────────────
router.get("/admin/contact-messages", adminAuth, async (req, res) => {
  try {
    const statusRaw = String(req.query.status ?? "all");
    const status =
      statusRaw === "all" || isValidStatus(statusRaw) ? (statusRaw as ContactStatus | "all") : "all";
    const search = String(req.query.search ?? "");
    const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
    const limit = parseInt(String(req.query.limit ?? "20"), 10) || 20;

    const result = await listContactMessages({ status, search, page, limit });
    res.json(result);
  } catch (e) {
    logger.error({ e }, "contact: admin list failed");
    res.status(500).json({ error: "Failed to load contact messages" });
  }
});

// ── Admin: get one ────────────────────────────────────────────────────────────
router.get("/admin/contact-messages/:id", adminAuth, async (req, res) => {
  try {
    const msg = await getContactMessage(String(req.params.id));
    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    res.json({ message: msg });
  } catch (e) {
    logger.error({ e }, "contact: admin get failed");
    res.status(500).json({ error: "Failed to load message" });
  }
});

// ── Admin: update status ──────────────────────────────────────────────────────
router.patch("/admin/contact-messages/:id", adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const status = (req.body as { status?: unknown })?.status;
    if (!isValidStatus(status)) {
      res.status(400).json({ error: "status must be new, read, replied, or closed" });
      return;
    }

    const updated = await updateContactStatus(id, status);
    if (!updated) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (status === "read" || status === "replied" || status === "closed") {
      await appendContactAudit({
        messageId: id,
        action: status === "read" ? "mark_read" : status === "replied" ? "mark_replied" : "mark_closed",
        admin: "admin",
        meta: { status },
      });
    }

    res.json({ message: updated });
  } catch (e) {
    logger.error({ e }, "contact: admin patch failed");
    res.status(500).json({ error: "Failed to update message" });
  }
});

// ── Admin: delete ─────────────────────────────────────────────────────────────
router.delete("/admin/contact-messages/:id", adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await getContactMessage(id);
    if (!existing) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    await appendContactAudit({
      messageId: id,
      action: "delete",
      admin: "admin",
      meta: { email: existing.email, subject: existing.subject },
    });

    await deleteContactMessage(id);
    res.json({ success: true });
  } catch (e) {
    logger.error({ e }, "contact: admin delete failed");
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
