import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");
const FILE = resolve(DATA_DIR, "earnings.json");

interface EarningRecord {
  id: string;
  /** Message ID of the completed booking — used for duplicate prevention. */
  bookingId: string;
  providerId: string;
  amount: number;
  service: string;
  customerName: string;
  customerInitials: string;
  customerAvatarColor: string;
  /** Customer's profile photo URL. Absent on records written before this field was added. */
  customerAvatarUrl?: string | null;
  conversationId: string;
  createdAt: string;
}

function readAll(): EarningRecord[] {
  try {
    if (!existsSync(FILE)) return [];
    return JSON.parse(readFileSync(FILE, "utf-8")) as EarningRecord[];
  } catch { return []; }
}

function writeAll(data: EarningRecord[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");
}

async function enrichEarningsFromProfiles(records: EarningRecord[]): Promise<EarningRecord[]> {
console.log("========== ENRICH START ==========");
console.log("Total records:", records.length);
  if (!supabase || records.length === 0) return records;

  const missingProfileData = records.filter((e) =>
    e.conversationId &&
    (!e.customerAvatarUrl || e.customerName === "Customer" || e.customerInitials === "C")
  );
console.log("Missing profile data:", missingProfileData.length);
console.log(missingProfileData);
  if (missingProfileData.length === 0) return records;

  try {
    const conversationIds = [...new Set(missingProfileData.map((e) => e.conversationId))];
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, customer_id")
      .in("id", conversationIds);
console.log("Conversations:");
console.log(conversations);
    const customerByConversation = new Map<string, string>();
    for (const conv of conversations ?? []) {
      if ((conv as any).id && (conv as any).customer_id) {
        customerByConversation.set(String((conv as any).id), String((conv as any).customer_id));
      }
    }

    const customerIds = [...new Set([...customerByConversation.values()])];
    if (customerIds.length === 0) return records;

    const {
  data: profiles,
  error: profilesError,
} = await supabase
  .from("profiles")
  .select("id, name, avatar_url")
  .in("id", customerIds);

console.log("Profiles:");
console.log(profiles);

console.log("Profiles Error:");
console.log(profilesError);
console.log("Profiles:");
console.log(profiles);
    const profileById = new Map<string, any>();
    for (const profile of profiles ?? []) {
      profileById.set(String((profile as any).id), profile);
    }

    return records.map((record) => {
console.log("Processing:", record.customerName, record.conversationId);
      if (!record.conversationId) return record;
      const customerId = customerByConversation.get(record.conversationId);
      const profile = customerId ? profileById.get(customerId) : null;
console.log(
  "customerId:",
  customerId,
  "profile:",
  profile
);
      if (!profile) return record;

      const profileName = typeof profile.name === "string" && profile.name.trim()
        ? profile.name.trim()
        : record.customerName;
      const initials = profileName
        .split(" ")
        .map((word: string) => word[0] ?? "")
        .join("")
        .toUpperCase()
        .slice(0, 2) || record.customerInitials;

      return {
        ...record,
        customerName: record.customerName === "Customer" ? profileName : record.customerName,
        customerInitials: record.customerInitials === "C" ? initials : record.customerInitials,
        customerAvatarColor: record.customerAvatarColor,
        customerAvatarUrl: record.customerAvatarUrl || profile.avatar_url || null,
      };
    });
  } catch (err) {
    console.error("enrichEarningsFromProfiles failed:", err);
    return records;
}
}

// ── POST /api/earnings ────────────────────────────────────────────────────────
// Called by the mobile app when a provider marks a booking as completed.
// Idempotent: if bookingId already exists in the store, returns the existing
// record without creating a duplicate (prevents double-tap / retry duplicates).
router.post("/earnings", (req, res) => {
  const {
    bookingId, providerId, amount, service,
    customerName, customerInitials, customerAvatarColor,
    customerAvatarUrl,
    conversationId,
  } = req.body as Record<string, unknown>;

  if (!providerId || typeof amount !== "number") {
    res.status(400).json({ error: "providerId (string) and amount (number) are required" });
    return;
  }

  const all = readAll();

  // Duplicate prevention: if this bookingId was already recorded, return it.
  if (bookingId) {
    const existing = all.find((e) => e.bookingId === String(bookingId));
    if (existing) {
      logger.info({ bookingId, providerId }, "earnings: duplicate skipped");
      res.status(200).json({ earning: existing, duplicate: true });
      return;
    }
  }

  const record: EarningRecord = {
    id:                  `earn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    bookingId:           String(bookingId ?? ""),
    providerId:          String(providerId),
    amount:              Number(amount),
    service:             String(service           ?? "Service"),
    customerName:        String(customerName       ?? "Customer"),
    customerInitials:    String(customerInitials   ?? "C"),
    customerAvatarColor: String(customerAvatarColor ?? "#64748B"),
    customerAvatarUrl:   typeof customerAvatarUrl === "string" ? customerAvatarUrl : null,
    conversationId:      String(conversationId     ?? ""),
    createdAt: new Date().toISOString(),
  };

  all.unshift(record);
  writeAll(all.slice(0, 1000));

  if (supabase) {
    void (async () => {
      try {
        await supabase!.from("earnings").insert({
          provider_id:     record.providerId,
          amount:          record.amount,
          description:     record.service,
          conversation_id: record.conversationId || null,
        });
      } catch { /* best-effort */ }
    })();
  }

  logger.info({ providerId: record.providerId, amount: record.amount }, "earnings: record created");
  res.status(201).json({ earning: record });
});

// ── GET /api/providers/:id/earnings ──────────────────────────────────────────
// Returns all earnings for a provider. :id may be either:
//   • the auth user UUID  ("d22905a9-...")        — sent by fetchEarningsSummary()
//   • the provider record ID ("sb-d22905a9-...")  — stored by recordEarning() via chat
//
// ROOT-CAUSE FIX: earnings are WRITTEN with the provider record ID (chat route
// param = provider.id = "sb-{uuid}") but READ with the raw auth UUID
// (supabaseUserId). The filter must try both forms so both paths resolve to
// the same records. This mirrors the dual-lookup already used in the admin
// panel: earningsByProvider.get(p.id) ?? earningsByProvider.get(p.userId).
router.get("/providers/:id/earnings", async (req, res) => {
  const { id } = req.params;

  // Build the full set of ID variants to match against.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const idsToMatch = new Set<string>([id]);
  if (UUID_RE.test(id)) {
    // Caller passed a raw UUID → also check the "sb-{uuid}" provider record format.
    idsToMatch.add(`sb-${id}`);
  } else if (id.startsWith("sb-") && UUID_RE.test(id.slice(3))) {
    // Caller passed a "sb-{uuid}" record ID → also check the raw UUID.
    idsToMatch.add(id.slice(3));
  }

  let earnings = readAll().filter((e) => idsToMatch.has(e.providerId));

  if (earnings.length === 0 && supabase) {
    try {
      // Query all variant IDs in one request using .in()
      const { data } = await supabase
        .from("earnings")
        .select("*")
        .in("provider_id", [...idsToMatch])
        .order("created_at", { ascending: false })
        .limit(200);
      if (data && data.length > 0) {
        earnings = (data as any[]).map((r: any) => ({
          id:                  String(r.id),
          bookingId:           String(r.booking_id ?? ""),
          providerId:          String(r.provider_id),
          amount:              parseFloat(r.amount) || 0,
          service:             String(r.description ?? "Service"),
          customerName:        "Customer",
          customerInitials:    "C",
          customerAvatarColor: "#64748B",
          customerAvatarUrl:   null,
          conversationId:      String(r.conversation_id ?? ""),
          createdAt:           String(r.created_at),
        }));
      }
    } catch { /* fall through */ }
  }

  earnings = await enrichEarningsFromProfiles(earnings);

  const nowMs   = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const weekMs  =  7 * 24 * 60 * 60 * 1000;

  const totalEarnings   = earnings.reduce((s, e) => s + e.amount, 0);
  const monthlyEarnings = earnings
    .filter((e) => nowMs - new Date(e.createdAt).getTime() <= monthMs)
    .reduce((s, e) => s + e.amount, 0);
  const weeklyEarnings = earnings
    .filter((e) => nowMs - new Date(e.createdAt).getTime() <= weekMs)
    .reduce((s, e) => s + e.amount, 0);

  res.json({
    earnings,
    summary: { totalEarnings, monthlyEarnings, weeklyEarnings, count: earnings.length },
  });
});

export default router;
