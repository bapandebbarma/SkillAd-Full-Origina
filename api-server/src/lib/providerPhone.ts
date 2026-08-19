/**
 * Resolve a provider's 10-digit Indian mobile for transactional SMS.
 * Uses existing JSON stores + Supabase profiles — no new data models.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getProviderPhoneDigits } from "./publicProvider.js";
import { supabase } from "./supabase.js";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

function readJson<T>(name: string, fallback: T): T {
  try {
    const f = resolve(DATA_DIR, `${name}.json`);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8")) as T;
  } catch {
    /* fall through */
  }
  return fallback;
}

function normalizePhone(raw: string): string {
  return (raw ?? "").toString().replace(/\D/g, "").replace(/^91/, "").slice(-10);
}

function digitsFromProviderRecord(p: unknown): string | null {
  return getProviderPhoneDigits(p);
}

/**
 * Returns 10-digit mobile or null if unavailable.
 */
export async function resolveProviderPhone(
  userId: string,
  providerId: string,
): Promise<string | null> {
  const providers = readJson<any[]>("providers", []);
  const provider =
    providers.find((p) => p.id === providerId) ??
    providers.find((p) => p.userId === userId || p.id === userId);

  const fromProvider = provider ? digitsFromProviderRecord(provider) : null;
  if (fromProvider) return fromProvider;

  const users = readJson<any[]>("users", []);
  const user = users.find((u) => u.id === userId);
  if (user?.phone) {
    const d = normalizePhone(String(user.phone));
    if (d.length === 10) return d;
  }

  if (supabase && userId) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", userId)
        .maybeSingle();
      if (data?.phone) {
        const d = normalizePhone(String(data.phone));
        if (d.length === 10) return d;
      }
    } catch (e) {
      logger.warn(
        {
          kind: "provider_phone_lookup",
          userId,
          providerId,
          message: e instanceof Error ? e.message : String(e),
        },
        "Supabase profile phone lookup failed (non-fatal)",
      );
    }
  }

  return null;
}

/** Format for MSG91 Flow API: 91 + 10 digits. */
export function toMsg91Mobile(digits10: string): string {
  return `91${digits10}`;
}
