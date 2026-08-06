import React, { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Avatar } from "@/components/Avatar";
import { fetchProviderById, getOrCreateConversation, SubscriptionInactiveError, recordActivity } from "@/lib/db";
import { shareProvider } from "@/lib/shareUtils";

/** Fixed SkillAd brand header — same for every provider profile. */
const SKILLAD_HEADER_GRADIENT = ["#1E40AF", "#4338CA", "#0F172A"] as const;
const SKILLAD_HEADER_LOCATIONS = [0, 0.48, 1] as const;
const HERO_AVATAR_SIZE = 136;
const HERO_AVATAR_FONT = 40;
const HERO_AVATAR_RING_RADIUS = (HERO_AVATAR_SIZE + 16) / 2;

function Star({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return <Ionicons name={filled ? "star" : "star-outline"} size={size} color="#F59E0B" />;
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={20} color={colors.mutedForeground} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor ?? "#0F172A" }]}>{value}</Text>
    </View>
  );
}

export default function ProviderDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const wideHeroMeta = screenWidth >= 420;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { supabaseUserId } = useAuth();
  const { t } = useLanguage();

  const { data: provider, isLoading } = useQuery({
    queryKey: ["provider", id],
    queryFn: () => fetchProviderById(id!),
    enabled: !!id,
  });

  // Record a view event once per page load when the provider data is available.
  // The 30-minute dedup is enforced on the backend.
  useEffect(() => {
    if (!provider?.id) return;
    recordActivity(provider.id, supabaseUserId ?? null, "view", Platform.OS);
  }, [provider?.id]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>
          {t.providerNotFound}
        </Text>
      </View>
    );
  }

  async function handleShare() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await shareProvider(provider!);
  }

  async function handleCall() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    recordActivity(provider!.id, supabaseUserId ?? null, "call", Platform.OS);
    Linking.openURL(`tel:${provider!.phone}`);
  }

  async function handleWhatsApp() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const digits = (provider!.phone ?? "").replace(/\D/g, "").replace(/^91/, "").slice(-10);
    recordActivity(provider!.id, supabaseUserId ?? null, "whatsapp", Platform.OS);
    Linking.openURL(`https://wa.me/91${digits}`);
  }

  async function handleMessage() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let convId: string | undefined;
    if (supabaseUserId) {
      try {
        convId = (await getOrCreateConversation(supabaseUserId, provider!.id)) ?? undefined;
      } catch (e) {
        if (e instanceof SubscriptionInactiveError) {
          Alert.alert(
            t.providerUnavailable,
            t.providerNotAcceptingCustomers.replace("{name}", provider!.name),
            [{ text: t.ok }],
          );
          return;
        }
      }
    }
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: provider!.id,
        convId: convId ?? "",
        name: provider!.name,
        initials: provider!.initials,
        avatarColor: provider!.avatarColor,
        avatarUrl: provider!.avatarUrl ?? "",
        category: provider!.category,
      },
    });
  }

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const serviceAreaLabel = provider.serviceArea?.trim() || t.notSpecified;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + bottomPad }}
      >
        {/* Hero — fixed SkillAd brand gradient (not profile color) */}
        <LinearGradient
          colors={[...SKILLAD_HEADER_GRADIENT]}
          locations={[...SKILLAD_HEADER_LOCATIONS]}
          style={[styles.heroGrad, { paddingTop: topPad + 10 }]}
        >
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.heroIconBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroIconBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.heroCenter}>
            <View
              style={[
                styles.avatarRing,
                {
                  borderColor: provider.avatarColor,
                  backgroundColor: `${provider.avatarColor}33`,
                  borderRadius: HERO_AVATAR_RING_RADIUS,
                },
              ]}
            >
              <Avatar
                initials={provider.initials}
                color={provider.avatarColor}
                size={HERO_AVATAR_SIZE}
                fontSize={HERO_AVATAR_FONT}
                imageUri={provider.avatarUrl ?? undefined}
              />
              {provider.verified && (
                <View style={[styles.verifiedBadge, { backgroundColor: provider.avatarColor }]}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.heroName}>{provider.name}</Text>
            {provider.verified && (
              <View style={[styles.verifiedProviderRow, { borderColor: `${provider.avatarColor}66` }]}>
                <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
                <Text style={styles.verifiedProviderText}>{t.verifiedProvider}</Text>
              </View>
            )}
            {wideHeroMeta && !!provider.subcategory?.trim() ? (
              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaBlockInline}>
                  <Text style={styles.heroMetaLabel}>{t.category}</Text>
                  <Text style={styles.heroMetaValue}>{provider.category}</Text>
                </View>
                <View style={styles.heroMetaDivider} />
                <View style={styles.heroMetaBlockInline}>
                  <Text style={styles.heroMetaLabel}>{t.specialization}</Text>
                  <Text style={[styles.heroMetaValue, styles.heroMetaValueSub]}>{provider.subcategory}</Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.heroMetaBlock}>
                  <Text style={styles.heroMetaLabel}>{t.category}</Text>
                  <Text style={styles.heroMetaValue}>{provider.category}</Text>
                </View>
                {!!provider.subcategory?.trim() && (
                  <View style={styles.heroMetaBlock}>
                    <Text style={styles.heroMetaLabel}>{t.specialization}</Text>
                    <Text style={[styles.heroMetaValue, styles.heroMetaValueSub]}>{provider.subcategory}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </LinearGradient>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <View style={{ flexDirection: "row", gap: 2 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} filled={i < Math.round(provider.rating)} />
              ))}
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {provider.rating > 0 ? provider.rating.toFixed(1) : t.newProvider}
            </Text>
            <Text style={styles.statLabel}>
              {t.nReviews.replace("{n}", String(provider.reviewCount))}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Ionicons name="briefcase-outline" size={22} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {provider.experience}+
            </Text>
            <Text style={styles.statLabel}>{t.yearsExp}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Ionicons name="map-outline" size={22} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {t.nKm.replace("{n}", String(provider.serviceRadius))}
            </Text>
            <Text style={styles.statLabel}>{t.radius}</Text>
          </View>
        </View>

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: "location-outline", label: t.location, value: provider.location },
            { icon: "map-outline", label: t.serviceArea, value: serviceAreaLabel },
            ...(provider.serviceCharge
              ? [{ icon: "cash-outline", label: t.charges, value: t.amountPerVisit.replace("{amount}", provider.serviceCharge) }]
              : []),
            {
              icon: "radio-button-on-outline",
              label: t.status,
              value: provider.available ? t.availableNow : t.busy,
              valueColor: provider.available ? colors.success : colors.mutedForeground,
            },
          ].map((row) => (
            <InfoRow
              key={row.label}
              icon={row.icon}
              label={row.label}
              value={row.value}
              valueColor={row.valueColor}
              colors={colors}
            />
          ))}
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.about}</Text>
          <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>
            {provider.description}
          </Text>
        </View>

        {/* Services */}
        {provider.services.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.servicesTitle, { color: colors.foreground }]}>{t.servicesLabel}</Text>
            <View style={styles.serviceChips}>
              {provider.services.map((s) => (
                <View
                  key={s}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.reviews}</Text>
              {provider.reviewCount > 0 && (
                <View style={styles.overallRating}>
                  <View style={{ flexDirection: "row", gap: 2 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} filled={i < Math.round(provider.rating)} size={16} />
                    ))}
                  </View>
                  <Text style={[styles.overallScore, { color: colors.foreground }]}>
                    {provider.rating.toFixed(1)}
                  </Text>
                  <Text style={[styles.overallCount, { color: colors.mutedForeground }]}>
                    ({provider.reviewCount})
                  </Text>
                </View>
              )}
            </View>
          </View>

          {provider.reviews.length === 0 ? (
            <View style={[styles.noReviews, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="star-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.noReviewsTitle, { color: colors.foreground }]}>
                {t.noReviewsYet}
              </Text>
              <Text style={[styles.noReviewsSub, { color: colors.mutedForeground }]}>
                {t.reviewsComeFromCustomers}
              </Text>
            </View>
          ) : (
            provider.reviews.map((r) => (
              <View
                key={r.id}
                style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.reviewHeader}>
                  <Avatar initials={r.reviewerInitials} color="#64748B" size={48} fontSize={14} imageUri={r.avatarUrl ?? undefined} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reviewerName, { color: colors.foreground }]}>
                      {r.reviewerName}
                    </Text>
                    <View style={styles.reviewStarsRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} filled={i < r.rating} size={18} />
                      ))}
                    </View>
                  </View>
                </View>
                {!!r.comment && (
                  <Text style={styles.reviewComment}>
                    {r.comment}
                  </Text>
                )}
                <Text style={styles.reviewDate}>{r.date}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View
        style={[
          styles.stickyBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 12,
          },
        ]}
      >
        {provider.userId && supabaseUserId && provider.userId === supabaseUserId ? (
          <TouchableOpacity
            style={[styles.callBtn, { backgroundColor: colors.primary, flex: 1 }]}
            onPress={() => router.push("/register-provider?mode=edit")}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.callBtnText}>{t.editYourProfile}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.msgBtn}
              onPress={handleMessage}
              activeOpacity={0.75}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
              <Text style={[styles.msgBtnText, { color: colors.primary }]}>{t.message}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.waBtn]}
              onPress={handleWhatsApp}
              activeOpacity={0.75}
            >
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: colors.primary }]}
              onPress={handleCall}
              activeOpacity={0.75}
            >
              <Ionicons name="call" size={22} color="#FFFFFF" />
              <Text style={styles.callBtnText}>{t.call}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFoundText: { fontFamily: "Inter_400Regular", fontSize: 16 },
  heroGrad: { paddingHorizontal: 16, paddingBottom: 82 },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  heroIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroCenter: { alignItems: "center", gap: 8, paddingTop: 4 },
  avatarRing: {
    position: "relative",
    padding: 5,
    borderWidth: 3,
    marginBottom: 16,
    shadowColor: "#3B82F6",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  heroName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 28,
    color: "#FFFFFF",
    marginTop: 10,
    marginBottom: 14,
    textAlign: "center",
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  verifiedProviderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  verifiedProviderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 20,
    width: "100%",
    maxWidth: 420,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  heroMetaBlockInline: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  heroMetaDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginTop: 4,
  },
  heroMetaBlock: {
    alignItems: "center",
    marginTop: 10,
    gap: 4,
  },
  heroMetaLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "rgba(255,255,255,0.78)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroMetaValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroMetaValueSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 16,
    gap: 16,
  },
  statBlock: { alignItems: "center", justifyContent: "center", gap: 4, flex: 1 },
  statValue: { fontFamily: "Inter_600SemiBold", fontSize: 22 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#64748B", letterSpacing: 0.3 },
  statDivider: { width: 1, height: 44, backgroundColor: "rgba(232,237,245,0.82)" },
  infoCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EDF5",
    gap: 12,
  },
  infoLabel: { fontFamily: "Inter_500Medium", fontSize: 13, width: 84, color: "#64748B" },
  infoValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  section: { paddingHorizontal: 16, paddingVertical: 14 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 10 },
  servicesTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, marginBottom: 14 },
  aboutText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 },
  serviceChips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, columnGap: 8 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", minHeight: 32, justifyContent: "center" },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#1D4ED8", textAlign: "center" },
  reviewsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  overallRating: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  overallScore: { fontFamily: "Inter_700Bold", fontSize: 15 },
  overallCount: { fontFamily: "Inter_400Regular", fontSize: 13 },
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 2,
  },
  writeReviewText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  noReviews: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 28,
    gap: 8,
  },
  noReviewsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  noReviewsSub: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
  firstReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 8,
  },
  firstReviewBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FFFFFF" },
  reviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewStarsRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  reviewerName: { fontFamily: "Inter_600SemiBold", fontSize: 16, marginBottom: 4 },
  reviewDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#94A3B8", alignSelf: "flex-end", marginTop: 2 },
  reviewComment: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22, color: "#334155" },
  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  msgBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#2563EB",
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 18,
    gap: 10,
    shadowColor: "#2563EB",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  msgBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  waBtn: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#25D366",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 16,
    gap: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  callBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#FFFFFF" },
});
