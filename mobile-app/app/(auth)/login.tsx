import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { API_BASE } from "@/lib/db";

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+`;
  if (n > 0) return `${n}+`;
  return "—";
}

function usePublicStats() {
  const [stats, setStats] = useState<{ workers: string; services: string; cities: string }>({
    workers: "50K+",
    services: "100+",
    cities: "200+",
  });
  useEffect(() => {
    fetch(`${API_BASE}/stats`)
      .then((r) => r.json())
      .then((d) => {
        setStats({
          workers: formatCount(d.workers ?? 0),
          services: formatCount(d.services ?? 0),
          cities: formatCount(d.cities ?? 0),
        });
      })
      .catch(() => {});
  }, []);
  return stats;
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const stats = usePublicStats();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [userType, setUserType] = useState<"customer" | "provider">("customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValid = phone.length >= 10 && name.trim().length >= 2;

  async function handleSendOTP() {
    if (!isValid) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError("");
    const result = await signIn(phone, name, userType === "provider");
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push({
      pathname: "/(auth)/otp",
      params: { phone, name, userType },
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#1E40AF", "#2563EB", "#0F172A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 20 }]}
      >
        <Text style={styles.heroHeadline}>{t.connectWithSkilled}</Text>
        <Text style={styles.heroSub}>{t.hireSkillsTagline}</Text>
        <View style={styles.statsRow}>
          {([
            { label: t.workers, value: stats.workers },
            { label: t.servicesLabel, value: stats.services },
            { label: t.cities, value: stats.cities },
          ] as const).map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{t.welcomeBack}</Text>
          <Text style={[styles.formSub, { color: colors.mutedForeground }]}>{t.signInToContinue}</Text>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>{t.iAmA}</Text>
          <View style={[styles.typeRow, { borderColor: colors.border }]}>
            {(["customer", "provider"] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, userType === type && { backgroundColor: colors.primary }]}
                onPress={() => setUserType(type)}
              >
                <Text style={[styles.typeBtnText, { color: userType === type ? "#FFFFFF" : colors.mutedForeground }]}>
                  {type === "customer" ? t.customer : t.serviceProvider}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>{t.fullName}</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder={t.enterFullName}
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>{t.mobileNumber}</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={styles.countryCode}>
              <Text style={[styles.flag, { color: colors.foreground }]}>+91</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder={t.enterMobileNumber}
              placeholderTextColor={colors.mutedForeground}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/\D/g, "").slice(0, 10))}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleSendOTP}
            />
          </View>

          {!!error && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          )}

          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: isValid ? colors.primary : colors.muted }]}
            onPress={handleSendOTP}
            disabled={!isValid || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.sendBtnText}>{t.sendOtp}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <Text style={[styles.terms, { color: colors.mutedForeground }]}>
            {t.agreeToTermsPrivacy}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  hero: { paddingHorizontal: 24, paddingBottom: 28 },
  heroHeadline: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#FFFFFF", lineHeight: 34, marginBottom: 8 },
  heroSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 24 },
  statItem: { alignItems: "center" },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#FFFFFF" },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  form: { paddingHorizontal: 24, paddingTop: 28 },
  formTitle: { fontFamily: "Inter_700Bold", fontSize: 22, marginBottom: 4 },
  formSub: { fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 24 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 8, marginTop: 4 },
  typeRow: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 9 },
  typeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, marginBottom: 14, height: 52, gap: 10 },
  countryCode: { paddingRight: 4 },
  flag: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  divider: { width: 1, height: 22 },
  input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, height: "100%" },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 8 },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 54, borderRadius: 14, marginTop: 8, gap: 8 },
  sendBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#FFFFFF" },
  terms: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 16 },
});
