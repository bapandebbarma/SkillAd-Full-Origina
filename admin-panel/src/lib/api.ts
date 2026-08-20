declare const __API_BASE__: string;

/**
 * Production (Vite build): __API_BASE__ = "https://api.skillad.in/api"
 * Dev (vite serve): __API_BASE__ = "" → relative "/api" (proxied to localhost:3000)
 */
function resolveApiBase(): string {
  const raw =
    typeof __API_BASE__ !== "undefined" && __API_BASE__
      ? String(__API_BASE__).trim().replace(/\/$/, "")
      : "";
  return raw || "/api";
}

export const API_BASE = resolveApiBase();

const ADMIN_KEY = "skillad-admin";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Stats
  getStats: () => req<any>("GET", "/admin/stats"),

  // Providers
  getProviders: () => req<any>("GET", "/admin/providers"),
  updateProvider: (id: string, data: any) => req<any>("PUT", `/admin/providers/${id}`, data),
  deleteProvider: (id: string) => req<any>("DELETE", `/admin/providers/${id}`),
  getDuplicateProviders: () => req<any>("GET", "/admin/providers/duplicates"),
  mergeProviders: (keepId: string, deleteIds: string[]) => req<any>("POST", "/admin/providers/merge", { keepId, deleteIds }),

  // Users
  getUsers: () => req<any>("GET", "/admin/users"),
  updateUser: (id: string, data: any) => req<any>("PUT", `/admin/users/${id}`, data),
  deleteUser: (id: string) => req<any>("DELETE", `/admin/users/${id}`),

  // Categories
  getCategories: () => req<any>("GET", "/admin/categories"),
  createCategory: (data: any) => req<any>("POST", "/admin/categories", data),
  updateCategory: (id: string, data: any) => req<any>("PUT", `/admin/categories/${id}`, data),
  deleteCategory: (id: string) => req<any>("DELETE", `/admin/categories/${id}`),

  // Ads
  getAds: () => req<any>("GET", "/admin/ads"),
  createAd: (data: any) => req<any>("POST", "/admin/ads", data),
  updateAd: (id: string, data: any) => req<any>("PUT", `/admin/ads/${id}`, data),
  deleteAd: (id: string) => req<any>("DELETE", `/admin/ads/${id}`),

  // Plans
  getPlans: () => fetch(`${API_BASE}/plans`).then((r) => r.json()),
  updatePlans: (plans: any[]) => req<any>("PUT", "/admin/plans", { plans }),

  // Settings
  getSettings: () => req<any>("GET", "/admin/settings"),
  updateSettings: (data: any) => req<any>("PUT", "/admin/settings", data),

  // Content
  getContent: () => req<any>("GET", "/admin/content"),
  updateContent: (data: any) => req<any>("PUT", "/admin/content", data),

  // Notifications
  getNotifications: () => req<any>("GET", "/admin/notifications"),
  sendNotification: (data: any) => req<any>("POST", "/admin/notifications", data),
  deleteNotification: (id: string) => req<any>("DELETE", `/admin/notifications/${id}`),

  // OTP Logs (persistent audit + safe MSG91 status — never returns secrets)
  getOtpLogs: (opts?: { event?: string; page?: number; limit?: number; source?: string }) => {
    const q = new URLSearchParams();
    if (opts?.event) q.set("event", opts.event);
    if (opts?.page) q.set("page", String(opts.page));
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.source) q.set("source", opts.source);
    const qs = q.toString();
    return req<any>("GET", `/admin/otp-logs${qs ? `?${qs}` : ""}`);
  },
  getOtpConfig: () => req<any>("GET", "/admin/otp-config"),

  // Account deletion requests (filtered contact_messages from delete-account page)
  getDeletionRequests: (opts?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (opts?.status && opts.status !== "all") q.set("status", opts.status);
    if (opts?.search) q.set("search", opts.search);
    if (opts?.page) q.set("page", String(opts.page));
    if (opts?.limit) q.set("limit", String(opts.limit));
    const qs = q.toString();
    return req<{ requests: any[]; total: number; pendingCount: number }>(
      "GET",
      `/admin/deletion-requests${qs ? `?${qs}` : ""}`,
    );
  },

  // Subscription management
  getAdminSubscriptions: () => req<any>("GET", "/admin/subscriptions"),
  overrideSubscription: (providerId: string, data: any) => req<any>("PUT", `/admin/subscriptions/${providerId}`, data),
  getSubscriptionAudit: (providerId?: string) => req<any>("GET", `/admin/subscription-audit${providerId ? `?providerId=${providerId}` : ""}`),

  // Repair utility — grant a free trial to a provider with no subscription
  grantTrialSubscription: (providerId: string, days = 180) =>
    req<any>("PUT", `/admin/subscriptions/${providerId}`, { action: "grant_free", days }),

  // Renewal requests
  getRenewalRequests: () => req<any>("GET", "/admin/renewal-requests"),
  approveRenewal: (id: string, data: any) => req<any>("POST", `/admin/renewal-requests/${id}/approve`, data),
  rejectRenewal: (id: string, data: any) => req<any>("POST", `/admin/renewal-requests/${id}/reject`, data),
  clarifyRenewal: (id: string, data: any) => req<any>("POST", `/admin/renewal-requests/${id}/clarify`, data),

  // Rankings
  getRankings: () => req<any>("GET", "/admin/rankings"),

  // App Reviews (platform feedback)
  getAppReviews: () => req<{ reviews: any[] }>("GET", "/admin/app-reviews"),
  updateAppReview: (id: string, data: any) => req<any>("PATCH", `/admin/app-reviews/${id}`, data),
  deleteAppReview: (id: string) => req<any>("DELETE", `/admin/app-reviews/${id}`),

  // Contact Messages (landing form inbox)
  getContactMessages: (opts?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (opts?.status && opts.status !== "all") q.set("status", opts.status);
    if (opts?.search) q.set("search", opts.search);
    if (opts?.page) q.set("page", String(opts.page));
    if (opts?.limit) q.set("limit", String(opts.limit));
    const qs = q.toString();
    return req<{ messages: any[]; total: number; unreadCount: number }>(
      "GET",
      `/admin/contact-messages${qs ? `?${qs}` : ""}`,
    );
  },
  getContactMessage: (id: string) => req<{ message: any }>("GET", `/admin/contact-messages/${id}`),
  updateContactMessage: (id: string, data: { status: string }) =>
    req<any>("PATCH", `/admin/contact-messages/${id}`, data),
  deleteContactMessage: (id: string) => req<any>("DELETE", `/admin/contact-messages/${id}`),

  // State Analytics
  getStateAnalytics: (state = "All India") =>
    req<any>("GET", `/admin/state-analytics?state=${encodeURIComponent(state)}`),

  // Real analytics (replace benchmark tabs)
  getDemandAnalytics:   () => req<any>("GET", "/admin/demand-analytics"),
  getBehaviorAnalytics: () => req<any>("GET", "/admin/behavior-analytics"),
  getTimeAnalytics:     () => req<any>("GET", "/admin/time-analytics"),
  getRevenueAnalytics:  () => req<any>("GET", "/admin/revenue-analytics"),
};
