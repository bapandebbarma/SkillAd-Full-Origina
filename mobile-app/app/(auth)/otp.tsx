import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { API_BASE } from "@/lib/db";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OTPScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phone, name, userType } = useLocalSearchParams<{
    phone: string;
    name: string;
    userType?: string;
  }>();
  const { verifyOtp } = useAuth();
  const { t } = useLanguage();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [resendMessage, setResendMessage] = useState("");
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  function handleOtpChange(text: string, index: number) {
    const digit = text.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError("");
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-verify when all digits entered
    if (digit && index === OTP_LENGTH - 1) {
      const full = [...newOtp.slice(0, OTP_LENGTH - 1), digit].join("");
      if (full.length === OTP_LENGTH) {
        handleVerify(full);
      }
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
    }
  }

  async function handleVerify(code?: string) {
    const finalCode = code ?? otp.join("");
    if (finalCode.length < OTP_LENGTH) {
      setError(t.enterAll6Digits);
      return;
    }
    if (loading) return;
    setLoading(true);
    setError("");
    const isProvider = userType === "provider";
    const result = await verifyOtp(phone ?? "", finalCode, isProvider);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleResend() {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    setError("");
    setResendMessage("");
    setOtp(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();

    try {
      const res = await fetch(`${API_BASE}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setResendTimer(RESEND_COOLDOWN);
        setResendMessage(t.otpResentSuccess);
        setTimeout(() => setResendMessage(""), 3000);
      } else {
        setError(data.error ?? t.otpResendFailed);
      }
    } catch {
      setError(t.networkError);
    }
    setResending(false);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
          <Ionicons name="phone-portrait-outline" size={32} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>{t.verifyYourNumber}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t.weSentOtpTo}
        </Text>
        <Text style={[styles.phoneDisplay, { color: colors.foreground }]}>
          +91 {phone}
        </Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t.enterCodeBelow}
        </Text>

        {/* OTP Input Boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputRefs.current[i] = r; }}
              style={[
                styles.otpBox,
                {
                  borderColor: error ? colors.destructive : digit ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                  color: colors.foreground,
                },
              ]}
              value={digit}
              onChangeText={(digit) => handleOtpChange(digit, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="numeric"
              maxLength={1}
              selectTextOnFocus
              autoFocus={i === 0}
              editable={!loading}
            />
          ))}
        </View>

        {/* Error message */}
        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}15`, borderColor: `${colors.destructive}40` }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {/* Resend success message */}
        {!!resendMessage && (
          <View style={[styles.successBox, { backgroundColor: "#10B98115", borderColor: "#10B98140" }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
            <Text style={[styles.successText, { color: "#10B981" }]}>{resendMessage}</Text>
          </View>
        )}

        {/* Verify Button */}
        <TouchableOpacity
          style={[
            styles.verifyBtn,
            { backgroundColor: otp.join("").length === OTP_LENGTH ? colors.primary : colors.muted },
          ]}
          onPress={() => handleVerify()}
          disabled={loading || otp.join("").length < OTP_LENGTH}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.verifyBtnText}>{t.verifyAndContinue}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Resend OTP */}
        <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0 || resending}>
          {resending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : resendTimer > 0 ? (
            <Text style={[styles.resend, { color: colors.mutedForeground }]}>
              {t.resendOtpIn.replace("{n}", String(resendTimer))}
            </Text>
          ) : (
            <Text style={[styles.resend, { color: colors.primary }]}>{t.resendOtp}</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          {t.otpValid10Min}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 24 },
  content: { alignItems: "center" },
  iconCircle: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, marginBottom: 8 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
  phoneDisplay: { fontFamily: "Inter_700Bold", fontSize: 17, marginTop: 4, marginBottom: 4 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", marginBottom: 28 },
  otpRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  otpBox: {
    width: 46, height: 56, borderRadius: 12, borderWidth: 2,
    textAlign: "center", fontFamily: "Inter_700Bold", fontSize: 22,
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14, width: "100%",
  },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },
  successBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14, width: "100%",
  },
  successText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },
  verifyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    width: "100%", height: 54, borderRadius: 14, marginBottom: 16, marginTop: 4, gap: 8,
  },
  verifyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#FFFFFF" },
  resend: { fontFamily: "Inter_500Medium", fontSize: 14, marginBottom: 20 },
  footer: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 8 },
});
