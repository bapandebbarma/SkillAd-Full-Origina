import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Linking,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import {
  checkAppReviewEligibility,
  cityFromAddress,
  fetchPlayStoreLink,
  submitAppReview,
} from "@/lib/appReviews";

const SUCCESS_MESSAGE = "Thank you for helping improve SkillAd.";
const COOLDOWN_MESSAGE =
  "You recently submitted feedback.\nThank you.\nYou can submit another review after 90 days.";

export default function RateSkillAdScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, supabaseUserId } = useAuth();
  const { location } = useLocation();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [eligibilityWarning, setEligibilityWarning] = useState("");
  const [error, setError] = useState("");

  const userId = supabaseUserId || user?.id || undefined;

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();

    async function loadEligibility() {
      setChecking(true);
      setEligibilityWarning("");
      try {
        const result = await checkAppReviewEligibility(userId, {
          timeoutMs: 8000,
          signal: abort.signal,
        });
        if (cancelled) return;
        if (!result.eligible) {
          setBlockedMessage(result.message || COOLDOWN_MESSAGE);
          return;
        }
        setBlockedMessage(null);
        if (result.failed) {
          setEligibilityWarning(
            "Could not verify recent feedback status. You can still submit a review.",
          );
        }
      } catch {
        if (cancelled) return;
        setBlockedMessage(null);
        setEligibilityWarning(
          "Could not verify recent feedback status. You can still submit a review.",
        );
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void loadEligibility();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [userId]);

  function handleCancel() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }

  async function offerPlayStoreRating() {
    const link = await fetchPlayStoreLink();
    Alert.alert(
      "Thank you!",
      `${SUCCESS_MESSAGE}\n\nWould you also like to rate SkillAd on the Google Play Store?`,
      [
        { text: "Not now", style: "cancel", onPress: () => router.back() },
        {
          text: "Open Play Store",
          onPress: async () => {
            try {
              await Linking.openURL(link);
            } catch {
              /* ignore */
            }
            router.back();
          },
        },
      ],
    );
  }

  async function handleSubmit() {
    const body = text.trim();
    if (body.length < 5) {
      setError("Please write a short review (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    setError("");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await submitAppReview({
      rating,
      text: body,
      suggestion,
      displayName: user?.name?.trim() || "SkillAd user",
      userId,
      userType: user?.isProvider ? "Provider" : "Customer",
      city: cityFromAddress(location?.address),
    });

    setSubmitting(false);

    if (!result.ok) {
      if (result.status === 409) {
        setBlockedMessage(result.error || COOLDOWN_MESSAGE);
        return;
      }
      setError(result.error);
      return;
    }

    if (rating === 5) {
      void offerPlayStoreRating();
    } else {
      Alert.alert("Thank you!", SUCCESS_MESSAGE, [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Rate SkillAd</Text>
        <View style={{ width: 40 }} />
      </View>

      {blockedMessage ? (
        <View style={styles.blockedWrap}>
          <Text style={styles.blockedEmoji}>⭐</Text>
          <Text style={[styles.blockedTitle, { color: colors.foreground }]}>
            You recently submitted feedback.
          </Text>
          <Text style={styles.blockedBody}>
            Thank you.{"\n"}You can submit another review after 90 days.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleCancel}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>OK</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: colors.foreground }]}>Rate SkillAd</Text>
            <Text style={styles.subtitle}>
              Tell us about your experience using the SkillAd platform.
            </Text>
            <Text style={styles.note}>
              This review is about the SkillAd application itself. It is NOT a review of any
              service provider.
            </Text>

            {checking ? (
              <View style={styles.inlineCheck}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.inlineCheckText}>Checking feedback status…</Text>
              </View>
            ) : null}

            {!!eligibilityWarning && (
              <Text style={styles.warning}>{eligibilityWarning}</Text>
            )}

            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRating(n);
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.star, n <= rating && styles.starOn]}>★</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Review</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Share your experience with SkillAd…"
              placeholderTextColor="#94A3B8"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={2000}
            />

            <Text style={[styles.label, { color: colors.foreground }]}>
              Suggestion <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.suggestion,
                { color: colors.foreground, borderColor: colors.border },
              ]}
              placeholder="Any ideas to improve SkillAd?"
              placeholderTextColor="#94A3B8"
              value={suggestion}
              onChangeText={setSuggestion}
              multiline
              maxLength={1000}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Submit</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleCancel}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    lineHeight: 22,
    marginBottom: 8,
  },
  note: {
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 18,
    marginBottom: 20,
  },
  stars: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  star: {
    fontSize: 36,
    color: "#CBD5E1",
  },
  starOn: {
    color: "#F59E0B",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  optional: {
    fontWeight: "400",
    color: "#94A3B8",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  suggestion: {
    minHeight: 72,
  },
  error: {
    color: "#DC2626",
    fontSize: 13,
    marginBottom: 10,
  },
  warning: {
    color: "#B45309",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  inlineCheck: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  inlineCheckText: {
    fontSize: 13,
    color: "#64748B",
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginTop: 4,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  secondaryText: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 15,
  },
  blockedWrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    alignItems: "center",
  },
  blockedEmoji: {
    fontSize: 40,
    marginBottom: 16,
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  blockedBody: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
});
