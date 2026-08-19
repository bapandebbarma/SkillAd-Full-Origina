import { Router, type Request, type Response, type NextFunction } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";
import { notifySubscriptionActivatedIfNeeded } from "../lib/subscriptionSms.js";

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

// ── SUPABASE base URL helper ──────────────────────────────────────────────────
const SUPABASE_URL = (() => {
  const raw = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
  try { const u = new URL(raw); return `${u.protocol}//${u.host}`; } catch {
    return raw.replace(/\/rest\/v1.*$/, "").replace(/\/$/, "");
  }
})();
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

// ── File helpers ──────────────────────────────────────────────────────────────
function readJson<T>(name: string, fallback: T): T {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const f = resolve(DATA_DIR, `${name}.json`);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8")) as T;
  } catch { /* fall through */ }
  return fallback;
}

function writeJson(name: string, data: unknown): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), "utf-8");
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env["ADMIN_KEY"] ?? "skillad-admin";
  if (req.headers["x-admin-key"] !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface RenewalRequest {
  id: string;
  userId: string;
  providerId: string;
  providerName: string;
  providerPhone: string;
  plan: string;
  amount?: number;
  utr: string;
  paymentDate: string;
  notes: string;
  screenshotUrl?: string;
  status: "pending" | "approved" | "rejected" | "clarification_requested";
  submittedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
  newEndDate?: string;
}

interface AuditEntry {
  id: string;
  providerId: string;
  providerName: string;
  action: string;
  oldEndDate?: string;
  newEndDate?: string;
  oldStatus?: string;
  newStatus?: string;
  days?: number;
  reason?: string;
  performedBy: string;
  timestamp: string;
}

// ── Audit helper ─────────────────────────────────────────────────────────────
function appendAudit(entry: Omit<AuditEntry, "id" | "timestamp">): void {
  const audit = readJson<AuditEntry[]>("subscription_audit", []);
  audit.unshift({ id: `audit_${Date.now()}`, timestamp: new Date().toISOString(), ...entry });
  // Keep last 1 000 entries
  writeJson("subscription_audit", audit.slice(0, 1000));
}

// ── Subscription status helper ────────────────────────────────────────────────
function deriveStatus(p: any): "active" | "expired" | "suspended" | "none" {
  if (p.suspended || p.blocked) return "suspended";
  if (p.subscriptionActive === false) return "expired";
  const end = p.subscriptionEndDate ?? p.subscriptionExpiry ?? null;
  if (!end) return "none";
  if (new Date(end) <= new Date()) return "expired";
  return "active";
}

// ── Apply subscription change to providers.json + Supabase ───────────────────
async function applySubscriptionChange(
  providerId: string,
  updates: { subscriptionActive?: boolean; subscriptionEndDate?: string; plan?: string },
): Promise<void> {
  // 1. Update providers.json
  const providers = readJson<any[]>("providers", []);
  const idx = providers.findIndex((p: any) => p.id === providerId || p.userId === providerId);
  if (idx >= 0) {
    Object.assign(providers[idx], updates);
    writeJson("providers", providers);
  } else {
    // Provider exists only in Supabase — write a minimal stub so providerSubscriptionOk()
    // can enforce the new status. Without this, the booking guard reads providers.json,
    // finds no entry, and falls through to `return true` (assume active).
    const stub: any = { id: providerId, ...updates };
    providers.push(stub);
    writeJson("providers", providers);
  }

  // 2. Update Supabase providers table if available
  if (supabase && updates.subscriptionEndDate !== undefined) {
    await supabase
      .from("providers")
      .update({ subscription_end_date: updates.subscriptionEndDate })
      .or(`id.eq.${providerId},user_id.eq.${providerId}`);
  }
}

// ── Fetch all providers with subscription data ────────────────────────────────
async function allProvidersWithSubs(): Promise<any[]> {
  const localProviders = readJson<any[]>("providers", []);
  const subs = readJson<any[]>("subscriptions", []);
  const subMap = new Map<string, any>();
  for (const s of subs) { subMap.set(s.providerId, s); subMap.set(s.userId, s); }

  // Try to supplement with Supabase
  let sbProviders: any[] = [];
  if (supabase) {
    // subscription_end_date does not exist in the Supabase providers table;
    // subscription data comes exclusively from subscriptions.json (subMap).
    const { data } = await supabase.from("providers").select("id, user_id, name, phone, category, location");
    sbProviders = (data ?? []).map((r: any) => ({
      id: r.id, userId: r.user_id, name: r.name, phone: r.phone,
      category: r.category ?? null, location: r.location ?? null,
      subscriptionEndDate: null,
    }));
  }

  // Build lookup so we can supplement nameless local stubs with Supabase data
  const sbById = new Map(sbProviders.map((p: any) => [p.id, p]));

  // Merge: local takes priority, but if a local record has no name (stub),
  // pull name/phone/userId/category/location from the matching Supabase record.
  const localIds = new Set(localProviders.map((p: any) => p.id));
  const sbOnly = sbProviders.filter((p: any) => !localIds.has(p.id));

  const mergedLocal = localProviders.map((p: any) => {
    if (!p.name && sbById.has(p.id)) {
      const sb = sbById.get(p.id);
      return {
        ...sb,
        ...p,
        name: sb.name,
        phone: p.phone ?? sb.phone,
        userId: p.userId ?? sb.userId,
        category: p.category ?? sb.category,
        location: p.location ?? sb.location,
      };
    }
    return p;
  });

  const all = [...mergedLocal, ...sbOnly];

  const now = new Date();
  return all.map((p: any) => {
    const sub = subMap.get(p.id) ?? subMap.get(p.userId);
    const endDateStr = p.subscriptionEndDate ?? sub?.endDate ?? null;
    const startDateStr = sub?.startDate ?? p.subscriptionStartDate ?? null;
    const endDate = endDateStr ? new Date(endDateStr) : null;
    const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / 86400000) : null;
    const status = deriveStatus({ ...p, subscriptionEndDate: endDateStr });

    return {
      id: p.id,
      userId: p.userId ?? null,
      name: p.name ?? "—",
      phone: p.phone ?? p.mobile ?? "—",
      plan: sub?.plan ?? p.plan ?? "—",
      startDate: startDateStr,
      endDate: endDateStr,
      daysLeft: daysLeft !== null ? Math.max(0, daysLeft) : null,
      status,
      suspended: p.suspended ?? false,
      blocked: p.blocked ?? false,
      location: p.location ?? p.city ?? "—",
      category: p.category ?? "—",
      _hasSub: !!sub,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES (protected by adminAuth)
// ════════════════════════════════════════════════════════════════════════════════
router.use("/admin/subscriptions", adminAuth);
router.use("/admin/renewal-requests", adminAuth);
router.use("/admin/subscription-audit", adminAuth);

// ── GET /api/admin/subscriptions ──────────────────────────────────────────────
router.get("/admin/subscriptions", async (_req, res) => {
  try {
    const list = await allProvidersWithSubs();
    res.json({ subscriptions: list });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load subscriptions" });
  }
});

// ── PUT /api/admin/subscriptions/:providerId ──────────────────────────────────
// Body: { action, days?, endDate?, reason?, plan? }
// action: "extend" | "set_date" | "activate" | "suspend" | "grant_free"
router.put("/admin/subscriptions/:providerId", async (req: Request, res: Response) => {
  const { providerId } = req.params as { providerId: string };
  const { action, days, endDate, reason, plan } = req.body as {
    action: string; days?: number; endDate?: string; reason?: string; plan?: string;
  };

  if (!action) { res.status(400).json({ error: "action is required" }); return; }

  const providers = readJson<any[]>("providers", []);
  const idx = providers.findIndex((p: any) => p.id === providerId || p.userId === providerId);
  const providerName = idx >= 0 ? (providers[idx]?.name ?? providerId) : providerId;

  const oldEndDate = idx >= 0 ? (providers[idx]?.subscriptionEndDate ?? null) : null;
  const oldStatus = idx >= 0 ? deriveStatus(providers[idx]) : "none";

  let newEndDate: string | undefined;
  let newActive: boolean | undefined;
  let newStatus: string = oldStatus;

  const now = new Date();

  if (action === "extend" && days && days > 0) {
    // Extend from today (or from existing end date if still in future)
    const base = oldEndDate && new Date(oldEndDate) > now ? new Date(oldEndDate) : now;
    const d = new Date(base.getTime() + days * 86400000);
    newEndDate = d.toISOString();
    newActive = true;
    newStatus = "active";
  } else if (action === "set_date" && endDate) {
    newEndDate = new Date(endDate).toISOString();
    newActive = new Date(endDate) > now;
    newStatus = newActive ? "active" : "expired";
  } else if (action === "activate") {
    // Activate: if no end date or expired, grant 30 days; otherwise just mark active
    if (!oldEndDate || new Date(oldEndDate) <= now) {
      newEndDate = new Date(now.getTime() + 30 * 86400000).toISOString();
    }
    newActive = true;
    newStatus = "active";
  } else if (action === "suspend") {
    newActive = false;
    newStatus = "suspended";
  } else if (action === "grant_free") {
    const freeDays = days ?? 180;
    const d = new Date(now.getTime() + freeDays * 86400000);
    newEndDate = d.toISOString();
    newActive = true;
    newStatus = "active";
  } else {
    res.status(400).json({ error: `Unknown action: ${action}` });
    return;
  }

  // Apply changes
  const updates: any = {};
  if (newActive !== undefined) updates.subscriptionActive = newActive;
  if (newEndDate !== undefined) updates.subscriptionEndDate = newEndDate;
  // NOTE: "suspend" here means deactivating the subscription only (subscriptionActive = false).
  // It deliberately does NOT touch the provider's `suspended` flag, which is a separate
  // account-level field managed by the Providers admin panel.
  if (plan) updates.plan = plan;

  await applySubscriptionChange(providerId, updates);

  // Update subscriptions.json — create a new record if none exists yet
  const subs = readJson<any[]>("subscriptions", []);
  const subIdx = subs.findIndex((s: any) => s.providerId === providerId || s.userId === providerId);
  if (subIdx >= 0) {
    if (newEndDate) subs[subIdx].endDate = newEndDate;
    if (newActive !== undefined) subs[subIdx].status = newActive ? "active" : "expired";
    if (plan) subs[subIdx].plan = plan;
    writeJson("subscriptions", subs);
  } else if (newEndDate && newActive) {
    // Provider never had a subscription record — create one so _hasSub becomes true
    // and the subscription is properly tracked (expiry notifications, admin display).
    // Re-read providers.json because applySubscriptionChange may have just added a stub.
    const freshProviders = readJson<any[]>("providers", []);
    const provRec = freshProviders.find((p: any) => p.id === providerId || p.userId === providerId);
    // For SkillAd providers the id is always "sb-<userId>"; extract as fallback.
    const inferredUserId = providerId.startsWith("sb-") ? providerId.slice(3) : "";
    subs.push({
      id: `sub_repair_${Date.now()}`,
      userId: provRec?.userId ?? inferredUserId,
      providerId,
      plan: plan ?? "free_trial",
      startDate: new Date().toISOString(),
      endDate: newEndDate,
      status: "active",
      notified7: false,
      notified3: false,
      notified1: false,
      notifiedExpired: false,
    });
    writeJson("subscriptions", subs);
  }

  // Audit trail
  appendAudit({
    providerId,
    providerName,
    action,
    oldEndDate: oldEndDate ?? undefined,
    newEndDate,
    oldStatus,
    newStatus,
    days: days ?? undefined,
    reason: reason ?? undefined,
    performedBy: "admin",
  });

  if (newStatus === "active" && newEndDate) {
    const freshProviders = readJson<any[]>("providers", []);
    const provRec = freshProviders.find(
      (p: any) => p.id === providerId || p.userId === providerId,
    );
    const inferredUserId = providerId.startsWith("sb-") ? providerId.slice(3) : "";
    const userId = provRec?.userId ?? inferredUserId;
    const subsAfter = readJson<any[]>("subscriptions", []);
    const subRec = subsAfter.find(
      (s: any) => s.providerId === providerId || s.userId === providerId || s.userId === userId,
    );
    const planId = plan ?? subRec?.plan ?? "subscription";
    if (userId) {
      void notifySubscriptionActivatedIfNeeded({
        userId,
        providerId,
        planId,
        endDate: newEndDate,
      });
    }
  }

  res.json({ success: true, providerId, action, newEndDate, newStatus });
});

// ── GET /api/admin/subscription-audit ─────────────────────────────────────────
router.get("/admin/subscription-audit", (req: Request, res: Response) => {
  const { providerId } = req.query as { providerId?: string };
  let audit = readJson<AuditEntry[]>("subscription_audit", []);
  if (providerId) audit = audit.filter((a) => a.providerId === providerId);
  res.json({ audit: audit.slice(0, 200) });
});

// ── GET /api/admin/renewal-requests ───────────────────────────────────────────
router.get("/admin/renewal-requests", (_req, res) => {
  const requests = readJson<RenewalRequest[]>("renewal_requests", []);
  res.json({ requests });
});

// ── POST /api/admin/renewal-requests/:id/approve ──────────────────────────────
router.post("/admin/renewal-requests/:id/approve", async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { newEndDate, days, reason, plan } = req.body as {
    newEndDate?: string; days?: number; reason?: string; plan?: string;
  };

  const requests = readJson<RenewalRequest[]>("renewal_requests", []);
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) { res.status(404).json({ error: "Renewal request not found" }); return; }

  const rr = requests[idx]!;
  const now = new Date();

  // Calculate approved end date
  let approvedEndDate: string;
  if (newEndDate) {
    approvedEndDate = new Date(newEndDate).toISOString();
  } else {
    const planDays: Record<string, number> = { monthly: 30, quarterly: 90, halfYearly: 180, yearly: 365, trial: 180 };
    const d = days ?? planDays[plan ?? rr.plan] ?? 180;
    // Extend from current end date if still in future, otherwise from today
    const providers = readJson<any[]>("providers", []);
    const p = providers.find((pr: any) => pr.id === rr.providerId || pr.userId === rr.userId);
    const base = p?.subscriptionEndDate && new Date(p.subscriptionEndDate) > now
      ? new Date(p.subscriptionEndDate)
      : now;
    approvedEndDate = new Date(base.getTime() + d * 86400000).toISOString();
  }

  // Update request record
  requests[idx] = {
    ...rr,
    status: "approved",
    reviewedAt: now.toISOString(),
    reviewNotes: reason ?? "Approved",
    newEndDate: approvedEndDate,
  };
  writeJson("renewal_requests", requests);

  // Apply subscription change
  await applySubscriptionChange(rr.providerId, {
    subscriptionActive: true,
    subscriptionEndDate: approvedEndDate,
  });

  // Update subscriptions.json record
  const subs = readJson<any[]>("subscriptions", []);
  const subIdx = subs.findIndex((s: any) => s.providerId === rr.providerId || s.userId === rr.userId);
  if (subIdx >= 0) {
    subs[subIdx].endDate = approvedEndDate;
    subs[subIdx].status = "active";
    if (plan ?? rr.plan) subs[subIdx].plan = plan ?? rr.plan;
    writeJson("subscriptions", subs);
  } else {
    // Create a new subscription record
    const newSub = {
      id: `sub_${Date.now()}`,
      userId: rr.userId,
      providerId: rr.providerId,
      plan: plan ?? rr.plan,
      startDate: now.toISOString(),
      endDate: approvedEndDate,
      status: "active",
      notified7: false, notified3: false, notified1: false, notifiedExpired: false,
    };
    subs.push(newSub);
    writeJson("subscriptions", subs);
  }

  appendAudit({
    providerId: rr.providerId,
    providerName: rr.providerName,
    action: "approve_renewal",
    oldEndDate: undefined,
    newEndDate: approvedEndDate,
    newStatus: "active",
    reason: reason ?? "Manual renewal approved",
    performedBy: "admin",
  });

  void notifySubscriptionActivatedIfNeeded({
    userId: rr.userId,
    providerId: rr.providerId,
    planId: plan ?? rr.plan,
    endDate: approvedEndDate,
  });

  res.json({ success: true, newEndDate: approvedEndDate });
});

// ── POST /api/admin/renewal-requests/:id/reject ───────────────────────────────
router.post("/admin/renewal-requests/:id/reject", (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { reason } = req.body as { reason?: string };

  const requests = readJson<RenewalRequest[]>("renewal_requests", []);
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) { res.status(404).json({ error: "Renewal request not found" }); return; }

  const rr = requests[idx]!;
  requests[idx] = {
    ...rr,
    status: "rejected",
    reviewedAt: new Date().toISOString(),
    reviewNotes: reason ?? "Rejected by admin",
  };
  writeJson("renewal_requests", requests);

  appendAudit({
    providerId: rr.providerId,
    providerName: rr.providerName,
    action: "reject_renewal",
    reason: reason ?? "Rejected",
    newStatus: "rejected",
    performedBy: "admin",
  });

  res.json({ success: true });
});

// ── POST /api/admin/renewal-requests/:id/clarify ──────────────────────────────
router.post("/admin/renewal-requests/:id/clarify", (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { reason } = req.body as { reason?: string };

  const requests = readJson<RenewalRequest[]>("renewal_requests", []);
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) { res.status(404).json({ error: "Renewal request not found" }); return; }

  const rr = requests[idx]!;
  requests[idx] = {
    ...rr,
    status: "clarification_requested",
    reviewedAt: new Date().toISOString(),
    reviewNotes: reason ?? "Please provide more information",
  };
  writeJson("renewal_requests", requests);

  appendAudit({
    providerId: rr.providerId,
    providerName: rr.providerName,
    action: "clarify_renewal",
    reason: reason ?? "Clarification requested",
    performedBy: "admin",
  });

  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no auth — provider-side)
// ════════════════════════════════════════════════════════════════════════════════

// ── POST /api/renewal-requests — provider submits renewal ─────────────────────
router.post("/renewal-requests", (req: Request, res: Response) => {
  const { userId, providerId, providerName, providerPhone, plan, amount, utr, paymentDate, notes, screenshotUrl } = req.body as {
    userId?: string; providerId?: string; providerName?: string; providerPhone?: string;
    plan?: string; amount?: number; utr?: string; paymentDate?: string; notes?: string; screenshotUrl?: string;
  };

  if (!userId || !providerId || !utr) {
    res.status(400).json({ error: "userId, providerId and utr are required" });
    return;
  }

  const requests = readJson<RenewalRequest[]>("renewal_requests", []);

  // Cancel any existing pending request for this provider
  for (const r of requests) {
    if ((r.providerId === providerId || r.userId === userId) && r.status === "pending") {
      r.status = "rejected";
      r.reviewNotes = "Superseded by new submission";
      r.reviewedAt = new Date().toISOString();
    }
  }

  const newRequest: RenewalRequest = {
    id: `ren_${Date.now()}`,
    userId,
    providerId,
    providerName: providerName ?? "Unknown",
    providerPhone: providerPhone ?? "",
    plan: plan ?? "halfYearly",
    amount,
    utr,
    paymentDate: paymentDate ?? new Date().toISOString().slice(0, 10),
    notes: notes ?? "",
    screenshotUrl,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };

  requests.unshift(newRequest);
  writeJson("renewal_requests", requests);

  res.json({ success: true, requestId: newRequest.id });
});

// ── GET /api/renewal-requests/:userId — get provider's latest request ──────────
router.get("/renewal-requests/:userId", (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const requests = readJson<RenewalRequest[]>("renewal_requests", []);
  const latest = requests.find((r) => r.userId === userId || r.providerId === userId) ?? null;
  res.json({ request: latest });
});

export default router;
