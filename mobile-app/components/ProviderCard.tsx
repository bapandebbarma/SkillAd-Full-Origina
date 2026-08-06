import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import { Avatar } from "./Avatar";
import { openPhoneDialer } from "@/lib/phone";
import type { Provider } from "@/lib/types";

interface ProviderCardProps {
  provider: Provider;
  onPress: () => void;
  onMessage: () => void;
  isOwnCard?: boolean;
}

function StarRatingStandalone({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  const colors = useColors();
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.floor(rating) ? "star" : i - 0.5 <= rating ? "star-half" : "star-outline"}
          size={12}
          color="#F59E0B"
          style={{ marginRight: 1 }}
        />
      ))}
      <Text style={[styles.ratingText, { color: colors.foreground }]}>
        {rating.toFixed(1)}
      </Text>
      <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>
        ({reviewCount})
      </Text>
    </View>
  );
}

// Need provider in scope for StarRating
export function ProviderCard({ provider, onPress, onMessage, isOwnCard }: ProviderCardProps) {
  const colors = useColors();
  const { t } = useLanguage();

  async function handleCall() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await openPhoneDialer(provider.phone);
  }

  async function handleMessage() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMessage();
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: "#FFFFFF", borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          <Avatar initials={provider.initials} color={provider.avatarColor} size={62} fontSize={20} imageUri={provider.avatarUrl ?? undefined} />
          <View
            style={[
              styles.availableDot,
              { backgroundColor: provider.available ? colors.success : colors.mutedForeground },
            ]}
          />
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {provider.name}
            </Text>
            {provider.verified && (
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={styles.verifiedIcon} />
            )}
            {isOwnCard && (
              <View style={[styles.youBadge, { backgroundColor: colors.primary + "22" }]}>
                <Text style={[styles.youBadgeText, { color: colors.primary }]}>{t.you}</Text>
              </View>
            )}
          </View>

          <View style={styles.categoryBadge}>
            <Text style={[styles.categoryText, { color: "#475569" }]}>{provider.category}</Text>
          </View>

          <StarRatingStandalone rating={provider.rating} reviewCount={provider.reviewCount} />

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {t.kmAway.replace("{n}", String(provider.distance))}
            </Text>
            <View style={[styles.dot, { backgroundColor: colors.border }]} />
            <Text style={[styles.metaText, { color: provider.available ? colors.success : colors.mutedForeground }]}>
              {provider.available ? t.availableNow : t.busy}
            </Text>
          </View>
        </View>

        {isOwnCard ? (
          <View style={styles.actions}>
            <Ionicons name="person-circle-outline" size={28} color={colors.mutedForeground} />
          </View>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.callBtn, { backgroundColor: colors.primary }]}
              onPress={handleCall}
            >
              <Ionicons name="call" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.secondary, marginTop: 8 }]}
              onPress={handleMessage}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    position: "relative",
    marginRight: 14,
  },
  availableDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF4EF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  stars: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
    marginBottom: 1,
  },
  ratingText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginLeft: 3,
  },
  reviewText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginLeft: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  youBadge: {
    marginLeft: 6,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
  actions: {
    marginLeft: 10,
    alignItems: "center",
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  callBtn: {
    width: 42,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 10,
    shadowColor: "#2563EB",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
