/**
 * Contact messages — Supabase-backed store for landing Contact form + Admin inbox.
 */
import { supabase } from "./supabase.js";
import { logger } from "./logger.js";

export type ContactStatus = "new" | "read" | "replied" | "closed";

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  status: ContactStatus;
  readAt: string | null;
  repliedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  source: string;
}

export interface ContactAuditEntry {
  id: string;
  messageId: string | null;
  action: string;
  admin: string;
  createdAt: string;
  meta?: Record<string, unknown> | null;
}

export interface CreateContactInput {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  source?: string;
}

export interface ListContactOptions {
  status?: ContactStatus | "all";
  search?: string;
  page?: number;
  limit?: number;
}

function rowToMessage(row: any): ContactMessage {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    subject: String(row.subject ?? ""),
    message: String(row.message ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    status: (row.status as ContactStatus) || "new",
    readAt: row.read_at ? String(row.read_at) : null,
    repliedAt: row.replied_at ? String(row.replied_at) : null,
    ipAddress: row.ip_address != null ? String(row.ip_address) : null,
    userAgent: row.user_agent != null ? String(row.user_agent) : null,
    source: String(row.source ?? "Landing Page"),
  };
}

function ensureDb() {
  if (!supabase) {
    throw new Error("Database unavailable");
  }
  return supabase;
}

export async function createContactMessage(input: CreateContactInput): Promise<ContactMessage> {
  const db = ensureDb();
  const { data, error } = await db
    .from("contact_messages")
    .insert({
      name: input.name,
      email: input.email,
      phone: input.phone,
      subject: input.subject,
      message: input.message,
      status: "new",
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      source: input.source ?? "Landing Page",
    })
    .select("*")
    .single();

  if (error || !data) {
    logger.error({ error }, "contact: insert failed");
    throw new Error(error?.message ?? "Failed to save contact message");
  }
  return rowToMessage(data);
}

export async function listContactMessages(
  opts: ListContactOptions = {},
): Promise<{ messages: ContactMessage[]; total: number; unreadCount: number }> {
  const db = ensureDb();
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(Math.max(1, opts.limit ?? 20), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = db
    .from("contact_messages")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts.status && opts.status !== "all") {
    query = query.eq("status", opts.status);
  }

  const search = (opts.search ?? "").trim();
  if (search) {
    const safe = search.replace(/[%_,]/g, "");
    if (safe) {
      query = query.or(
        `name.ilike.%${safe}%,email.ilike.%${safe}%,subject.ilike.%${safe}%,message.ilike.%${safe}%,phone.ilike.%${safe}%`,
      );
    }
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logger.error({ error }, "contact: list failed");
    throw new Error(error.message);
  }

  const { count: unreadCount, error: unreadErr } = await db
    .from("contact_messages")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");

  if (unreadErr) {
    logger.warn({ unreadErr }, "contact: unread count failed");
  }

  return {
    messages: (data ?? []).map(rowToMessage),
    total: count ?? 0,
    unreadCount: unreadCount ?? 0,
  };
}

export async function getContactMessage(id: string): Promise<ContactMessage | null> {
  const db = ensureDb();
  const { data, error } = await db.from("contact_messages").select("*").eq("id", id).maybeSingle();
  if (error) {
    logger.error({ error, id }, "contact: get failed");
    throw new Error(error.message);
  }
  return data ? rowToMessage(data) : null;
}

export async function updateContactStatus(
  id: string,
  status: ContactStatus,
): Promise<ContactMessage | null> {
  const db = ensureDb();
  const existing = await getContactMessage(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };

  if (status === "read" || status === "replied" || status === "closed") {
    if (!existing.readAt) patch.read_at = now;
  }
  if (status === "replied") {
    if (!existing.repliedAt) patch.replied_at = now;
  }
  if (status === "new") {
    patch.read_at = null;
    patch.replied_at = null;
  }

  const { data, error } = await db
    .from("contact_messages")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    logger.error({ error, id }, "contact: update failed");
    throw new Error(error?.message ?? "Failed to update contact message");
  }
  return rowToMessage(data);
}

export async function deleteContactMessage(id: string): Promise<boolean> {
  const db = ensureDb();
  const { error } = await db.from("contact_messages").delete().eq("id", id);
  if (error) {
    logger.error({ error, id }, "contact: delete failed");
    throw new Error(error.message);
  }
  return true;
}

export async function countNewContactMessages(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("contact_messages")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");
  if (error) {
    logger.warn({ error }, "contact: count new failed");
    return 0;
  }
  return count ?? 0;
}

export async function appendContactAudit(entry: {
  messageId: string | null;
  action: string;
  admin?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("contact_audit").insert({
    message_id: entry.messageId,
    action: entry.action,
    admin: entry.admin ?? "admin",
    meta: entry.meta ?? null,
  });
  if (error) {
    logger.warn({ error, action: entry.action }, "contact: audit append failed");
  }
}
