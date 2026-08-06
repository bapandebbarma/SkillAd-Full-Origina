import { createClient } from "@supabase/supabase-js";

// EXPO_PUBLIC_SUPABASE_URL may be set with a path suffix like /rest/v1/.
// The Supabase SDK needs only the base origin (protocol + host) to construct
// all service URLs correctly (/rest/v1, /auth/v1, /storage/v1).
function extractBaseUrl(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw.replace(/\/rest\/v1.*$/, "").replace(/\/auth\/v1.*$/, "").replace(/\/$/, "");
  }
}

const url = extractBaseUrl(process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "");

// Prefer service-role key (bypasses RLS for server-side admin reads).
// Falls back to anon key if service-role key is not set.
const key =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
  process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ??
  "";

export const supabase =
  url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
