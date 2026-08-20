/**
 * Persistent OTP audit log (Supabase). Never stores plaintext OTP codes.
 */
import { supabase } from "./supabase.js";
import { logger } from "./logger.js";

export type OtpAuditEvent =
  | "send"
  | "resend"
  | "verify_ok"
  | "verify_fail"
  | "expired"
  | "blocked";

export interface OtpAuditRow {
  id: string;
  phoneMasked: string;
  eventType: OtpAuditEvent;
  channel: string | null;
  success: boolean;
  detail: string | null;
  provider: string;
  createdAt: string;
}

function isSuccessEvent(event: OtpAuditEvent, detail?: string): boolean {
  if (event === "verify_ok") return true;
  if (event === "send" || event === "resend") {
    // delivery failure is recorded with a detail starting with fail keywords
    if (!detail) return true;
    const d = detail.toLowerCase();
    if (d.includes("fail") || d.includes("error") || d.includes("not configured")) return false;
    return true;
  }
  return false;
}

/** Strip anything that looks like a 4–8 digit OTP from free-text detail. */
export function sanitizeOtpDetail(detail?: string | null): string | null {
  if (!detail) return null;
  const cleaned = String(detail)
    .replace(/\b\d{4,8}\b/g, "[redacted]")
    .slice(0, 500)
    .trim();
  return cleaned || null;
}

export async function appendOtpAudit(input: {
  phoneMasked: string;
  eventType: OtpAuditEvent;
  channel?: string | null;
  detail?: string | null;
  provider?: string;
}): Promise<void> {
  if (!supabase) return;
  const detail = sanitizeOtpDetail(input.detail);
  const success = isSuccessEvent(input.eventType, detail ?? undefined);
  try {
    const { error } = await supabase.from("otp_audit_logs").insert({
      phone_masked: input.phoneMasked,
      event_type: input.eventType,
      channel: input.channel ?? null,
      success,
      detail,
      provider: input.provider ?? "MSG91",
    });
    if (error) {
      logger.warn({ error: error.message }, "otp_audit: insert failed");
    }
  } catch (e: any) {
    logger.warn({ err: e?.message }, "otp_audit: insert exception");
  }
}

export async function listOtpAudit(opts: {
  eventType?: OtpAuditEvent | "all";
  page?: number;
  limit?: number;
}): Promise<{ logs: OtpAuditRow[]; total: number }> {
  if (!supabase) {
    return { logs: [], total: 0 };
  }
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(Math.max(1, opts.limit ?? 100), 200);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("otp_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts.eventType && opts.eventType !== "all") {
    query = query.eq("event_type", opts.eventType);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logger.error({ error }, "otp_audit: list failed");
    throw new Error(error.message);
  }

  const logs: OtpAuditRow[] = (data ?? []).map((row: any) => ({
    id: String(row.id),
    phoneMasked: String(row.phone_masked ?? ""),
    eventType: row.event_type as OtpAuditEvent,
    channel: row.channel != null ? String(row.channel) : null,
    success: Boolean(row.success),
    detail: row.detail != null ? String(row.detail) : null,
    provider: String(row.provider ?? "MSG91"),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }));

  return { logs, total: count ?? logs.length };
}
