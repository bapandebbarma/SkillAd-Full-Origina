import { Router, type Request, type Response } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

interface Subscription {
  id: string;
  userId: string;
  providerId: string;
  plan: string;
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "cancelled";
  notified7: boolean;
  notified3: boolean;
  notified1: boolean;
  notifiedExpired: boolean;
}

function readSubs(): Subscription[] {
  const file = resolve(DATA_DIR, "subscriptions.json");
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf-8")) as Subscription[];
  } catch { /* fall through */ }
  return [];
}

function writeSubs(subs: Subscription[]): void {
  const file = resolve(DATA_DIR, "subscriptions.json");
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(subs, null, 2), "utf-8");
}

function readNotifications(): any[] {
  const file = resolve(DATA_DIR, "notifications.json");
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf-8")) as any[];
  } catch { /* fall through */ }
  return [];
}

function writeNotifications(notifs: any[]): void {
  const file = resolve(DATA_DIR, "notifications.json");
  writeFileSync(file, JSON.stringify(notifs, null, 2), "utf-8");
}

function readProviders(): any[] {
  const file = resolve(DATA_DIR, "providers.json");
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf-8")) as any[];
  } catch { /* fall through */ }
  return [];
}

function writeProviders(providers: any[]): void {
  const file = resolve(DATA_DIR, "providers.json");
  writeFileSync(file, JSON.stringify(providers, null, 2), "utf-8");
}

function readUsers(): any[] {
  const file = resolve(DATA_DIR, "users.json");
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf-8")) as any[];
  } catch { /* fall through */ }
  return [];
}

function readSettings(): { paymentGatewayEnabled?: boolean; freeTrialDays?: number } {
  try {
    const settingsFile = resolve(DATA_DIR, "settings.json");
    if (existsSync(settingsFile)) {
      return JSON.parse(readFileSync(settingsFile, "utf-8")) as {
        paymentGatewayEnabled?: boolean;
        freeTrialDays?: number;
      };
    }
  } catch { /* fall through */ }
  return {};
}

function getFreeTrialDays(): number {
  const s = readSettings();
  if (typeof s.freeTrialDays === "number" && s.freeTrialDays > 0) return s.freeTrialDays;
  return 180;
}

function resolveProviderIdForUser(userId: string): string {
  const providers = readProviders();
  const match = providers.find((p: any) => p.userId === userId);
  if (match?.id) return match.id as string;
  return `sb-${userId}`;
}

function buildSubscriptionGetResponse(sub: Subscription) {
  const now = new Date();
  const expired = new Date(sub.endDate) < now;
  const daysLeft = Math.ceil((new Date(sub.endDate).getTime() - now.getTime()) / 86400000);
  return {
    subscription: sub,
    active: sub.status === "active" && !expired,
    daysLeft: expired ? 0 : daysLeft,
    expired,
  };
}

async function lookupUserProviderStatus(
  userId: string,
): Promise<{ exists: boolean; isProvider: boolean }> {
  const local = readUsers().find((u: any) => u.id === userId);
  if (local) {
    return { exists: true, isProvider: local.isProvider === true };
  }
  if (supabase) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, is_provider")
      .eq("id", userId)
      .maybeSingle();
    if (profile) {
      return { exists: true, isProvider: (profile as any).is_provider === true };
    }
  }
  return { exists: false, isProvider: false };
}

/** Same persistence rules as POST /api/subscriptions/trial. */
function createAndPersistTrialSubscription(userId: string, providerId: string): Subscription {
  const freeTrialDays = getFreeTrialDays();
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + freeTrialDays * 86400000);

  const subs = readSubs();
  const existingIdx = subs.findIndex((s) => s.providerId === providerId || s.userId === userId);
  const sub: Subscription = {
    id: existingIdx >= 0 ? subs[existingIdx]!.id : `sub_trial_${Date.now()}`,
    userId,
    providerId,
    plan: "trial",
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    status: "active",
    notified7: false,
    notified3: false,
    notified1: false,
    notifiedExpired: false,
  };

  if (existingIdx >= 0) {
    subs[existingIdx] = sub;
  } else {
    subs.push(sub);
  }
  writeSubs(subs);

  const providers = readProviders();
  const pIdx = providers.findIndex((p: any) => p.id === providerId || p.userId === userId);
  if (pIdx >= 0) {
    providers[pIdx].subscriptionActive = true;
    providers[pIdx].subscriptionExpiry = endDate.toISOString();
    providers[pIdx].subscriptionEndDate = endDate.toISOString();
    writeProviders(providers);
  }

  return sub;
}

async function tryRepairMissingTrialSubscription(userId: string): Promise<Subscription | null> {
  const settings = readSettings();
  if (settings.paymentGatewayEnabled !== false) return null;

  const { exists, isProvider } = await lookupUserProviderStatus(userId);
  if (!exists || !isProvider) return null;

  const providerId = resolveProviderIdForUser(userId);
  const subs = readSubs();
  const existing = subs.find((s) => s.userId === userId || s.providerId === providerId);
  if (existing) return existing;

  return createAndPersistTrialSubscription(userId, providerId);
}

// ── Plan durations (days) ──────────────────────────────────────────────────────
const PLAN_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  halfYearly: 180,
  yearly: 365,
  trial: 14,
};

// ── POST /api/subscriptions — activate a subscription ─────────────────────────
router.post("/subscriptions", (req: Request, res: Response) => {
  const { userId, providerId, plan } = req.body as {
    userId?: string;
    providerId?: string;
    plan?: string;
  };

  if (!userId || !providerId || !plan) {
    res.status(400).json({ error: "userId, providerId and plan are required" });
    return;
  }

  const days = PLAN_DAYS[plan] ?? 30;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + days * 86400000);

  const subs = readSubs();
  const existingIdx = subs.findIndex((s) => s.providerId === providerId);
  const sub: Subscription = {
    id: existingIdx >= 0 ? subs[existingIdx]!.id : `sub_${Date.now()}`,
    userId,
    providerId,
    plan,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    status: "active",
    notified7: false,
    notified3: false,
    notified1: false,
    notifiedExpired: false,
  };

  if (existingIdx >= 0) {
    subs[existingIdx] = sub;
  } else {
    subs.push(sub);
  }
  writeSubs(subs);

  // Mark provider as active
  const providers = readProviders();
  const pIdx = providers.findIndex((p: any) => p.id === providerId || p.userId === userId);
  if (pIdx >= 0) {
    providers[pIdx].subscriptionActive = true;
    providers[pIdx].subscriptionExpiry = endDate.toISOString();
    writeProviders(providers);
  }

  res.json({ success: true, subscription: sub });
});

// ── POST /api/subscriptions/trial — auto-activate free trial ──────────────────
router.post("/subscriptions/trial", (req: Request, res: Response) => {
  const { userId, providerId } = req.body as {
    userId?: string;
    providerId?: string;
  };

  if (!userId || !providerId) {
    res.status(400).json({ error: "userId and providerId are required" });
    return;
  }

  const sub = createAndPersistTrialSubscription(userId, providerId);
  res.json({ success: true, subscription: sub, trialDays: getFreeTrialDays() });
});

// ── GET /api/subscriptions/:userId ────────────────────────────────────────────
router.get("/subscriptions/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const subs = readSubs();
  let sub = subs.find((s) => s.userId === userId);

  if (!sub) {
    sub = (await tryRepairMissingTrialSubscription(userId)) ?? undefined;
  }

  if (!sub) {
    res.json({ subscription: null, active: false });
    return;
  }

  res.json(buildSubscriptionGetResponse(sub));
});

// ── Expiry checker — called by the scheduler ──────────────────────────────────
export function runSubscriptionExpiryCheck(): void {
  const subs = readSubs();
  const providers = readProviders();
  const notifs = readNotifications();
  const now = new Date();
  let subsChanged = false;
  let providersChanged = false;

  for (const sub of subs) {
    if (sub.status !== "active") continue;

    const end = new Date(sub.endDate);
    const msLeft = end.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / 86400000);

    // Find the provider record
    const pIdx = providers.findIndex(
      (p: any) => p.id === sub.providerId || p.userId === sub.userId,
    );

    if (msLeft <= 0) {
      // Subscription has expired
      sub.status = "expired";
      subsChanged = true;

      if (!sub.notifiedExpired) {
        sub.notifiedExpired = true;
        notifs.unshift({
          id: `notif_exp_${sub.id}`,
          title: "Subscription Expired",
          body: "Your provider account is now inactive because your subscription has expired. Renew now to start receiving customers.",
          type: "subscription",
          audience: "provider",
          targetUserId: sub.userId,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }

      // Deactivate provider
      if (pIdx >= 0 && providers[pIdx].subscriptionActive !== false) {
        providers[pIdx].subscriptionActive = false;
        providersChanged = true;
      }
    } else if (daysLeft <= 1 && !sub.notified1) {
      sub.notified1 = true;
      subsChanged = true;
      notifs.unshift({
        id: `notif_1d_${sub.id}`,
        title: "Subscription Expiring Tomorrow",
        body: "Your subscription expires tomorrow. Renew now otherwise customers cannot contact or view your profile.",
        type: "subscription",
        audience: "provider",
        targetUserId: sub.userId,
        timestamp: new Date().toISOString(),
        read: false,
      });
    } else if (daysLeft <= 3 && !sub.notified3) {
      sub.notified3 = true;
      subsChanged = true;
      notifs.unshift({
        id: `notif_3d_${sub.id}`,
        title: "Subscription Expiring in 3 Days",
        body: "Your subscription is going to expire soon. Renew now otherwise customers cannot contact or view your profile.",
        type: "subscription",
        audience: "provider",
        targetUserId: sub.userId,
        timestamp: new Date().toISOString(),
        read: false,
      });
    } else if (daysLeft <= 7 && !sub.notified7) {
      sub.notified7 = true;
      subsChanged = true;
      notifs.unshift({
        id: `notif_7d_${sub.id}`,
        title: "Subscription Expiring in 7 Days",
        body: "Your subscription is going to expire soon. Renew now otherwise customers cannot contact or view your profile.",
        type: "subscription",
        audience: "provider",
        targetUserId: sub.userId,
        timestamp: new Date().toISOString(),
        read: false,
      });
    }
  }

  if (subsChanged) writeSubs(subs);
  if (providersChanged) writeProviders(providers);
  if (subsChanged) writeNotifications(notifs);

  // Also check providers that have subscriptionEndDate set but no subscription record
  // (e.g. providers registered via the new auto-trial flow in Supabase)
  const subProviderIds = new Set(subs.map((s) => s.providerId));
  const notifs2 = readNotifications();
  let notifs2Changed = false;
  let providers2Changed = false;

  for (const p of providers) {
    if (!p.subscriptionEndDate) continue;
    if (subProviderIds.has(p.id)) continue; // already tracked via subscription record

    const end = new Date(p.subscriptionEndDate as string);
    const msLeft = end.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / 86400000);

    if (msLeft <= 0 && !p.subscriptionExpired) {
      p.subscriptionExpired = true;
      p.subscriptionActive = false;
      providers2Changed = true;
      if (!notifs2.some((n: any) => n.id === `notif_pexp_${p.id}`)) {
        notifs2.unshift({
          id: `notif_pexp_${p.id}`,
          title: "Subscription Expired",
          body: "Your provider account is now inactive because your subscription has expired. Renew now to start receiving customers.",
          type: "subscription",
          audience: "provider",
          targetUserId: p.userId ?? p.id,
          timestamp: new Date().toISOString(),
          read: false,
        });
        notifs2Changed = true;
      }
    } else if (daysLeft <= 3 && daysLeft > 0 && !p.notified3d) {
      p.notified3d = true;
      providers2Changed = true;
      notifs2.unshift({
        id: `notif_p3d_${p.id}`,
        title: "Subscription Expiring in 3 Days",
        body: "Your subscription is going to expire soon. Renew now otherwise customers cannot contact or view your profile.",
        type: "subscription",
        audience: "provider",
        targetUserId: p.userId ?? p.id,
        timestamp: new Date().toISOString(),
        read: false,
      });
      notifs2Changed = true;
    } else if (daysLeft <= 7 && daysLeft > 3 && !p.notified7d) {
      p.notified7d = true;
      providers2Changed = true;
      notifs2.unshift({
        id: `notif_p7d_${p.id}`,
        title: "Subscription Expiring in 7 Days",
        body: "Your subscription is going to expire soon. Renew now otherwise customers cannot contact or view your profile.",
        type: "subscription",
        audience: "provider",
        targetUserId: p.userId ?? p.id,
        timestamp: new Date().toISOString(),
        read: false,
      });
      notifs2Changed = true;
    }
  }

  if (providers2Changed) writeProviders(providers);
  if (notifs2Changed) writeNotifications(notifs2);
}

export default router;
