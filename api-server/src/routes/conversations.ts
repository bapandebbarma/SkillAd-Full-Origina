import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const router = Router();

const DATA_DIR = resolve(new URL(".", import.meta.url).pathname, "../data");

function readJson<T>(name: string): T[] {
  const f = resolve(DATA_DIR, `${name}.json`);
  try {
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8")) as T[];
  } catch { /* ignore */ }
  return [];
}

function writeJson(name: string, data: unknown): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), "utf-8");
}

/** Append a notification record for a specific user into notifications.json */
function persistUserNotification(opts: {
  id: string;
  targetUserId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
}): void {
  try {
    const all = readJson<any>("notifications");
    // Avoid duplicates (same push may come through twice)
    if (!all.some((n: any) => n.id === opts.id)) {
      all.unshift({
        id: opts.id,
        title: opts.title,
        body: opts.body,
        type: opts.type,
        targetUserId: opts.targetUserId,
        data: opts.data ?? {},
        sentAt: new Date().toISOString(),
        read: false,
      });
      writeJson("notifications", all.slice(0, 500));
    }
  } catch { /* non-fatal */ }
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ── Subscription guard ────────────────────────────────────────────────────────
// Returns false when a provider's subscription has explicitly lapsed so that
// new conversations and new booking messages can be rejected at the API layer.
// Falls back to true for admin-managed or demo providers not in providers.json.
function providerSubscriptionOk(rawProviderId: string): boolean {
  const providers = readJson<any>("providers");
  const p = providers.find(
    (prov: any) => prov.id === rawProviderId || prov.userId === rawProviderId,
  );
  if (!p) return true; // not tracked → assume active
  if (p.subscriptionActive === false) return false;
  if (p.subscriptionEndDate && new Date(p.subscriptionEndDate as string) <= new Date()) return false;
  return true;
}

// ── Universal resolver ────────────────────────────────────────────────────────
// Resolves ANY ID (UUID, phone-based "ph-XXXXXXXXXX", or raw phone) to a real
// Supabase UUID. Works for both customers (profiles table) and providers
// (providers table + providers.json fallback).
// This lets the old APK work without re-login even when IDs are phone-based.
async function resolveUuid(rawId: string): Promise<string | null> {
  if (!supabase) return null;

  // Already a UUID → use directly
  if (isUuid(rawId)) return rawId;

  // "sb-{UUID}" format: the portion after "sb-" is the provider's Supabase auth UUID.
  // Applies to all provider record IDs created by the app (e.g. "sb-40986012-9d56-...").
  if (rawId.startsWith("sb-")) {
    const maybeUuid = rawId.slice(3);
    if (isUuid(maybeUuid)) return maybeUuid;
  }

  // Extract digits: "ph-7085236075" → "7085236075"
  const digits = rawId.startsWith("ph-") ? rawId.slice(3) : rawId.replace(/\D/g, "");
  if (!digits) return null;
  const last10 = digits.slice(-10);

  const phonesToTry = [`+91${last10}`, `91${last10}`, last10, digits]
    .filter((v, i, a) => a.indexOf(v) === i);

  // Strategy 1: Look up in profiles table (covers customers AND providers)
  for (const phone of phonesToTry) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // Strategy 2: Look up in providers table by phone (legacy Supabase rows)
  for (const phone of phonesToTry) {
    const { data } = await supabase
      .from("providers")
      .select("id, user_id")
      .eq("phone", phone)
      .maybeSingle();
    if (data?.user_id) return data.user_id; // prefer auth UUID
    if (data?.id) return data.id;
  }

  // Strategy 3: Read providers.json and return userId (auth UUID)
  const jsonProviders = readJson<any>("providers");
  const match = jsonProviders.find((p: any) => {
    if (p.id === rawId) return true;
    const pPhone = (p.phone ?? "").replace(/\D/g, "").slice(-10);
    return pPhone === last10;
  });
  if (match?.userId && isUuid(match.userId)) return match.userId;

  return null;
}

// ── Server-side push helper ───────────────────────────────────────────────────
// Called after every message insert. Resolves the recipient, checks for a
// valid ExponentPushToken, and calls the Expo Push API. Fully fire-and-forget;
// errors are logged but never bubble up to the HTTP response.
async function dispatchPushToRecipient(
  sb: NonNullable<typeof supabase>,
  conversationId: string,
  senderId: string,
  text: string,
  msgType: string,
): Promise<void> {
  const { data: conv } = await sb
    .from("conversations")
    .select("customer_id, provider_id")
    .eq("id", conversationId)
    .single();
  if (!conv) return;

  const isCustomerSending = senderId === (conv.customer_id as string);
  let recipientUserId: string | null = null;

  if (isCustomerSending) {
    const rawPid = conv.provider_id as string;
    if (!isUuid(rawPid)) return;
    // Try direct profile match (provider_id already is auth UUID)
    const { data: directP } = await sb
      .from("profiles")
      .select("id")
      .eq("id", rawPid)
      .maybeSingle();
    if (directP?.id) {
      recipientUserId = directP.id as string;
    } else {
      // Resolve via providers table → user_id (auth UUID)
      const { data: provRow } = await sb
        .from("providers")
        .select("user_id")
        .eq("id", rawPid)
        .maybeSingle();
      recipientUserId = (provRow?.user_id as string) ?? null;
    }
  } else {
    // Sender is the provider — recipient is the customer (always auth UUID)
    recipientUserId = conv.customer_id as string;
  }

  if (!recipientUserId) return;

  // Fetch recipient push token, sender name, and sender avatar colour in parallel.
  // Providers store their chosen colour in the `providers` table (avatar_color);
  // customers use the `profiles` table (avatar_color).
  const senderColorQuery = isCustomerSending
    ? sb.from("profiles").select("avatar_color").eq("id", senderId).maybeSingle()
    : sb.from("providers").select("avatar_color").eq("user_id", senderId).maybeSingle();

  const [recipResult, senderResult, senderColorResult] = await Promise.all([
    sb.from("profiles").select("push_token").eq("id", recipientUserId).maybeSingle(),
    sb.from("profiles").select("name").eq("id", senderId).maybeSingle(),
    senderColorQuery,
  ]);

  const token = recipResult.data?.push_token as string | null | undefined;
  const senderName = (senderResult.data?.name as string) ?? "Someone";
  const senderAvatarColor = (senderColorResult.data?.avatar_color as string | null) ?? "#64748B";

  const isBooking = msgType === "booking";
  const notifType = isBooking ? "booking" : "message";
  const pushTitle = isBooking ? "📅 New Booking Request" : `💬 ${senderName}`;
  const pushBody = isBooking
    ? `${senderName} sent a booking request`
    : text.length > 100 ? text.slice(0, 100) + "…" : text;
  // providerId = the sender's UUID, which is the chat partner for the notification recipient.
  // Including it in the payload lets the tap handler navigate directly to the correct chat.
  const senderInitials = senderName.split(" ").map((w: string) => w[0] ?? "").join("").toUpperCase().slice(0, 2) || "??";
  const notifData = { type: notifType, conversationId, senderId, providerId: senderId, senderName, senderInitials, avatarColor: senderAvatarColor };

  // Always persist so the notification appears on the Notification page,
  // even if the device has no push token registered yet.
  persistUserNotification({
    id: `msg-${conversationId}-${Date.now()}`,
    targetUserId: recipientUserId,
    title: pushTitle,
    body: pushBody,
    type: notifType,
    data: notifData,
  });

  // Only send Expo push if a valid token is registered
  if (!token || !token.startsWith("ExponentPushToken")) {
    logger.info(
      { recipientUserId, msgType, hasToken: !!token },
      "server push skipped — no valid push token for recipient",
    );
    return;
  }

  const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      sound: "default",
      title: pushTitle,
      body: pushBody,
      data: notifData,
      priority: "high",
      channelId: "default",
    }),
  });
  const expoRespText = await expoRes.text();
  logger.info(
    { recipientUserId, msgType, expoStatus: expoRes.status, expoResp: expoRespText.slice(0, 200) },
    "server push sent",
  );
}

// ── GET /api/conversations?userId=X ─────────────────────────────────────────
// Accepts UUID or phone-based ID (e.g. "ph-7085236075") — resolves either.
router.get("/conversations", async (req, res) => {
console.log("================================");
console.log("[CONVERSATIONS REQUEST]");
console.log("userId =", req.query.userId);
console.log("================================");
  const rawUserId = req.query["userId"] as string | undefined;
  if (!rawUserId) { res.status(400).json({ error: "userId is required" }); return; }
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }

  // Resolve to real UUID (handles old phone-based IDs transparently)
  const userId = isUuid(rawUserId) ? rawUserId : (await resolveUuid(rawUserId));
  if (!userId) {
    res.json({ conversations: [] });
    return;
  }

  // 1. Conversations where I am the CUSTOMER
  // NOTE: Do NOT join providers table here — the Supabase providers table is empty
  // (providers are stored in providers.json + profiles). Using the join causes
  // PostgREST to return an FK error, making custData null and the list appear empty.
  const { data: custData, error: custErr } = await supabase
    .from("conversations")
    .select("id, last_message, last_message_time, customer_unread, customer_id, provider_id")
    .eq("customer_id", userId)
    .order("last_message_time", { ascending: false, nullsFirst: false });

  if (custErr) {
    logger.warn({ custErr }, "conversations: customer query error");
  }

  // Only include real chats: conversation must have at least one message.
  const candidateConversationIds = [
    ...new Set([...(custData ?? []).map((r: any) => r.id as string)]),
  ];
  let conversationIdsWithMessages = new Set<string>();
  if (candidateConversationIds.length > 0) {
    const { data: msgRows } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", candidateConversationIds);
    conversationIdsWithMessages = new Set(
      (msgRows ?? []).map((m: any) => m.conversation_id as string).filter(Boolean),
    );
  }
  const custDataWithMessages = (custData ?? []).filter((row: any) =>
    conversationIdsWithMessages.has(row.id as string),
  );

  // Collect provider IDs to look up names/details
  const custProviderIds = [...new Set(custDataWithMessages.map((r: any) => r.provider_id as string))];
  let providerProfileMap = new Map<string, { name: string; phone: string; avatarUrl: string | null }>();
  if (custProviderIds.length > 0) {
    const { data: provProfiles } = await supabase
      .from("profiles")
      .select("id, name, phone, avatar_url")
      .in("id", custProviderIds);
    for (const p of (provProfiles ?? [])) {
      providerProfileMap.set(p.id, { name: p.name ?? "Provider", phone: p.phone ?? "", avatarUrl: p.avatar_url ?? null });
    }
  }

  // Also query the Supabase providers table for category/initials/avatar_color.
  // user_id is stored so we can resolve profiles.avatar_url via the correct FK.
  type ProviderMeta = { category?: string; avatarColor?: string; initials?: string; userId?: string | null };
  const sbProviderMetaMap = new Map<string, ProviderMeta>();
  if (custProviderIds.length > 0) {
    // Query by providers.id (e.g. "sb-UUID") and also by providers.user_id (for convos where provider_id = auth UUID)
    const { data: byId } = await supabase
      .from("providers")
      .select("id, user_id, category, avatar_color, initials")
      .in("id", custProviderIds);
    for (const row of (byId ?? [])) {
      const meta: ProviderMeta = { category: row.category, avatarColor: row.avatar_color, initials: row.initials, userId: row.user_id ?? null };
      sbProviderMetaMap.set(row.id, meta);
      if (row.user_id) sbProviderMetaMap.set(row.user_id, meta);
    }
    const unmapped = custProviderIds.filter(pid => !sbProviderMetaMap.has(pid));
    if (unmapped.length > 0) {
      const { data: byUserId } = await supabase
        .from("providers")
        .select("id, user_id, category, avatar_color, initials")
        .in("user_id", unmapped);
      for (const row of (byUserId ?? [])) {
        const meta: ProviderMeta = { category: row.category, avatarColor: row.avatar_color, initials: row.initials, userId: row.user_id ?? null };
        if (!sbProviderMetaMap.has(row.id)) sbProviderMetaMap.set(row.id, meta);
        if (row.user_id && !sbProviderMetaMap.has(row.user_id)) sbProviderMetaMap.set(row.user_id, meta);
      }
    }

    // Enrich providerProfileMap with profiles.avatar_url via providers.user_id.
    // The initial profiles query above targets conversation.provider_id (a record ID like "sb-uuid"),
    // not a profile UUID — so it often misses. This second lookup targets profiles by user_id,
    // which is the authoritative link between providers and their avatar.
    const metaUserIds = [...new Set(
      [...sbProviderMetaMap.values()]
        .map((m) => m.userId)
        .filter((uid): uid is string => typeof uid === "string" && uid.length > 0 && !providerProfileMap.has(uid)),
    )];
    if (metaUserIds.length > 0) {
      const { data: userProfiles } = await supabase
        .from("profiles")
        .select("id, name, phone, avatar_url")
        .in("id", metaUserIds);
      for (const p of (userProfiles ?? [])) {
        if (!providerProfileMap.has(p.id)) {
          providerProfileMap.set(p.id, { name: p.name ?? "Provider", phone: p.phone ?? "", avatarUrl: p.avatar_url ?? null });
        }
      }
    }
  }

  const customerConvos = custDataWithMessages.map((row: any) => {
    const sbMeta = sbProviderMetaMap.get(row.provider_id);
    // Look up profile by provider_id first, then by providers.user_id.
    // provider_id is often a record ID ("sb-uuid"), not a profile UUID — the user_id lookup covers that case.
    const profEntry = providerProfileMap.get(row.provider_id)
      ?? (sbMeta?.userId ? providerProfileMap.get(sbMeta.userId) : undefined);
    let name: string | undefined = profEntry?.name;
    let phone: string = profEntry?.phone ?? "";
    // profiles.avatar_url is the single source of truth for avatars
    const profileAvatarUrl: string | null = profEntry?.avatarUrl ?? null;
    let category: string | undefined = sbMeta?.category;
    let avatarColor: string | undefined = sbMeta?.avatarColor;
    let initials: string | undefined = sbMeta?.initials;
    let fallbackAvatarUrl: string | null = null;

    // Fall back to providers.json only if the Supabase providers table had no row for this provider
    if (!sbMeta) {
      const jp = readJson<any>("providers").find((p: any) =>
        p.id === row.provider_id || (isUuid(p.userId ?? "") && p.userId === row.provider_id)
      );
      if (jp) {
        if (!name) { name = jp.name; phone = jp.phone ?? ""; }
        category = jp.category;
        avatarColor = jp.avatarColor ?? jp.avatar_color;
        initials = jp.initials;
        fallbackAvatarUrl = jp.avatarUrl ?? null;
      }
    }

    // profiles.avatar_url is the single source of truth — always updated on every photo upload
    const avatarUrl = profileAvatarUrl ?? fallbackAvatarUrl;

    return {
      id: row.id,
      providerId: row.provider_id,
      providerName: name ?? "Provider",
      providerCategory: category ?? "Service",
      providerAvatarColor: avatarColor ?? "#6366F1",
      providerInitials: initials ?? (name ? name.charAt(0).toUpperCase() : "P"),
      providerAvatarUrl: avatarUrl,
      lastMessage: row.last_message,
      lastMessageTime: formatTime(row.last_message_time),
      unreadCount: row.customer_unread ?? 0,
      phone,
    };
  }).filter((r: any) => r.providerId);

  // 2. Conversations where I am the PROVIDER
  // Search both the providers table row ID and the userId directly
  const providerIds = new Set<string>([userId]);

  const { data: myProviderRow } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (myProviderRow?.id) providerIds.add(myProviderRow.id);

  const { data: provData } = await supabase
    .from("conversations")
    .select("id, last_message, last_message_time, provider_unread, customer_id, provider_id")
    .in("provider_id", [...providerIds])
    .order("last_message_time", { ascending: false });

  const providerConversationIds = [...new Set((provData ?? []).map((r: any) => r.id as string))];
  const missingIds = providerConversationIds.filter((id) => !conversationIdsWithMessages.has(id));
  if (missingIds.length > 0) {
    const { data: providerMsgRows } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", missingIds);
    for (const row of providerMsgRows ?? []) {
      if (row?.conversation_id) conversationIdsWithMessages.add(row.conversation_id as string);
    }
  }

  const provDataWithMessages = (provData ?? []).filter((row: any) =>
    conversationIdsWithMessages.has(row.id as string),
  );

  let providerConvos: any[] = [];
  if (provDataWithMessages.length > 0) {
    const customerIds = [...new Set(provDataWithMessages.map((r: any) => r.customer_id as string))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, name, phone, avatar_url, blocked")
      .in("id", customerIds);

    const profileMap = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
    const myProvId = myProviderRow?.id ?? userId;

    providerConvos = provDataWithMessages.map((row: any) => {
      const profile = profileMap.get(row.customer_id);
      // Filter out deleted users (no profile) or blocked users
      if (!profile || profile.blocked === true) return null;
      const customerName: string = profile.name ?? "Customer";
      const initials = customerName.split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "C";
      return {
        id: row.id,
        providerId: myProvId,
        customerId: row.customer_id,
        providerName: customerName,
        providerCategory: "Customer",
        providerAvatarColor: "#6366F1",
        providerInitials: initials,
        providerAvatarUrl: profile.avatar_url ?? null,
        customerAvatarUrl: profile.avatar_url ?? null,
        lastMessage: row.last_message,
        lastMessageTime: formatTime(row.last_message_time),
        unreadCount: row.provider_unread ?? 0,
        phone: profile.phone ?? "",
      };
    }).filter(Boolean);
  }

  // Merge + deduplicate
  const seen = new Set<string>();
  const all = [...customerConvos, ...providerConvos].filter((c: any) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  res.json({ conversations: all });
});

// ── DELETE /api/conversations/:id ────────────────────────────────────────────
router.delete("/conversations/:id", async (req, res) => {
  const { id } = req.params;
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }

  // Delete messages first (FK constraint), then the conversation
  await supabase.from("messages").delete().eq("conversation_id", id);
  const { error } = await supabase.from("conversations").delete().eq("id", id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true });
});

// ── POST /api/conversations/get-or-create ────────────────────────────────────
// Both customerId and providerId accept UUID or phone-based IDs.
router.post("/conversations/get-or-create", async (req, res) => {
  const { customerId, providerId } = req.body as { customerId?: string; providerId?: string };
  if (!customerId || !providerId) {
    res.status(400).json({ error: "customerId and providerId are required" });
    return;
  }
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }

  // Resolve both IDs — handles "ph-XXXXXXXXXX" for either side
  const [resolvedCustomerId, resolvedProviderId] = await Promise.all([
    resolveUuid(customerId),
    resolveUuid(providerId),
  ]);

  if (!resolvedCustomerId) {
    res.status(404).json({ error: `Customer not found for id: ${customerId}` });
    return;
  }
  if (!resolvedProviderId) {
    res.status(404).json({ error: `Provider not found for id: ${providerId}` });
    return;
  }

  // Prevent self-conversations: customer and provider must be different users
  if (resolvedCustomerId === resolvedProviderId) {
    res.status(400).json({ error: "Cannot create a conversation between a user and themselves" });
    return;
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("customer_id", resolvedCustomerId)
    .eq("provider_id", resolvedProviderId)
    .maybeSingle();

  if (existing) { res.json({ conversationId: existing.id }); return; }

  // No existing conversation — check subscription before creating a new one
  if (!providerSubscriptionOk(resolvedProviderId)) {
    res.status(403).json({
      error: "This provider is not currently accepting new customers. Their subscription has expired.",
      code: "SUBSCRIPTION_INACTIVE",
    });
    return;
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ customer_id: resolvedCustomerId, provider_id: resolvedProviderId })
    .select("id")
    .single();

  if (error || !created) {
    res.status(500).json({ error: error?.message ?? "Failed to create conversation" });
    return;
  }

  res.json({ conversationId: created.id });
});

// ── GET /api/conversations/:id/messages ──────────────────────────────────────
router.get("/conversations/:id/messages", async (req, res) => {
  const { id } = req.params;
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({
    messages: (data ?? []).map((row: any) => {
      const isWorkCompleted = row.type === "work_completed";
const isReviewRequest = row.type === "review_request";
      return {
        id: row.id,
        senderId: row.sender_id,
        text: row.text,
        timestamp: row.created_at,
        read: row.read ?? false,
        type: row.type ?? "text",
       booking: (!isWorkCompleted && !isReviewRequest && row.booking_data)
  ? { ...row.booking_data, status: row.booking_status ?? undefined }
  : undefined,

workCompleted: (isWorkCompleted && row.booking_data)
  ? row.booking_data
  : undefined,

reviewRequest: (isReviewRequest && row.booking_data)
  ? {
      providerId: row.booking_data.providerId,
      providerName: row.booking_data.providerName,
      reviewSubmitted: row.booking_data.review_submitted ?? false,
    }
  : undefined,
      };
    }),
  });
});

// ── POST /api/conversations/:id/messages ─────────────────────────────────────
router.post("/conversations/:id/messages", async (req, res) => {
  const { id } = req.params;
  const { senderId, text, type = "text", bookingData } = req.body as {
    senderId?: string; text?: string; type?: string; bookingData?: any;
  };

  if (!senderId || !text) {
    res.status(400).json({ error: "senderId and text are required" });
    return;
  }
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }

  // Block new booking requests to expired providers.
  // Regular text messages are still allowed so existing conversations remain open.
  if (type === "booking") {
    const { data: conv } = await supabase
      .from("conversations")
      .select("provider_id")
      .eq("id", id)
      .maybeSingle();
    if (conv?.provider_id && !providerSubscriptionOk(conv.provider_id as string)) {
      res.status(403).json({
        error: "This provider's subscription has expired. Booking requests are not currently accepted.",
        code: "SUBSCRIPTION_INACTIVE",
      });
      return;
    }
  }

  // Resolve senderId too — in case old APK sends phone-based ID
  const resolvedSenderId = await resolveUuid(senderId) ?? senderId;

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: id, sender_id: resolvedSenderId, text, type, booking_data: bookingData ?? null })
    .select()
    .single();

  if (error || !data) {
    res.status(500).json({ error: error?.message ?? "Failed to send message" });
    return;
  }

  await supabase
    .from("conversations")
    .update({ last_message: text, last_message_time: data.created_at })
    .eq("id", id);

  res.json({
    message: {
      id: data.id,
      senderId: data.sender_id,
      text: data.text,
      timestamp: data.created_at,
      read: data.read ?? false,
      type: data.type ?? "text",
      booking: data.booking_data ?? undefined,
    },
  });

  // FIX-A: server-side push to recipient (fire-and-forget — never delays the response)
  void dispatchPushToRecipient(supabase, id, resolvedSenderId, text, type).catch((err: any) => {
    logger.warn({ err: err?.message }, "server push dispatch failed");
  });
});

// ── PATCH /api/conversations/:id/messages/:msgId/status ──────────────────────
// Updates booking_status on a single message row.
// Runs server-side (service-role key) so it bypasses Supabase RLS.
// Called by the mobile app instead of updating Supabase directly.
const VALID_BOOKING_STATUSES = new Set([
  "accepted",
  "declined",
  "provider_completed",
  "customer_confirmed_completed",
  "disputed",
]);
// Mark review request as submitted
router.patch(
  "/conversations/:id/messages/:msgId/review-submitted",
  async (req, res) => {
console.log("⭐⭐ REVIEW-SUBMITTED PATCH HIT ⭐⭐", req.params);
    const { msgId } = req.params;

    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { data: existing } = await supabase
      .from("messages")
      .select("booking_data")
      .eq("id", msgId)
      .maybeSingle();

    const bookingData = {
      ...(existing?.booking_data ?? {}),
      review_submitted: true,
    };

    const { error } = await supabase
      .from("messages")
      .update({ booking_data: bookingData })
      .eq("id", msgId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  }
);
router.patch("/messages/:msgId/status", async (req, res) => {
  const { msgId } = req.params;
  const { status } = req.body as { status?: string };

  if (!status || !VALID_BOOKING_STATUSES.has(status)) {
    res.status(400).json({
      error: `Invalid status. Must be one of: ${[...VALID_BOOKING_STATUSES].join(", ")}`,
    });
    return;
  }
  if (!supabase) { res.status(503).json({ error: "Database not configured" }); return; }

  const { data, error } = await supabase
    .from("messages")
    .update({ booking_status: status })
    .eq("id", msgId)
    .select("id, booking_status")
    .single();

  if (error || !data) {
    res.status(500).json({ error: error?.message ?? "Failed to update booking status" });
    return;
  }

  res.json({ id: data.id, booking_status: data.booking_status });
});

export default router;
