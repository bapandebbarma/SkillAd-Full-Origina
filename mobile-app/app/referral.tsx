import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { API_BASE } from "@/lib/db";

const FALLBACK_URL = "https://skillad.in";

export default function InviteScreen() {
  const colors = useColors();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [appUrl, setAppUrl] = useState(FALLBACK_URL);

  const HOW_IT_WORKS = [
    {
      step: "1",
      icon: "share-social-outline",
      title: t.shareTheApp,
      desc: t.shareAppDesc,
    },
    {
      step: "2",
      icon: "person-add-outline",
      title: t.friendSignsUp,
      desc: t.friendSignsUpDesc,
    },
    {
      step: "3",
      icon: "checkmark-circle-outline",
      title: t.theyreAllSet,
      desc: t.theyreAllSetDesc,
    },
  ];

  const PERKS = [
    { icon: "people-outline",           label: t.growCommunity,  color: "#8B5CF6" },
    { icon: "shield-checkmark-outline", label: t.trustedPlatform, color: "#10B981" },
    { icon: "flash-outline",            label: t.easyToShare,     color: "#F59E0B" },
    { icon: "infinite-outline",         label: t.noInviteLimit,   color: "#3B82F6" },
  ];

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then((r) => r.json())
      .then((d: any) => {
        const link = d.playStoreLink || d.appStoreLink || d.websiteUrl || "";
        if (link) setAppUrl(link);
      })
      .catch(() => {});
  }, []);

  async function handleShare() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const message = [
      t.shareMessageLine1,
      ``,
      t.shareMessageLine2,
      ``,
      t.downloadSkillAdNow,
      appUrl,
    ].join("\n");

    try {
      if (Platform.OS === "ios") {
        await Share.share({ message, url: appUrl });
      } else {
        await Share.share({ message });
      }
    } catch {}
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      >
        {/* Hero */}
        <LinearGradient
          colors={["#1E40AF", "#2563EB", "#1D4ED8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: topPad + 8 }]}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.heroCenter}>
            <View style={styles.iconCircle}>
              <Ionicons name="people" size={44} color="#FFFFFF" />
            </View>
            <Text style={styles.heroTitle}>{t.inviteFriends}</Text>
            <Text style={styles.heroSub}>
              {t.inviteHeroSub}
            </Text>
          </View>
        </LinearGradient>

        {/* Share Button */}
        <View style={styles.shareSection}>
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.primary }]}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            <Ionicons name="share-social" size={22} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>{t.sendInvite}</Text>
          </TouchableOpacity>
          <Text style={[styles.shareHint, { color: colors.mutedForeground }]}>
            {t.opensShareApps}
          </Text>
        </View>

        {/* How it Works */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t.howItWorks}
          </Text>
          <View style={styles.stepsCol}>
            {HOW_IT_WORKS.map((item, idx) => (
              <View key={item.step} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepDotNum}>{item.step}</Text>
                  </View>
                  {idx < HOW_IT_WORKS.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: colors.primary + "30" }]} />
                  )}
                </View>
                <View
                  style={[
                    styles.stepCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.stepIconWrap, { backgroundColor: colors.secondary }]}>
                    <Ionicons name={item.icon as any} size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
                      {item.desc}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Why Share */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t.whyShareSkillAd}
          </Text>
          <View style={styles.perksGrid}>
            {PERKS.map((p) => (
              <View
                key={p.label}
                style={[
                  styles.perkCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={[styles.perkIcon, { backgroundColor: p.color + "18" }]}>
                  <Ionicons name={p.icon as any} size={20} color={p.color} />
                </View>
                <Text style={[styles.perkLabel, { color: colors.foreground }]} numberOfLines={2}>
                  {p.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
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
        <TouchableOpacity
          style={[styles.stickyBtn, { backgroundColor: colors.primary }]}
          onPress={handleShare}
          activeOpacity={0.85}
        >
          <Ionicons name="people-outline" size={20} color="#FFFFFF" />
          <Text style={styles.stickyBtnText}>{t.inviteFriendsToSkillAd}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  heroCenter: { alignItems: "center" },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: "#FFFFFF",
    marginBottom: 10,
  },
  heroSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 22,
  },

  shareSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    alignItems: "center",
    gap: 10,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 54,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  shareBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#FFFFFF",
  },
  shareHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },

  section: { paddingHorizontal: 16, paddingTop: 28 },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 16,
  },

  stepsCol: { gap: 0 },
  stepRow: { flexDirection: "row", gap: 14 },
  stepLeft: { alignItems: "center", width: 32 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  stepLine: { width: 2, flex: 1, marginTop: 4, marginBottom: 4, minHeight: 20 },
  stepCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  stepIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 4 },
  stepDesc: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },

  perksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  perkCard: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  perkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  perkLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },

  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  stickyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#2563EB",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  stickyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
