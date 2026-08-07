import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { saveUser, getUser, clearAllLocalData } from "@/lib/storage";
import { API_BASE } from "@/lib/db";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  supabaseUserId: string | null;
  loading: boolean;
  signIn: (phone: string, name: string, isProvider?: boolean) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, token: string, isProvider?: boolean) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updateAvatarUrl: (url: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── fetchProfileFromApi ────────────────────────────────────────────────────
  // Hits /api/auth/profile/:userId to get fresh name, avatarUrl, isProvider from DB.
  // Used on startup (no-session) and on screen focus to overwrite stale AsyncStorage.
  async function fetchProfileFromApi(userId: string): Promise<{ name?: string; avatarUrl?: string | null; isProvider?: boolean } | null> {
    if (!userId || !UUID_RE.test(userId)) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/profile/${userId}`);
      if (!res.ok) return null;
      const data = await res.json() as { found: boolean; name?: string; avatarUrl?: string | null; isProvider?: boolean };
      if (!data.found) return null;
      console.log("[auth:api-profile] DB →", { userId: userId.slice(0, 8), isProvider: data.isProvider, avatarUrl: data.avatarUrl?.slice(0, 40) });
      return { name: data.name, avatarUrl: data.avatarUrl, isProvider: data.isProvider };
    } catch {
      return null;
    }
  }

  useEffect(() => {
    // ── AUDIT LOGGING: call these from Metro / Flipper / adb logcat ──────────
    // Filter by tag "[auth:" to see the full startup chain.
    // Remove these console.log lines once the offline-mode bug is confirmed fixed.

    async function initAuth() {
      console.log("[auth:startup] BEGIN — loading=true supabaseUserId=null");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log(
          "[auth:startup] getSession() done —",
          "session.user.id=" + (session?.user?.id ?? "null"),
          "loading=true",
        );

        if (session?.user) {
          // Load locally-saved user first so we can validate the session below.
          const local = await getUser();
          console.log("[auth:startup] SESSION PATH — local.id=" + (local?.id ?? "null") + " local.isProvider=" + (local?.isProvider ?? "null"));

          // ── Stale session guard ──────────────────────────────────────────────
          // Session email format: "<10-digit-phone>@users.skillad.in"
          // Local phone format:   "+91XXXXXXXXXX" or "XXXXXXXXXX"
          const sessionDigits = session.user.email?.split("@")[0] ?? "";
          const localDigits   = (local?.phone ?? "").replace(/\D/g, "").slice(-10);
          if (sessionDigits && localDigits && sessionDigits !== localDigits) {
            console.warn(
              "[auth:startup] stale session detected — phone mismatch, signing out stale session",
              { sessionTail: `…${sessionDigits.slice(-4)}`, localTail: `…${localDigits.slice(-4)}` },
            );
            try { await supabase.auth.signOut(); } catch {}
            // onAuthStateChange SIGNED_OUT will fire → clearAllLocalData() + setUser(null)
            return;
          }
          // ── End stale session guard ──────────────────────────────────────────

          setSupabaseUserId(session.user.id);
          console.log("[auth:startup] setSupabaseUserId →", session.user.id.slice(0, 8));
          if (local) setUser(local);

          // Read fresh profile from Supabase (includes is_provider once migration is run)
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          if (profile) {
            const dbIsProvider = (profile as any).is_provider;
            const dbAvatarUrl = (profile as any).avatar_url ?? null;
            console.log("[auth:startup] supabase profile → is_provider=" + dbIsProvider + " avatar_url=" + (dbAvatarUrl?.slice(0, 40) ?? "null"));
            const u: User = {
              id: profile.id,
              name: profile.name,
              phone: profile.phone,
              isProvider: dbIsProvider !== undefined && dbIsProvider !== null
                ? Boolean(dbIsProvider)
                : (local?.isProvider ?? false),
              avatarUrl: dbAvatarUrl,
              providerId: local?.providerId,
            };
            console.log("[auth:startup] final isProvider=" + u.isProvider + " avatarUrl=" + (u.avatarUrl?.slice(0, 40) ?? "null"));
            setUser(u);
            await saveUser(u);
          } else {
            // Supabase profile fetch failed — fall back to API endpoint as secondary source
            console.warn("[auth:startup] supabase profile query returned null — trying API fallback");
            const apiProfile = await fetchProfileFromApi(session.user.id);
            if (apiProfile) {
              const u: User = {
                ...(local ?? { id: session.user.id, phone: "", name: "" }),
                avatarUrl: apiProfile.avatarUrl ?? null,
                isProvider: apiProfile.isProvider ?? local?.isProvider ?? false,
              };
              console.log("[auth:startup] api fallback isProvider=" + u.isProvider);
              setUser(u);
              await saveUser(u);
            }
          }
        } else {
          // No Supabase session — restore from AsyncStorage
          const local = await getUser();
          console.log(
            "[auth:startup] NO-SESSION PATH — local.id=" + (local?.id ?? "null") +
            " local.isProvider=" + (local?.isProvider ?? "null") +
            " local.phone=" + (local?.phone ?? "null"),
          );

          // Guard: reject the signIn() placeholder (id: "") — it is not a completed login.
          if (local && local.id) {
            setUser(local);

            const isDemoId = local.id?.startsWith("demo-");
            console.log("[auth:startup] isDemoId=" + isDemoId + " UUID_RE.test=" + UUID_RE.test(local.id ?? ""));

            if (!isDemoId) {
              let resolvedId: string | null = null;

              if (local.id && UUID_RE.test(local.id)) {
                resolvedId = local.id;
                setSupabaseUserId(local.id);
                console.log("[auth:startup] setSupabaseUserId (UUID from AsyncStorage) →", local.id.slice(0, 8));
              } else if (local.phone) {
                console.log("[auth:startup] id not UUID — resolving via phone:", local.phone.slice(-4));
                try {
                  const r = await fetch(
                    `${API_BASE}/auth/resolve/${encodeURIComponent(local.phone)}`,
                  );
                  console.log("[auth:startup] resolve response HTTP", r.status);
                  if (r.ok) {
                    const d = (await r.json()) as { userId?: string | null };
                    if (d.userId && UUID_RE.test(d.userId)) {
                      resolvedId = d.userId;
                      setSupabaseUserId(d.userId);
                      console.log("[auth:startup] setSupabaseUserId (resolved) →", d.userId.slice(0, 8));
                      const upgraded: User = { ...local, id: d.userId };
                      await saveUser(upgraded);
                      setUser(upgraded);
                    } else if (local.id) {
                      setSupabaseUserId(local.id);
                      console.log("[auth:startup] setSupabaseUserId (fallback local.id) →", local.id.slice(0, 8));
                    }
                  } else if (local.id) {
                    setSupabaseUserId(local.id);
                    console.log("[auth:startup] setSupabaseUserId (resolve HTTP error, fallback) →", local.id.slice(0, 8));
                  }
                } catch (resolveErr) {
                  console.warn("[auth:startup] resolve fetch threw:", resolveErr);
                  if (local.id) {
                    setSupabaseUserId(local.id);
                    console.log("[auth:startup] setSupabaseUserId (resolve exception, fallback) →", local.id.slice(0, 8));
                  }
                }
              } else {
                console.warn("[auth:startup] local.id is not UUID and no phone — supabaseUserId will stay null");
              }

              // After resolving UUID, fetch fresh profile from API to overwrite stale AsyncStorage.
              if (resolvedId) {
                const apiProfile = await fetchProfileFromApi(resolvedId);
                if (apiProfile) {
                  const refreshed: User = {
                    ...(local),
                    id: resolvedId,
                    name: apiProfile.name ?? local.name,
                    avatarUrl: apiProfile.avatarUrl ?? null,
                    isProvider: apiProfile.isProvider ?? false,
                    providerId: local.providerId,
                  };
                  console.log("[auth:startup] no-session DB refresh isProvider=" + refreshed.isProvider);
                  await saveUser(refreshed);
                  setUser(refreshed);
                }
              }
            }
          } else {
            console.warn("[auth:startup] no local user in AsyncStorage — user must log in");
          }
        }
      } catch (err) {
        // ── SAFETY NET ──────────────────────────────────────────────────────────
        // If getSession() or any await inside the try block throws unexpectedly,
        // this catch guarantees we still attempt AsyncStorage recovery and that
        // setLoading(false) runs in the finally block below.
        // Without this, supabaseUserId stays null permanently and the app shows
        // "Offline mode" / "No messages yet" for the session's lifetime.
        console.error("[auth:startup] EXCEPTION in startup chain — attempting AsyncStorage recovery:", err);
        try {
          const local = await getUser();
          console.warn("[auth:startup] recovery — local.id=" + (local?.id ?? "null"));
          if (local?.id) {
            setUser(local);
            if (UUID_RE.test(local.id)) {
              setSupabaseUserId(local.id);
              console.warn("[auth:startup] recovery: setSupabaseUserId from AsyncStorage →", local.id.slice(0, 8));
            }
          }
        } catch (recoveryErr) {
          console.error("[auth:startup] recovery also failed:", recoveryErr);
        }
      } finally {
        // Guaranteed to run regardless of success, exception, or early return above.
        console.log("[auth:startup] COMPLETE → setLoading(false)");
        setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && event !== "SIGNED_OUT") {
        setSupabaseUserId(session.user.id);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setSupabaseUserId(null);
        await clearAllLocalData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── signIn: request OTP via API server (MSG91) ───────────────────────────
  async function signIn(phone: string, name: string, isProvider = false): Promise<{ error?: string }> {
    // Clear both the in-memory user AND the supabaseUserId before starting a new
    // OTP flow. Without setUser(null) here, if a previous session was still live
    // in React state the NavigationGuard would see (user && inAuthGroup) on the
    // OTP screen and immediately redirect back to Home — bypassing OTP entirely.
    setUser(null);
    setSupabaseUserId(null);
    const url = `${API_BASE}/auth/send-otp`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      let data: { success?: boolean; error?: string } = {};
      try {
        data = (await res.json()) as { success?: boolean; error?: string };
      } catch {
        return { error: `Server error (HTTP ${res.status}). Please try again.` };
      }
      if (!res.ok || !data.success) {
        return { error: data.error ?? `Request failed (HTTP ${res.status}). Please try again.` };
      }
      // Persist the selected role in the placeholder so the correct tab layout is
      // visible immediately if the user backgrounds the app after OTP is sent.
      await saveUser({ id: "", name: name.trim() || "User", phone, isProvider, avatarUrl: null });
      return {};
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { error: `Cannot reach server (${url}): ${msg}` };
    }
  }

  // ── verifyOtp: verify via custom API, then establish Supabase session ─────
  async function verifyOtp(
    phone: string,
    token: string,
    isProvider = false,
  ): Promise<{ error?: string }> {
    const pending = await getUser();
    const name = pending?.name ?? "User";

    const url = `${API_BASE}/auth/verify-otp`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: token, name, isProvider }),
      });
      let data: {
        success?: boolean; error?: string; userId?: string;
        tokenHash?: string | null; name?: string; phone?: string;
        isProvider?: boolean; avatarUrl?: string | null; demo?: boolean;
        providerId?: string | null;
      } = {};
      try {
        data = await res.json() as typeof data;
      } catch {
        return { error: `Server error (HTTP ${res.status}). Please try again.` };
      }

      if (!res.ok || !data.success) {
        return { error: data.error ?? `Verification failed (HTTP ${res.status}). Please try again.` };
      }

      // Server returns is_provider from DB (authoritative). data.isProvider is the DB value.
      console.log("[auth:verifyOtp] server returned isProvider=" + data.isProvider + " avatarUrl=" + (data.avatarUrl?.slice(0, 40) ?? "null"));
      const u: User = {
        id: data.userId ?? `demo-${Date.now()}`,
        name: data.name ?? name,
        phone: data.phone ?? phone,
        isProvider: data.isProvider ?? isProvider,
        avatarUrl: data.avatarUrl ?? null,
        providerId: data.providerId ?? undefined,
      };

      if (data.tokenHash && !data.demo) {
        try {
          const { data: sessionData, error: sessionErr } = await supabase.auth.verifyOtp({
            token_hash: data.tokenHash,
            type: "magiclink",
          });
          if (!sessionErr && sessionData?.user) {
            setSupabaseUserId(sessionData.user.id);
            u.id = sessionData.user.id;
          } else {
            if (data.userId) {
              setSupabaseUserId(data.userId);
              u.id = data.userId;
            }
          }
        } catch {
          if (data.userId) {
            setSupabaseUserId(data.userId);
            u.id = data.userId;
          }
        }
      } else if (data.userId && !data.demo) {
        setSupabaseUserId(data.userId);
      }

      await saveUser(u);
      setUser(u);
      return {};
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { error: `Cannot reach server (${url}): ${msg}` };
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // no-op — demo users have no real Supabase session
    }
    // Use clearAllLocalData (not just clearUser) so the next user on this device
    // does not see stale conversation/provider caches from the previous session.
    await clearAllLocalData();
    setUser(null);
    setSupabaseUserId(null);
  }

  async function updateProfile(updates: Partial<User>) {
    if (!user) return;

    // Client may only promote to provider (register-provider). Never write
    // is_provider=false to Supabase — that demoted registered providers.
    const promoteToProvider = updates.isProvider === true;
    const { isProvider: _ignoredRole, ...rest } = updates;
    const updated: User = {
      ...user,
      ...rest,
      isProvider: promoteToProvider || user.isProvider === true,
    };

    await saveUser(updated);
    setUser(updated);
    if (supabaseUserId) {
      const profileFields: Record<string, unknown> = { name: updated.name };
      if (promoteToProvider) {
        profileFields["is_provider"] = true;
      }
      await supabase
        .from("profiles")
        .update(profileFields)
        .eq("id", supabaseUserId);
    }
  }

  async function updateAvatarUrl(url: string) {
    if (!user) return;
    const updated = { ...user, avatarUrl: url };
    await saveUser(updated);
    setUser(updated);
   if (supabaseUserId) {
  console.log("[avatar] Updating profile", {
    supabaseUserId,
    url,
  });

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", supabaseUserId)
    .select();

  console.log("[avatar] Update result", {
    data,
    error,
  });
}
    console.log("[auth:updateAvatarUrl] saved to AsyncStorage + Supabase →", url.slice(0, 60));
  }

  // ── refreshUserProfile ─────────────────────────────────────────────────────
  // Fetches the latest profile (name, avatarUrl, isProvider) from the API server
  // which reads from Supabase. Call on screen focus or after login to ensure
  // stale AsyncStorage values are overwritten with the DB truth.
  async function refreshUserProfile() {
    const uid = supabaseUserId ?? user?.id;
    if (!uid || !UUID_RE.test(uid)) return;
    const apiProfile = await fetchProfileFromApi(uid);
    if (!apiProfile) return;
    const updated: User = {
      ...(user ?? { id: uid, phone: "", name: apiProfile.name ?? "" }),
      name: apiProfile.name ?? user?.name ?? "",
      avatarUrl: apiProfile.avatarUrl ?? null,
      isProvider: apiProfile.isProvider ?? false,
      providerId: user?.providerId,
    };
    console.log("[auth:refreshUserProfile] updated →", { isProvider: updated.isProvider, avatarUrl: updated.avatarUrl?.slice(0, 40) ?? "null" });
    await saveUser(updated);
    setUser(updated);
  }

  return (
    <AuthContext.Provider
      value={{ user, supabaseUserId, loading, signIn, verifyOtp, signOut, updateProfile, updateAvatarUrl, refreshUserProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
