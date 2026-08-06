import { Share, Platform } from "react-native";
import type { Provider } from "./types";

const BASE_URL = "https://skillad.in/provider";

export function buildProviderShareLink(providerId: string): string {
  return `${BASE_URL}/${providerId}`;
}

export function buildShareMessage(provider: Provider): string {
  const stars = provider.rating > 0 ? `⭐ ${provider.rating.toFixed(1)} rated · ` : "";
  const experience = `${provider.experience}+ yrs exp`;
  const availability = provider.available ? "✅ Available Now" : "";
  const link = buildProviderShareLink(provider.id);

  const lines = [
    `🔧 ${provider.name} — ${provider.category}`,
    `📍 ${provider.location}`,
    `${stars}${experience}`,
    ...(availability ? [availability] : []),
    ``,
    `Book instantly on SkillAd 👇`,
    link,
  ];

  return lines.join("\n");
}

export async function shareProvider(provider: Provider): Promise<void> {
  const message = buildShareMessage(provider);
  const link = buildProviderShareLink(provider.id);

  try {
    if (Platform.OS === "ios") {
      await Share.share({ message, url: link });
    } else {
      await Share.share({ message: `${message}` });
    }
  } catch {
    // User cancelled or error — silently ignore
  }
}

export async function shareProviderProfile(
  providerId: string,
  name: string,
  category: string,
  location: string,
  rating: number,
  experience: number,
  available: boolean,
): Promise<void> {
  const stars = rating > 0 ? `⭐ ${rating.toFixed(1)} rated · ` : "";
  const exp = `${experience}+ yrs exp`;
  const avail = available ? "\n✅ Available Now" : "";
  const link = buildProviderShareLink(providerId);

  const message = [
    `🔧 ${name} — ${category}`,
    `📍 ${location}`,
    `${stars}${exp}${avail}`,
    ``,
    `Book instantly on SkillAd 👇`,
    link,
  ].join("\n");

  try {
    if (Platform.OS === "ios") {
      await Share.share({ message, url: link });
    } else {
      await Share.share({ message });
    }
  } catch {
    // User cancelled — silently ignore
  }
}
