import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  APP_REVIEW_DISMISS_KEY,
  APP_REVIEW_LAST_SUBMIT_KEY,
  USAGE_PROMPT_DAYS,
  checkAppReviewEligibility,
  ensureFirstOpenAndDaysUsed,
  isWithinLocalCooldown,
} from "@/lib/appReviews";

/**
 * Soft, usage-based reminder to rate SkillAd.
 * Shows after meaningful usage (7 days), not after bookings.
 * "Later" dismisses for 90 days. "Rate Now" opens the Rate SkillAd screen.
 */
export function AppReviewPrompt() {
  const { user, supabaseUserId } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const maybeShow = useCallback(async () => {
    if (!user) return;
    try {
      if (await isWithinLocalCooldown(APP_REVIEW_LAST_SUBMIT_KEY)) return;
      if (await isWithinLocalCooldown(APP_REVIEW_DISMISS_KEY)) return;

      const daysUsed = await ensureFirstOpenAndDaysUsed();
      if (daysUsed < USAGE_PROMPT_DAYS) return;

      const userId = supabaseUserId || user.id;
      const eligibility = await checkAppReviewEligibility(userId);
      if (!eligibility.eligible) return;

      setVisible(true);
    } catch {
      /* ignore */
    }
  }, [user, supabaseUserId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void maybeShow();
    }, 1500);
    return () => clearTimeout(t);
  }, [maybeShow]);

  async function dismissLater() {
    setVisible(false);
    try {
      await AsyncStorage.setItem(APP_REVIEW_DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  function rateNow() {
    setVisible(false);
    router.push("/rate-skillad" as never);
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={dismissLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Enjoying SkillAd?</Text>
          <Text style={styles.stars}>★★★★★</Text>
          <Text style={styles.subtitle}>Tell us what you think.</Text>

          <View style={styles.row}>
            <Pressable onPress={dismissLater} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Later</Text>
            </Pressable>
            <Pressable onPress={rateNow} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Rate Now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 10,
  },
  stars: {
    fontSize: 28,
    color: "#F59E0B",
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  secondaryText: {
    color: "#64748B",
    fontWeight: "600",
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
});
