import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// EXPO_PUBLIC_SUPABASE_URL may be set with a path suffix like /rest/v1/.
// The Supabase SDK needs only the base origin (protocol + host).
function extractBaseUrl(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw.replace(/\/rest\/v1.*$/, "").replace(/\/auth\/v1.*$/, "").replace(/\/$/, "");
  }
}

const supabaseUrl = extractBaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "");
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// If Supabase env vars are not set the app still works in demo/offline mode.
// All db.ts functions fall back to mock data when Supabase calls fail.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      storage: Platform.OS === "web" ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
