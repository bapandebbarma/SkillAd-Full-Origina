import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Detect Expo Go — push notifications are not supported there on Android SDK 53+
const isExpoGo = Constants.appOwnership === "expo";

// Lazy-load expo-notifications so the import itself never crashes
let Notifications: typeof import("expo-notifications") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications");
} catch {
  Notifications = null;
}

// Set foreground display behaviour — only when supported
if (Notifications && !isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Not supported in this environment
  }
}

// ── Register & get Expo push token ───────────────────────────────────────────

export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  console.log("[push] registerForPushNotifications start — userId=" + userId
    + " OS=" + Platform.OS + " isExpoGo=" + isExpoGo
    + " isDevice=" + Device.isDevice);

  if (Platform.OS === "web") {
    console.log("[push] EXIT: web platform — push not supported");
    return null;
  }
  if (!Notifications) {
    console.log("[push] EXIT: expo-notifications module failed to load");
    return null;
  }
  if (isExpoGo && Platform.OS === "android") {
    console.log("[push] EXIT: Expo Go + Android — SDK 53+ dropped push support. Need standalone APK.");
    return null;
  }
  if (!Device.isDevice) {
    console.log("[push] EXIT: not a real device (simulator/emulator) — push tokens unavailable");
    return null;
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    console.log("[push] permission status (existing)=" + existing);

    let finalStatus = existing;
    if (existing !== "granted") {
      console.log("[push] requesting permission from user...");
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log("[push] permission status (after request)=" + finalStatus);
    }

    if (finalStatus !== "granted") {
      console.log("[push] EXIT: permission denied — finalStatus=" + finalStatus);
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "SkillAd",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
        sound: "default",
      });
      console.log("[push] Android notification channel 'default' configured");
    }

    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    console.log("[push] EXPO_PUBLIC_PROJECT_ID=" + (projectId ?? "(not set)"));

    const tokenOptions: Parameters<typeof Notifications.getExpoPushTokenAsync>[0] = {};
    if (projectId) tokenOptions.projectId = projectId;

    console.log("[push] calling getExpoPushTokenAsync with options=" + JSON.stringify(tokenOptions));
    const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);
    const token = tokenData.data;
    console.log("[push] token generated: " + token.slice(0, 30) + "...(length=" + token.length + ")");

    await savePushToken(userId, token);
    return token;
  } catch (err: any) {
    console.log("[push] ERROR in registerForPushNotifications: " + (err?.message ?? String(err)));
    return null;
  }
}

// ── Save / fetch push tokens ──────────────────────────────────────────────────

export async function savePushToken(userId: string, token: string): Promise<void> {
  console.log("[push] savePushToken — userId=" + userId + " token=" + token.slice(0, 30) + "...");
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ push_token: token })
      .eq("id", userId);
    if (error) {
      console.log("[push] savePushToken Supabase ERROR: " + error.message + " | code=" + error.code);
    } else {
      console.log("[push] savePushToken SUCCESS — profiles.push_token updated for userId=" + userId);
    }
  } catch (err: any) {
    console.log("[push] savePushToken EXCEPTION: " + (err?.message ?? String(err)));
  }
}

export async function fetchUserIdByProviderId(
  providerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("providers")
    .select("user_id")
    .eq("id", providerId)
    .single();
  return data?.user_id ?? null;
}

export async function fetchPushTokenForProvider(
  providerId: string,
): Promise<string | null> {
  const userId = await fetchUserIdByProviderId(providerId);
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("push_token")
    .eq("id", userId)
    .single();
  return data?.push_token ?? null;
}

// Direct profile-based lookup — used when the other party is a customer (not a provider record).
// Queries profiles.push_token directly by Supabase auth UUID.
export async function fetchPushTokenByUserId(
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("push_token")
    .eq("id", userId)
    .maybeSingle();
  return (data?.push_token as string | null) ?? null;
}

// ── Send via Expo Push API ────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPush(
  token: string,
  payload: PushPayload,
): Promise<void> {
  if (!token.startsWith("ExponentPushToken")) {
    console.log("[push] sendExpoPush SKIP — token does not start with 'ExponentPushToken': " + String(token).slice(0, 20));
    return;
  }
  console.log("[push] sendExpoPush → token=" + token.slice(0, 30) + "... title=" + JSON.stringify(payload.title));
  try {
    const requestBody = {
      to: token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      priority: "high",
      channelId: "default",
    };
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const responseText = await res.text();
    console.log("[push] sendExpoPush response — status=" + res.status + " body=" + responseText.slice(0, 200));
  } catch (err: any) {
    console.log("[push] sendExpoPush EXCEPTION: " + (err?.message ?? String(err)));
  }
}

// ── Local (in-app) notification ───────────────────────────────────────────────

export async function scheduleLocalNotification(
  payload: PushPayload,
): Promise<void> {
  if (Platform.OS === "web") return null as any;
  if (!Notifications) return;
  if (isExpoGo && Platform.OS === "android") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: true,
      },
      trigger: null,
    });
  } catch {
    // Ignore in environments where scheduling is unavailable
  }
}
