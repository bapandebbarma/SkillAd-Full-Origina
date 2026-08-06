import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { registerForPushNotifications } from "@/lib/notifications";
import { API_BASE } from "@/lib/db";

// Detect Expo Go — push listeners are not supported on Android SDK 53+
const isExpoGo = Constants.appOwnership === "expo";

// Lazy-load expo-notifications — never crashes even if unsupported
let Notifications: typeof import("expo-notifications") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications");
} catch {
  Notifications = null;
}

// ── In-memory notification store ─────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: "booking" | "message" | "review" | "system" | "subscription";
  timestamp: string;
  read: boolean;
  data?: Record<string, unknown>;
}

const STORAGE_KEY = "@skilladd/notifications_v2";

let _store: AppNotification[] = [];
let _listeners = new Set<() => void>();
let _initialized = false;

function emitChange() {
  _listeners.forEach((fn) => fn());
}

function getSnapshot(): AppNotification[] {
  return _store;
}

function subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Persist current store to AsyncStorage (fire-and-forget) */
function persist(): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_store)).catch(() => {});
}

/** Load persisted notifications from AsyncStorage into the store. Call once on startup. */
export async function initNotificationStore(): Promise<void> {
  if (_initialized) return;
  _initialized = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as AppNotification[];
      if (Array.isArray(saved) && saved.length > 0) {
        // Merge: keep existing in-memory entries (from server sync) + persisted
        const existingIds = new Set(_store.map((n) => n.id));
        const toAdd = saved.filter((n) => !existingIds.has(n.id));
        _store = [..._store, ...toAdd].slice(0, 60);
        emitChange();
      }
    }
  } catch {
    // AsyncStorage unavailable — continue without persisted notifications
  }
}

export function addAppNotification(
  n: Omit<AppNotification, "id" | "timestamp" | "read">,
) {
  const newNotif: AppNotification = {
    ...n,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  // Deduplicate by title+body within 5 seconds to avoid double-add from
  // both foreground listener and syncAdminNotifications
  const fiveSec = 5000;
  const isDup = _store.some(
    (existing) =>
      existing.title === newNotif.title &&
      existing.body === newNotif.body &&
      Math.abs(new Date(existing.timestamp).getTime() - Date.now()) < fiveSec,
  );
  if (isDup) return;
  _store = [newNotif, ..._store].slice(0, 60);
  emitChange();
  persist();
}

export function markAllRead() {
  _store = _store.map((n) => ({ ...n, read: true }));
  emitChange();
  persist();
}

export function markRead(id: string) {
  _store = _store.map((n) => (n.id === id ? { ...n, read: true } : n));
  emitChange();
  persist();
}

export function dismissNotification(id: string) {
  _store = _store.filter((n) => n.id !== id);
  emitChange();
  persist();
}

export async function syncAdminNotifications(userId?: string): Promise<void> {
  try {
    const url = userId
      ? `${API_BASE}/notifications?userId=${encodeURIComponent(userId)}`
      : `${API_BASE}/notifications`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = (await res.json()) as { notifications: any[] };
    const items: any[] = data.notifications ?? [];

    // Convert server items to AppNotifications, preserving read state for
    // items already in the store so marks don't reset on each poll.
    const existingById = new Map(_store.map((n) => [n.id, n]));
    const serverNotifs: AppNotification[] = items.map((n) => {
      const existing = existingById.get(n.id as string);
      return {
        id: n.id as string,
        title: (n.title as string) ?? "SkillAd",
        body: (n.body as string) ?? "",
        type: inferType((n.type as string) ?? "system"),
        timestamp: (n.sentAt as string) ?? new Date().toISOString(),
        read: existing?.read ?? (n.read as boolean) ?? false,
        data: {
          ...(n.data ?? {}),
          audience: n.audience,
          notifType: n.type,
          source: "server",
          targetUserId: n.targetUserId,
        },
      };
    });

    // Keep push/local notifications that didn't come from the server
    const localNotifs = _store.filter(
      (n) => (n.data as any)?.source !== "server",
    );

    const merged = [...serverNotifs, ...localNotifs].slice(0, 60);

    // Only emit if something actually changed
    const changed =
      merged.length !== _store.length ||
      merged.some((n, i) => n.id !== _store[i]?.id || n.read !== _store[i]?.read);
    if (changed) {
      _store = merged;
      emitChange();
      persist();
    }
  } catch {
    // Network unavailable — skip silently
  }
}

export function useNotificationStore(): AppNotification[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// ── Setup hook (call once in root layout) ────────────────────────────────────

export function useNotifications() {
  const { user, supabaseUserId } = useAuth();
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const receivedRef = useRef<any>(null);
  const responseRef = useRef<any>(null);

  useEffect(() => {
    // Skip entirely on web, Expo Go Android (SDK 53+), or if no Notifications module
    if (!user || Platform.OS === "web") return;
    if (!Notifications) return;
    if (isExpoGo && Platform.OS === "android") return;

    // Load persisted notifications from AsyncStorage
    void initNotificationStore();

    // Register device for push and save token
    if (supabaseUserId) {
      registerForPushNotifications(supabaseUserId).then((token) => {
        if (token) setExpoPushToken(token);
      });
    }

    try {
      // Foreground notification → add to in-app store
      receivedRef.current = Notifications.addNotificationReceivedListener(
        (notification: any) => {
          const content = notification.request.content;
          const data = (content.data ?? {}) as Record<string, unknown>;
          addAppNotification({
            title: content.title ?? "SkillAd",
            body: content.body ?? "",
            type: inferType(data.type as string),
            data,
          });
        },
      );

      // Tap on a notification → navigate
      responseRef.current = Notifications.addNotificationResponseReceivedListener(
        (response: any) => {
          const data = (
            response.notification.request.content.data ?? {}
          ) as Record<string, unknown>;
          handleNotificationTap(data, router);
        },
      );
    } catch {
      // Gracefully skip if notification listeners are not supported
    }

    return () => {
      try {
        receivedRef.current?.remove();
        responseRef.current?.remove();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [user?.id, supabaseUserId]);

  return { expoPushToken };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferType(t?: string): AppNotification["type"] {
  if (t === "booking") return "booking";
  if (t === "message") return "message";
  if (t === "review") return "review";
  if (t === "subscription") return "subscription";
  return "system";
}

function handleNotificationTap(
  data: Record<string, unknown>,
  router: ReturnType<typeof useRouter>,
) {
  if (data.type === "booking") {
    if (data.source === "booking_update") {
      // Customer received an accept/decline/complete update → notifications tab
      router.push("/(tabs)/notifications");
    } else if (data.conversationId || data.senderId) {
      // Provider received a new booking request → open the exact chat
      router.push({
        pathname: "/chat/[id]",
        params: {
          id:          (data.senderId       as string) ?? "",
          convId:      (data.conversationId as string) ?? "",
          name:        (data.senderName     as string) ?? "Customer",
          initials:    (data.senderInitials as string) ?? "C",
          avatarColor: (data.avatarColor    as string) ?? "#64748B",
          category: "Customer",
        },
      });
    } else {
      // Fallback: go to messages list
      router.push("/(tabs)/messages");
    }
  } else if (data.type === "message") {
    if (data.providerId) {
      // providerId = sender's UUID (the other person in the chat)
      router.push({
        pathname: "/chat/[id]",
        params: {
          id:          data.providerId as string,
          convId:      (data.conversationId as string) ?? "",
          name:        (data.senderName     as string) ?? "User",
          initials:    (data.senderInitials as string) ?? "??",
          avatarColor: (data.avatarColor    as string) ?? "#64748B",
          category: "Provider",
        },
      });
    } else {
      router.push("/(tabs)/messages");
    }
  } else {
    router.push("/(tabs)/notifications");
  }
}
