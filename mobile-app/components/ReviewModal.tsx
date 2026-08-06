import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { submitReview } from "@/lib/db";

interface ReviewModalProps {
  visible: boolean;
  providerId: string;
  providerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewModal({ visible, providerId, providerName, onClose, onSuccess }: ReviewModalProps) {
  const colors = useColors();
  const { t } = useLanguage();
  const { user, supabaseUserId } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setRating(0);
    setHovered(0);
    setComment("");
    setError("");
    setSubmitted(false);
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (rating === 0) {
      setError(t.pleaseSelectStarRating);
      return;
    }
    if (!supabaseUserId || !user) {
      setError(t.mustSignInToReview);
      return;
    }
    setLoading(true);
    setError("");
    const result = await submitReview(
      providerId,
      supabaseUserId,
      user.name ?? t.anonymous,
      rating,
      comment.trim(),
    );
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? t.failedToSubmitReview);
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
    setTimeout(() => {
      reset();
      onSuccess();
    }, 1800);
  }

  const activeRating = hovered || rating;

  const LABELS = ["", t.ratingPoor, t.ratingFair, t.ratingGood, t.ratingGreat, t.ratingExcellent];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetWrap}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.handle, { backgroundColor: colors.muted }]} />

          {submitted ? (
            <View style={styles.successState}>
              <View style={[styles.successCircle, { backgroundColor: "#10B98122" }]}>
                <Ionicons name="checkmark-circle" size={56} color="#10B981" />
              </View>
              <Text style={[styles.successTitle, { color: colors.foreground }]}>{t.reviewSubmitted}</Text>
              <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
                {t.thanksForSharing.replace("{name}", providerName)}
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t.rateName.replace("{name}", providerName)}
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                {t.howWasExperienceHelp}
              </Text>

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={async () => {
                      setRating(star);
                      setError("");
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    onPressIn={() => setHovered(star)}
                    onPressOut={() => setHovered(0)}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={star <= activeRating ? "star" : "star-outline"}
                      size={44}
                      color={star <= activeRating ? "#F59E0B" : colors.border}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {activeRating > 0 && (
                <Text style={[styles.ratingLabel, { color: "#F59E0B" }]}>
                  {LABELS[activeRating]}
                </Text>
              )}

              <View style={[styles.textAreaWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.textArea, { color: colors.foreground }]}
                  placeholder={t.shareDetailsOptional}
                  placeholderTextColor={colors.mutedForeground}
                  value={comment}
                  onChangeText={(text) => setComment(text.slice(0, 300))}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                  autoFocus={false}
                />
                <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                  {comment.length}/300
                </Text>
              </View>

              {!!error && (
                <View style={[styles.errorBadge, { backgroundColor: colors.destructive + "18" }]}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              )}

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>{t.cancel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: rating > 0 ? colors.primary : colors.muted }]}
                  onPress={handleSubmit}
                  disabled={loading || rating === 0}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="star" size={16} color={rating > 0 ? "#FFFFFF" : colors.mutedForeground} />
                      <Text style={[styles.submitBtnText, { color: rating > 0 ? "#FFFFFF" : colors.mutedForeground }]}>
                        {t.submitReview}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {!supabaseUserId && (
                <Text style={[styles.demoNote, { color: colors.mutedForeground }]}>
                  {t.reviewsRequireAccount}
                </Text>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    textAlign: "center",
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  ratingLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    textAlign: "center",
    marginTop: -8,
  },
  textAreaWrap: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    minHeight: 100,
  },
  textArea: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    minHeight: 70,
  },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  submitBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  submitBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  demoNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  successState: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 12,
  },
  successCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  successSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
