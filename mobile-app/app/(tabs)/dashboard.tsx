import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Redirect, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Avatar } from "@/components/Avatar";
import {
  fetchProviderProfile,
  fetchProviderStats,
  fetchEarningsSummary,
  fetchConversations,
  fetchProviderActivitySummary,
  updateProviderAvailability,
  API_BASE,
} from "@/lib/db";
import { shareProviderProfile } from "@/lib/shareUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number): string {
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000)   return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

const DEFAULT_SUBSCRIPTION_REMINDER_DAYS = 10;

function isTrialPlan(plan: string): boolean {
  return plan === "trial" || plan === "free_trial";
}

/** Business status only — not billing plan names (Monthly, Quarterly, etc.). */
function getBusinessStatus(
  plan: string,
  expired: boolean,
  noSub: boolean,
  labels: { expired: string; freeTrial: string; paidSubscription: string },
): string {
  if (expired || noSub) return labels.expired;
  if (isTrialPlan(plan)) return labels.freeTrial;
  return labels.paidSubscription;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ProviderDashboard() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const qc       = useQueryClient();
  const { user, supabaseUserId } = useAuth();
  const { t } = useLanguage();
  const topPad   = Platform.OS === "web" ? 67 : insets.top;

  const [available,  setAvailable]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  if (!user?.isProvider) return <Redirect href="/(tabs)/messages" />;

  const uid = supabaseUserId ?? "";

  // ── Data queries ───────────────────────────────────────────────────────────

  const { data: profile } = useQuery({
    queryKey:  ["providerProfile", uid],
    queryFn:   () => uid ? fetchProviderProfile(uid) : Promise.resolve(null),
    enabled:   !!uid,
    staleTime: 60_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey:  ["providerStats", uid],
    queryFn:   () => uid ? fetchProviderStats(uid) : Promise.resolve(null),
    enabled:   !!uid,
    staleTime: 60_000,
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey:  ["earningsSummary", uid],
    queryFn:   () => uid ? fetchEarningsSummary(uid) : Promise.resolve(null),
    enabled:   !!uid,
    staleTime: 60_000,
  });

  const { data: conversations = [] } = useQuery({
    queryKey:  ["conversations", uid],
    queryFn:   () => uid ? fetchConversations(uid) : Promise.resolve([]),
    enabled:   !!uid,
    staleTime: 60_000,
  });

  const { data: activity } = useQuery({
    queryKey:  ["providerActivity", profile?.id],
    queryFn:   () => profile?.id
      ? fetchProviderActivitySummary(profile.id)
      : Promise.resolve({ views: 0, calls: 0, whatsapp: 0 }),
    enabled:   !!profile?.id,
    staleTime: 30_000,
  });

  const { data: subInfo, isLoading: subLoading } = useQuery({
    queryKey:  ["subscription", uid],
    queryFn:   async () => {
      if (!uid) return null;
      const res = await fetch(`${API_BASE}/subscriptions/${uid}`);
      if (!res.ok) return null;
      return (await res.json()) as {
        subscription: { providerId: string; plan: string; endDate: string } | null;
        active: boolean;
        daysLeft: number;
        expired: boolean;
      };
    },
    enabled:   !!uid,
    staleTime: 5 * 60_000,
  });

  // Sync availability toggle with DB value
  React.useEffect(() => {
    if (profile?.available !== undefined) setAvailable(profile.available);
  }, [profile?.available]);

  // Auto-refresh all data when provider returns to this screen (after completing
  // jobs, receiving reviews, etc.) — invalidate every query so the next render
  // picks up the latest numbers without requiring a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["providerProfile"] });
      qc.invalidateQueries({ queryKey: ["providerStats"] });
      qc.invalidateQueries({ queryKey: ["earningsSummary"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["providerActivity"] });
      qc.invalidateQueries({ queryKey: ["subscription"] });
    }, []),
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleAvailabilityToggle(val: boolean) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAvailable(val);
    if (uid) {
      await updateProviderAvailability(uid, val);
      qc.invalidateQueries({ queryKey: ["providerProfile"] });
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["providerProfile"] }),
      qc.invalidateQueries({ queryKey: ["providerStats"] }),
      qc.invalidateQueries({ queryKey: ["earningsSummary"] }),
      qc.invalidateQueries({ queryKey: ["conversations"] }),
      qc.invalidateQueries({ queryKey: ["providerActivity"] }),
      qc.invalidateQueries({ queryKey: ["subscription"] }),
    ]);
    setRefreshing(false);
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const noSub           = !subInfo?.subscription;
  const subExpired      = subInfo?.expired ?? false;
  const subDaysLeft     = subInfo?.daysLeft ?? 0;
  const plan            = subInfo?.subscription?.plan ?? "";
  const showAsExpired   = subExpired || noSub;
  const businessStatus  = getBusinessStatus(plan, subExpired, noSub, {
    expired: t.expired,
    freeTrial: t.freeTrial,
    paidSubscription: t.paidSubscription,
  });
  const endDateFmt      = subInfo?.subscription?.endDate
    ? new Date(subInfo.subscription.endDate).toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "—";
  const showExpiryReminder = !showAsExpired
    && subDaysLeft > 0
    && subDaysLeft <= DEFAULT_SUBSCRIPTION_REMINDER_DAYS;

  const latestReviews  = (profile?.reviews ?? []).slice(0, 3);
  const messageCount   = conversations.length;
  const pendingCount   = stats?.pendingCount  ?? 0;
  const acceptedCount  = stats?.acceptedCount ?? 0;
  const completedCount = stats?.completedCount ?? 0;
  const rating         = stats?.rating         ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ── Header (original blue gradient from ZIP) ──────────────── */}
        <LinearGradient
          colors={["#1E40AF", "#2563EB"]}
          style={[styles.header, { paddingTop: topPad + 12 }]}
        >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>{t.providerDashboard}</Text>
            <Text style={styles.subGreeting}>{user?.name ?? t.provider}</Text>
          </View>
          <TouchableOpacity
            style={styles.earningsBtn}
            onPress={() => router.push("/earnings")}
            activeOpacity={0.8}
          >
            <Ionicons name="cash-outline" size={16} color="#FFFFFF" />
            <Text style={styles.earningsBtnText}>{t.earnings}</Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Status card */}
        <View style={[
          styles.availCard,
          styles.subCard,
          styles.premiumSubCard,
        ]}>
          <Text style={styles.subPremiumTitle}>✓ {t.activeSubscription}</Text>
          {subLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" style={{ marginTop: 8 }} />
          ) : (
            <View style={styles.subFields}>
              <Text style={styles.subStatusHeadline}>{businessStatus}</Text>
              {showAsExpired ? (
                <>
                  <View style={styles.subField}>
                    <Text style={styles.subLabel}>{t.expiredOn}</Text>
                    <Text style={styles.subValue}>{endDateFmt}</Text>
                  </View>
                  <Text style={styles.subRecharge}>{t.rechargeRequired}</Text>
                </>
              ) : (
                <>
                  <View style={styles.subField}>
                    <Text style={styles.subLabel}>{t.validUntil}</Text>
                    <View style={styles.subDateRow}>
                      <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.subDateValue}>{endDateFmt}</Text>
                    </View>
                  </View>
                  <View style={styles.subDaysPill}>
                    <Text style={styles.subDaysPillText}>{t.daysRemaining.replace("{n}", String(subDaysLeft))}</Text>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {showExpiryReminder && (
          <View style={styles.subReminderCard}>
            <Text style={styles.subReminderText}>
              ⚠ {subDaysLeft === 1
                ? t.subscriptionExpireInDay.replace("{n}", String(subDaysLeft))
                : t.subscriptionExpireInDays.replace("{n}", String(subDaysLeft))}
            </Text>
            <Text style={styles.subReminderSub}>
              {t.renewNowContinue}
            </Text>
          </View>
        )}
        </LinearGradient>

        {/* ── Stats row (preserved from original ZIP) ───────────────── */}
        <View style={styles.statsRow}>
          {statsLoading ? (
            <View style={[styles.statCard, styles.statCardLoading, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          ) : (
            [
              { icon: "time-outline",     label: t.pending,   value: pendingCount,           color: "#F59E0B" },
              { icon: "checkmark-circle", label: t.active,    value: acceptedCount,           color: "#10B981" },
              { icon: "trophy-outline",   label: t.completed, value: completedCount,          color: "#6366F1" },
              { icon: "star",             label: t.ratingLabel, value: rating ? rating.toFixed(1) : "—", color: "#F59E0B" },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: s.color + "18" }]}>
                  <Ionicons name={s.icon as any} size={22} color={s.color} />
                </View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── Earnings ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.earnings}</Text>
          {earningsLoading ? (
            <View style={[styles.earningsSummaryCard, styles.earningsSummaryCardLoading]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.earningsSummaryCard}>
              <EarningCell
                label={t.total}
                value={fmt(earnings?.totalEarnings ?? 0)}
                icon="wallet-outline"
                color="#FF6B35"
                colors={colors}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <EarningCell
                label={t.thisMonth}
                value={fmt(earnings?.monthlyEarnings ?? 0)}
                icon="calendar-outline"
                color="#6366F1"
                colors={colors}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <EarningCell
                label={t.thisWeek}
                value={fmt(earnings?.weeklyEarnings ?? 0)}
                icon="trending-up-outline"
                color="#10B981"
                colors={colors}
              />
            </View>
          )}
        </View>

        {/* ── Customer Activity ─────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.customerActivity}</Text>
          <View style={[styles.earningsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityCell
              icon="chatbubble-outline"
              label={t.messages}
              value={messageCount}
              color="#3B82F6"
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ActivityCell
              icon="call-outline"
              label={t.calls}
              value={activity?.calls ?? 0}
              color="#10B981"
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ActivityCell
              icon="logo-whatsapp"
              label={t.whatsapp}
              value={activity?.whatsapp ?? 0}
              color="#22C55E"
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ActivityCell
              icon="eye-outline"
              label={t.views}
              value={activity?.views ?? 0}
              color="#8B5CF6"
              colors={colors}
            />
          </View>
        </View>

        {/* ── Latest Reviews ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.latestReviews}</Text>
            {(profile?.reviews?.length ?? 0) > 3 && (
              <TouchableOpacity
                onPress={() => router.push(`/provider/${profile?.id ?? ""}`)}
                activeOpacity={0.7}
              >
                <Text style={[styles.seeAll, { color: colors.primary }]}>{t.seeAllLower}</Text>
              </TouchableOpacity>
            )}
          </View>

          {latestReviews.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="star-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t.noReviewsYet}</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {t.completedJobsEarnRatings}
              </Text>
            </View>
          ) : (
            latestReviews.map((r) => (
              <View
                key={r.id}
                style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Avatar
                  initials={r.reviewerInitials}
                  color="#64748B"
                  imageUri={(r as any).avatarUrl ?? undefined}
                  size={40}
                  fontSize={14}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.reviewTop}>
                    <Text style={[styles.reviewName, { color: colors.foreground }]}>{r.reviewerName}</Text>
                    <View style={styles.starsRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < r.rating ? "star" : "star-outline"}
                          size={12}
                          color="#F59E0B"
                        />
                      ))}
                    </View>
                  </View>
                  {!!r.comment && (
                    <Text
                      style={[styles.reviewComment, { color: colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {r.comment}
                    </Text>
                  )}
                  <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>{r.date}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Quick Actions ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.quickActions}</Text>
          <View style={styles.actionsGrid}>
            <QuickAction
              icon="person-outline"
              label={t.editProfile}
              color="#FF6B35"
              colors={colors}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/edit-profile");
              }}
            />
            <QuickAction
              icon="diamond-outline"
              label={t.subscription}
              color="#6366F1"
              colors={colors}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/subscription");
              }}
            />
            <QuickAction
              icon="share-outline"
              label={t.shareProfile}
              color="#10B981"
              colors={colors}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (profile) {
                  await shareProviderProfile(
                    profile.id,
                    profile.name,
                    profile.category,
                    profile.location,
                    profile.rating,
                    profile.experience,
                    available,
                  );
                }
              }}
            />
            <QuickAction
              icon="cash-outline"
              label={t.earnings}
              color="#F59E0B"
              colors={colors}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/earnings");
              }}
            />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EarningCell({
  label, value, icon, color, colors,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.earningsSummaryCell}>
      <View style={[styles.earningsSummaryIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.earningsSummaryValue}>{value}</Text>
      <Text style={styles.earningsSummaryLabel}>{label}</Text>
    </View>
  );
}

function ActivityCell({
  icon, label, value, comingSoon, color, colors,
}: {
  icon: any;
  label: string;
  value?: number;
  comingSoon?: boolean;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.earningCell}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      {comingSoon ? (
        <View style={[styles.comingSoonBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.comingSoonText, { color: colors.mutedForeground }]}>{t.soon}</Text>
        </View>
      ) : (
        <Text style={[styles.earningValue, { color: colors.foreground }]}>{value ?? 0}</Text>
      )}
      <Text style={[styles.earningLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon, label, color, colors, onPress,
}: {
  icon: any;
  label: string;
  color: string;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.qaBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.qaLabel, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Header (preserved from original ZIP) ──────────────────────────────────
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  greeting: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#FFFFFF",
  },
  subGreeting: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  earningsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  earningsBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  availCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  subCard: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
  },
  premiumSubCard: {
    backgroundColor: "rgba(37,99,235,0.22)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  subPremiumTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#FFFFFF",
  },
  subFields: { gap: 12 },
  subField:  { gap: 6 },
  subStatusHeadline: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
    opacity: 0.9,
  },
  subRecharge: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FCA5A5",
    marginTop: 2,
  },
  subReminderCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  subReminderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FDE68A",
    lineHeight: 18,
  },
  subReminderSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 17,
  },
  subLabel:  { fontFamily: "Inter_500Medium", fontSize: 13, color: "rgba(255,255,255,0.75)" },
  subValue:  { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FFFFFF" },
  subDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subDateValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: "#FFFFFF",
  },
  subDaysPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  subDaysPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  availDot: { width: 10, height: 10, borderRadius: 5 },
  availTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FFFFFF" },
  availSub:   { fontFamily: "Inter_400Regular",  fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 1 },

  // ── Stats row (preserved from original ZIP) ───────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 84,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8EDF5",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    paddingVertical: 8,
    gap: 4,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statCardLoading: {
    minHeight: 84,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#0F172A", lineHeight: 28 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#64748B" },

  // ── Section layout ────────────────────────────────────────────────────────
  section:    { paddingHorizontal: 16, paddingTop: 20 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 12 },
  seeAll: { fontFamily: "Inter_500Medium", fontSize: 13 },

  // ── Shared card + cell ────────────────────────────────────────────────────
  earningsSummaryCard: {
    flexDirection: "row",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8EDF5",
    backgroundColor: "#FFFFFF",
    minHeight: 88,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    paddingVertical: 8,
  },
  earningsSummaryCardLoading: {
    justifyContent: "center",
    alignItems: "center",
  },
  earningsSummaryCell: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5 },
  earningsSummaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  earningsSummaryValue: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#0F172A", lineHeight: 28 },
  earningsSummaryLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#64748B" },
  earningsCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 18,
  },
  earningCell:  { flex: 1, alignItems: "center", gap: 6 },
  earningValue: { fontFamily: "Inter_700Bold",    fontSize: 15 },
  earningLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
  divider:      { width: 1, marginVertical: 4 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Coming soon badge ─────────────────────────────────────────────────────
  comingSoonBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  comingSoonText: { fontFamily: "Inter_500Medium", fontSize: 9 },

  // ── Reviews ───────────────────────────────────────────────────────────────
  reviewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  reviewTop:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  reviewName:   { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  starsRow:     { flexDirection: "row", gap: 2 },
  reviewComment:{ fontFamily: "Inter_400Regular",  fontSize: 12, lineHeight: 18, marginBottom: 4 },
  reviewDate:   { fontFamily: "Inter_400Regular",  fontSize: 11 },

  emptyCard:  { alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 28, gap: 8 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  emptySub:   { fontFamily: "Inter_400Regular",  fontSize: 12, textAlign: "center", lineHeight: 18 },

  // ── Quick Actions ─────────────────────────────────────────────────────────
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  qaBtn: {
    width: "47.5%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  qaLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
