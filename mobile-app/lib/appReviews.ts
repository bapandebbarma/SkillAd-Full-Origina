/**
 * Client helpers for SkillAd platform app reviews (not provider reviews).
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/lib/db";

export const APP_REVIEW_LAST_SUBMIT_KEY = "skillad_app_review_last_submit_at";
export const APP_REVIEW_DISMISS_KEY = "skillad_app_review_dismissed_at";
export const APP_REVIEW_FIRST_OPEN_KEY = "skillad_first_open_at";

/** Days before the soft usage prompt may appear. */
export const USAGE_PROMPT_DAYS = 7;
/** Local + server cooldown between reviews / after "Later". */
export const REVIEW_COOLDOWN_DAYS = 90;
export const REVIEW_COOLDOWN_MS = REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

const PLAY_STORE_FALLBACK =
  "https://play.google.com/store/apps/details?id=com.skillad.app";

export type AppReviewUserType = "Customer" | "Provider";

export type SubmitAppReviewInput = {
  rating: number;
  text: string;
  suggestion?: string;
  displayName: string;
  userId?: string;
  userType: AppReviewUserType;
  city?: string;
};

export type EligibilityResult = {
  eligible: boolean;
  nextEligibleAt?: string;
  message?: string;
};

export function getAppVersion(): string {
  return (
    Constants.nativeApplicationVersion ||
    Constants.expoConfig?.version ||
    "1.0.0"
  );
}

export function getDevicePlatform(): string {
  return Platform.OS;
}

export type EligibilityCheckResult = EligibilityResult & {
  /** True when the request failed, timed out, or returned a non-OK status. */
  failed?: boolean;
};

const ELIGIBILITY_TIMEOUT_MS = 8000;

export async function checkAppReviewEligibility(
  userId?: string | null,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<EligibilityCheckResult> {
  if (!userId) return { eligible: true };
  const timeoutMs = options?.timeoutMs ?? ELIGIBILITY_TIMEOUT_MS;
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) return { eligible: true, failed: true };
    options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${API_BASE}/app-reviews/eligibility?userId=${encodeURIComponent(userId)}`,
      { signal: controller.signal },
    );
    if (!res.ok) return { eligible: true, failed: true };
    const data = (await res.json()) as EligibilityResult;
    return { ...data, failed: false };
  } catch {
    // Network error, abort, or timeout — allow the form; caller may show a warning.
    return { eligible: true, failed: true };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onExternalAbort);
  }
}

export async function submitAppReview(
  input: SubmitAppReviewInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string; status?: number }> {
  try {
    const res = await fetch(`${API_BASE}/app-reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: input.rating,
        text: input.text.trim(),
        suggestion: (input.suggestion ?? "").trim(),
        displayName: input.displayName,
        userId: input.userId,
        userType: input.userType,
        city: input.city || undefined,
        appVersion: getAppVersion(),
        platform: getDevicePlatform(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || "Could not submit review",
        status: res.status,
      };
    }
    await AsyncStorage.setItem(APP_REVIEW_LAST_SUBMIT_KEY, String(Date.now()));
    return { ok: true, id: data.id || "" };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Something went wrong" };
  }
}

export async function fetchPlayStoreLink(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    const d = (await res.json()) as { playStoreLink?: string };
    const link = (d.playStoreLink || "").trim();
    return link || PLAY_STORE_FALLBACK;
  } catch {
    return PLAY_STORE_FALLBACK;
  }
}

/** Ensure first-open timestamp exists; returns days since first open. */
export async function ensureFirstOpenAndDaysUsed(): Promise<number> {
  let firstOpen = await AsyncStorage.getItem(APP_REVIEW_FIRST_OPEN_KEY);
  if (!firstOpen) {
    firstOpen = String(Date.now());
    await AsyncStorage.setItem(APP_REVIEW_FIRST_OPEN_KEY, firstOpen);
  }
  return (Date.now() - Number(firstOpen)) / (24 * 60 * 60 * 1000);
}

export async function isWithinLocalCooldown(
  key: string,
  ms: number = REVIEW_COOLDOWN_MS,
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return false;
    return Date.now() - Number(raw) < ms;
  } catch {
    return false;
  }
}

export function cityFromAddress(address?: string | null): string {
  if (!address) return "";
  const part = address.split(",")[0]?.trim() ?? "";
  return part.slice(0, 80);
}
