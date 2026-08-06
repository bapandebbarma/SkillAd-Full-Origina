import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { API_BASE } from "@/lib/db";
import { createPaymentOrder, verifyPayment } from "@/lib/payments";

// Official Razorpay RN SDK (native module — requires a custom/dev/EAS build, not Expo Go)
import RazorpayCheckout from "react-native-razorpay";

// ── Types ─────────────────────────────────────────────────────────────────────
type PlanKey = "monthly" | "quarterly" | "halfYearly" | "yearly";

interface PlanConfig {
  key: string;
  label: string;
  price: number;
  billedAs: string;
  badge?: string;
  badgeColor?: string;
}

const DEFAULT_PLANS: PlanConfig[] = [
  { key: "monthly",    label: "Monthly",     price: 10,  billedAs: "Billed every month" },
  { key: "quarterly",  label: "Quarterly",   price: 30,  billedAs: "Billed every 3 months", badge: "Popular",    badgeColor: "#2563EB" },
  { key: "halfYearly", label: "Half Yearly", price: 50,  billedAs: "Billed every 6 months", badge: "Best Value", badgeColor: "#10B981" },
  { key: "yearly",     label: "Yearly",      price: 100, billedAs: "Billed once a year" },
];

const PLAN_COLORS: Record<string, string> = {
  monthly: "#3B82F6", quarterly: "#2563EB", halfYearly: "#10B981", yearly: "#8B5CF6",
};

type FeatureKey =
  | "featureAppearInSearch"
  | "featureLocationMatching"
  | "featureUnlimitedMessaging"
  | "featureInstantBookingNotifs"
  | "featureCollectRatings"
  | "featureEarningsAnalytics"
  | "featureVerifiedBadge";

const FEATURES: { icon: string; key: FeatureKey }[] = [
  { icon: "people-outline",           key: "featureAppearInSearch" },
  { icon: "location-outline",         key: "featureLocationMatching" },
  { icon: "chatbubbles-outline",      key: "featureUnlimitedMessaging" },
  { icon: "notifications-outline",    key: "featureInstantBookingNotifs" },
  { icon: "star-outline",             key: "featureCollectRatings" },
  { icon: "bar-chart-outline",        key: "featureEarningsAnalytics" },
  { icon: "shield-checkmark-outline", key: "featureVerifiedBadge" },
];

type PayMethod = "upi" | "card" | "netbanking" | "wallet";
const PAY_OPTIONS = [
  { key: "upi"        as PayMethod, label: "UPI",              icon: "phone-portrait-outline", color: "#8B5CF6", desc: "GPay, PhonePe, Paytm, BHIM" },
  { key: "card"       as PayMethod, label: "Debit/Credit Card", icon: "card-outline",          color: "#3B82F6", desc: "Visa, Mastercard, RuPay" },
  { key: "netbanking" as PayMethod, label: "Net Banking",       icon: "business-outline",      color: "#F59E0B", desc: "All major Indian banks" },
  { key: "wallet"     as PayMethod, label: "Mobile Wallet",     icon: "wallet-outline",        color: "#10B981", desc: "Paytm, Mobikwik, Freecharge" },
];

type T = ReturnType<typeof useLanguage>["t"];

function getPlanLabel(t: T, p: PlanConfig): string {
  const m: Record<string, string> = {
    monthly: t.monthly,
    quarterly: t.quarterly,
    halfYearly: t.halfYearly,
    yearly: t.yearly,
  };
  return m[p.key] ?? p.label;
}

function getPlanBilledAs(t: T, p: PlanConfig): string {
  const m: Record<string, string> = {
    monthly: t.billedEveryMonth,
    quarterly: t.billedEvery3Months,
    halfYearly: t.billedEvery6Months,
    yearly: t.billedOnceAYear,
  };
  return m[p.key] ?? p.billedAs;
}

function getPlanBadge(t: T, badge?: string): string | undefined {
  if (!badge) return undefined;
  if (badge === "Popular") return t.popular;
  if (badge === "Best Value") return t.bestValue;
  return badge;
}

function getPlanLabelByKey(t: T, plans: PlanConfig[], key: string): string {
  const p = plans.find((x) => x.key === key);
  if (p) return getPlanLabel(t, p);
  const m: Record<string, string> = {
    monthly: t.monthly,
    quarterly: t.quarterly,
    halfYearly: t.halfYearly,
    yearly: t.yearly,
  };
  return m[key] ?? key;
}

function getPayLabel(t: T, key: PayMethod): string {
  if (key === "upi") return t.upi;
  if (key === "card") return t.debitCreditCard;
  if (key === "netbanking") return t.netBanking;
  return t.mobileWallet;
}

function getPayDesc(t: T, key: PayMethod): string {
  if (key === "upi") return t.upiDesc;
  if (key === "card") return t.cardDesc;
  if (key === "netbanking") return t.netBankingDesc;
  return t.walletDesc;
}

async function fetchPlans(): Promise<PlanConfig[]> {
  try {
    const r = await fetch(`${API_BASE}/plans`);
    if (!r.ok) return DEFAULT_PLANS;
    const d = await r.json() as { plans: PlanConfig[] };
    if (Array.isArray(d.plans) && d.plans.length > 0) return d.plans;
  } catch { /* fall through */ }
  return DEFAULT_PLANS;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { t }   = useLanguage();
  const { supabaseUserId, user } = useAuth();
  const { fromRegistration, providerId: providerIdParam } = useLocalSearchParams<{
    fromRegistration?: string;
    providerId?: string;
  }>();
  const isFromRegistration = fromRegistration === "1";
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 32 : insets.bottom;

  const [plans,          setPlans]          = useState<PlanConfig[]>(DEFAULT_PLANS);
  const [loadingPlans,   setLoadingPlans]   = useState(true);
  const [selectedKey,    setSelectedKey]    = useState<string>("quarterly");
  const [payMethod,      setPayMethod]      = useState<PayMethod>("upi");
  const [paying,         setPaying]         = useState(false);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settings,       setSettings]       = useState<any>(null);
  const [resolvedProviderId, setResolvedProviderId] = useState<string | null>(
    typeof providerIdParam === "string" ? providerIdParam : null,
  );
  // Manual payment mode
  const [utr,           setUtr]           = useState("");
  const [paymentDate,   setPaymentDate]   = useState(new Date().toISOString().slice(0, 10));
  const [amount,        setAmount]        = useState("");
  const [notes,         setNotes]         = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [submitted,     setSubmitted]     = useState(false);
  /** Gateway payment verified — success UI only (no subscription activation yet). */
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paidPlanLabel, setPaidPlanLabel] = useState<string>("");

  // Load existing subscription to resolve providerId
  useEffect(() => {
    const uid = supabaseUserId ?? (user as any)?.id;
    if (!uid || resolvedProviderId) return;
    fetch(`${API_BASE}/subscriptions/${uid}`)
      .then((r) => r.json())
      .then((d: any) => { if (d?.subscription?.providerId) setResolvedProviderId(d.subscription.providerId); })
      .catch(() => {});
  }, [supabaseUserId]);

  // Check for existing renewal request
  useEffect(() => {
    const uid = supabaseUserId ?? (user as any)?.id;
    if (!uid) return;
    fetch(`${API_BASE}/renewal-requests/${uid}`)
      .then((r) => r.json())
      .then((d: any) => { if (d?.request) setPendingRequest(d.request); })
      .catch(() => {});
  }, [supabaseUserId]);

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then((r) => r.json())
      .then((d: any) => {
        const enabled = d.paymentGatewayEnabled === true;
        setPaymentEnabled(enabled);
        setSettings(d);
        setSettingsLoaded(true);
        fetchPlans().then((p) => {
          setPlans(p);
          const popular = p.find((x) => x.badge === "Popular") ?? p[1] ?? p[0];
          if (popular) setSelectedKey(popular.key);
          setLoadingPlans(false);
        });
      })
      .catch(() => {
        setSettingsLoaded(true);
        fetchPlans().then((p) => {
          setPlans(p);
          const popular = p.find((x) => x.badge === "Popular") ?? p[1] ?? p[0];
          if (popular) setSelectedKey(popular.key);
          setLoadingPlans(false);
        });
      });
  }, []);

  const plan = plans.find((p) => p.key === selectedKey) ?? plans[0];
  const planColor = plan ? (PLAN_COLORS[plan.key] ?? "#2563EB") : "#2563EB";

  // ── Gateway payment (Razorpay Checkout) ────────────────────────────────────
  // Creates order → opens Checkout → verifies signature.
  // Does NOT activate subscription or write payment history (next phase).
  async function handlePay() {
    if (!plan) return;

    if (Platform.OS === "web") {
      Alert.alert(
        t.error,
        "Razorpay Checkout is available in the SkillAd mobile app.",
        [{ text: t.tryAgain }],
      );
      return;
    }

    const uid = supabaseUserId ?? (user as any)?.id;
    if (!uid) {
      Alert.alert(t.notSignedIn, t.pleaseSignInFirst);
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setPaying(true);
    try {
      // Match on-screen total (price + 18% GST), in paise for Razorpay
      const amountPaise = Math.round(plan.price * 1.18 * 100);
      if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
        throw new Error("Invalid plan amount");
      }

      const order = await createPaymentOrder({
        amount: amountPaise,
        currency: "INR",
        planId: plan.key,
        userId: String(uid),
      });

      const checkoutData = await RazorpayCheckout.open({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "SkillAd",
        description: `SkillAd ${getPlanLabel(t, plan)} plan`,
        order_id: order.orderId,
        prefill: {
          name: (user as any)?.name ?? "",
          contact: (user as any)?.phone ?? "",
        },
        theme: { color: "#2563EB" },
        notes: {
          planId: plan.key,
          userId: String(uid),
        },
      });

      const ok = await verifyPayment({
        razorpay_order_id: checkoutData.razorpay_order_id,
        razorpay_payment_id: checkoutData.razorpay_payment_id,
        razorpay_signature: checkoutData.razorpay_signature,
        userId: String(uid),
        planId: plan.key,
      });

      if (!ok) {
        Alert.alert(
          t.error,
          "Payment received but verification failed. Please contact support or try again.",
          [{ text: t.tryAgain }],
        );
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPaidPlanLabel(getPlanLabel(t, plan));
      setPaymentSuccess(true);
    } catch (e: unknown) {
      const err = e as {
        code?: number | string;
        description?: string;
        error?: { description?: string; reason?: string };
        message?: string;
      };
      const code = String(err?.code ?? "");
      const description =
        err?.description ??
        err?.error?.description ??
        err?.error?.reason ??
        err?.message ??
        "";

      const cancelled =
        code === "2" ||
        /cancel/i.test(description) ||
        /back.?pressed/i.test(description);

      Alert.alert(
        cancelled ? t.error : t.error,
        cancelled
          ? "Payment was cancelled. You can try again when ready."
          : description || "Payment could not be completed. Please try again.",
        [{ text: t.tryAgain }],
      );
    } finally {
      setPaying(false);
    }
  }

  function handleSkip() {
    Alert.alert(
      t.accountInactive,
      t.accountInactiveDesc,
      [{ text: t.continueLabel, onPress: () => router.replace("/(tabs)") }],
    );
  }

  // ── Manual UTR submission ──────────────────────────────────────────────────
  async function handleSubmitRenewal() {
    if (!utr.trim()) { Alert.alert(t.required, t.pleaseEnterUtr); return; }
    const uid = supabaseUserId ?? (user as any)?.id;
    if (!uid) { Alert.alert(t.notSignedIn, t.pleaseSignInFirst); return; }
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const pId = resolvedProviderId ?? uid;
      const res = await fetch(`${API_BASE}/renewal-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          providerId: pId,
          providerName: (user as any)?.name ?? "Provider",
          providerPhone: (user as any)?.phone ?? "",
          plan: selectedKey,
          amount: amount ? Number(amount) : undefined,
          utr: utr.trim(),
          paymentDate,
          notes: notes.trim(),
        }),
      });
      if (!res.ok) throw new Error(t.failedToSubmit);
      const d = await res.json() as { requestId?: string };
      setPendingRequest({ id: d.requestId, status: "pending", plan: selectedKey, utr: utr.trim(), paymentDate });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? t.couldNotSubmitRenewal);
    }
    setSubmitting(false);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!settingsLoaded || loadingPlans) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ── Payment verified (gateway) — success only, no subscription activation ──
  if (paymentSuccess) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: topPad + 16, paddingBottom: botPad + 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>

          <View style={[styles.statusIconWrap, { backgroundColor: "#D1FAE5", marginTop: 32 }]}>
            <Ionicons name="checkmark-circle" size={44} color="#10B981" />
          </View>

          <Text style={[styles.statusTitle, { color: colors.foreground }]}>
            {t.paymentSuccessful}
          </Text>
          <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
            {paidPlanLabel
              ? `Your payment for the ${paidPlanLabel} plan was verified successfully.`
              : "Your payment was verified successfully."}
            {"\n"}
            Subscription activation will be completed in the next step.
          </Text>

          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaBtnText, { color: "#fff" }]}>{t.continueToApp}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Submitted confirmation ─────────────────────────────────────────────────
  if (submitted || (pendingRequest?.status === "pending" && !submitted)) {
    const isPending = pendingRequest?.status === "pending";
    const isApproved = pendingRequest?.status === "approved";
    const isRejected = pendingRequest?.status === "rejected";
    const needsClarify = pendingRequest?.status === "clarification_requested";

    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: topPad + 16, paddingBottom: botPad + 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>

          <View style={[styles.statusIconWrap, { backgroundColor: isApproved ? "#D1FAE5" : isRejected ? "#FEE2E2" : needsClarify ? "#FEF3C7" : "#EFF6FF", marginTop: 32 }]}>
            <Ionicons
              name={isApproved ? "checkmark-circle" : isRejected ? "close-circle" : needsClarify ? "help-circle" : "time-outline"}
              size={44}
              color={isApproved ? "#10B981" : isRejected ? "#EF4444" : needsClarify ? "#F59E0B" : "#3B82F6"}
            />
          </View>

          <Text style={[styles.statusTitle, { color: colors.foreground }]}>
            {isApproved ? t.subscriptionActivated : isRejected ? t.requestRejected : needsClarify ? t.clarificationNeeded : t.requestSubmitted}
          </Text>
          <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
            {isApproved
              ? t.subscriptionActiveDesc
              : isRejected
              ? (pendingRequest?.reviewNotes ?? t.paymentNotVerified)
              : needsClarify
              ? (pendingRequest?.reviewNotes ?? t.adminRequestedInfo)
              : t.renewalSubmittedDesc}
          </Text>

          {isPending && (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: t.plan, value: getPlanLabelByKey(t, plans, pendingRequest?.plan ?? selectedKey) },
                { label: t.utrTxnId, value: pendingRequest?.utr },
                { label: t.paymentDate, value: pendingRequest?.paymentDate },
                { label: t.status, value: t.pendingReview },
              ].map(({ label, value }) => value ? (
                <View key={label} style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
                </View>
              ) : null)}
            </View>
          )}

          {(isRejected || needsClarify) && (
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
              onPress={() => { setPendingRequest(null); setSubmitted(false); setUtr(""); setNotes(""); setAmount(""); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaBtnText, { color: "#fff" }]}>{t.submitAgain}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: isApproved ? colors.primary : colors.card, borderWidth: isApproved ? 0 : 1, borderColor: colors.border, marginTop: isApproved ? 24 : 12 }]}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaBtnText, { color: isApproved ? "#fff" : colors.mutedForeground }]}>
              {isApproved ? t.goToApp : t.continueToApp}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Gateway payment flow ───────────────────────────────────────────────────
  if (paymentEnabled) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: botPad + 24 }}>
          <LinearGradient colors={["#0F172A", "#1E293B"]} style={[styles.header, { paddingTop: topPad + 10 }]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#94A3B8" />
            </TouchableOpacity>
            <View style={styles.crownWrap}>
              <LinearGradient colors={["#2563EB", "#1E40AF"]} style={styles.crownCircle}>
                <Ionicons name="trophy" size={28} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.headerTitle}>{t.activateYourSubscription}</Text>
            <Text style={styles.headerSub}>{t.activateSubscriptionSub}</Text>
          </LinearGradient>

          <PlanSelector plans={plans} selectedKey={selectedKey} onSelect={setSelectedKey} colors={colors} />

          {/* Features */}
          <View style={styles.sectionWrap}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.whatsIncluded}</Text></View>
          <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {FEATURES.map((f, i) => (
              <View key={f.key} style={[styles.featureRow, i < FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + "15" }]}><Ionicons name={f.icon as any} size={16} color={colors.primary} /></View>
                <Text style={[styles.featureText, { color: colors.foreground }]}>{t[f.key]}</Text>
                <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
              </View>
            ))}
          </View>

          {/* Payment method */}
          <View style={styles.sectionWrap}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.paymentMethod}</Text></View>
          <View style={styles.payCol}>
            {PAY_OPTIONS.map(opt => {
              const active = opt.key === payMethod;
              return (
                <TouchableOpacity key={opt.key} style={[styles.payCard, { backgroundColor: colors.card, borderColor: active ? opt.color : colors.border, borderWidth: active ? 2 : 1 }]} onPress={() => setPayMethod(opt.key)} activeOpacity={0.8}>
                  <View style={[styles.payIconBox, { backgroundColor: opt.color + "18" }]}><Ionicons name={opt.icon as any} size={20} color={opt.color} /></View>
                  <View style={{ flex: 1 }}><Text style={[styles.payLabel, { color: colors.foreground }]}>{getPayLabel(t, opt.key)}</Text><Text style={[styles.payDesc, { color: colors.mutedForeground }]}>{getPayDesc(t, opt.key)}</Text></View>
                  <View style={[styles.radio, { borderColor: active ? opt.color : colors.border }]}>{active && <View style={[styles.radioDot, { backgroundColor: opt.color }]} />}</View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Order summary */}
          {plan && (
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.foreground }]}>{t.orderSummary}</Text>
              {[
                { k: t.plan, v: t.skillAdProPlan.replace("{name}", getPlanLabel(t, plan)) },
                { k: t.subtotal, v: `₹${plan.price.toLocaleString("en-IN")}` },
                { k: t.gst18, v: `₹${Math.round(plan.price * 0.18).toLocaleString("en-IN")}` },
              ].map(({ k, v }) => (
                <View key={k} style={styles.summaryRow}><Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>{k}</Text><Text style={[styles.summaryValue, { color: colors.foreground }]}>{v}</Text></View>
              ))}
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryTotal, { color: colors.foreground }]}>{t.total}</Text>
                <Text style={[styles.summaryTotalAmt, { color: planColor }]}>₹{Math.round(plan.price * 1.18).toLocaleString("en-IN")}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.payBtn, { opacity: paying || !plan ? 0.8 : 1 }]} onPress={handlePay} disabled={paying || !plan} activeOpacity={0.88}>
            <LinearGradient colors={["#2563EB", "#1E40AF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.payBtnGrad}>
              {paying ? <ActivityIndicator color="#FFFFFF" /> : (
                <><Ionicons name="lock-closed" size={18} color="#FFFFFF" /><Text style={styles.payBtnText}>{t.payAmountSecurely.replace("{amount}", plan ? Math.round(plan.price * 1.18).toLocaleString("en-IN") : "...")}</Text></>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <Text style={[styles.secureNote, { color: colors.mutedForeground }]}>🔒  {t.securedBySsl}</Text>
          {isFromRegistration && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={[styles.skipText, { color: colors.mutedForeground }]}>{t.skipActivateLater}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Manual payment flow (payment gateway disabled) ─────────────────────────
  const hasUpi    = !!(settings?.upiId);
  const hasBank   = !!(settings?.bankAccountName);
  const hasPaymentDetails = hasUpi || hasBank;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: botPad + 120 }}>
        {/* Header */}
        <LinearGradient colors={["#0F172A", "#1E293B"]} style={[styles.header, { paddingTop: topPad + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#94A3B8" />
          </TouchableOpacity>
          <View style={styles.crownWrap}>
            <LinearGradient colors={["#FF6B35", "#E55020"]} style={styles.crownCircle}>
              <Ionicons name="card" size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.headerTitle}>{t.activateYourSubscription}</Text>
          <Text style={styles.headerSub}>{t.activateSubscriptionSub}</Text>
        </LinearGradient>

        {/* Plan selector */}
        <PlanSelector plans={plans} selectedKey={selectedKey} onSelect={setSelectedKey} colors={colors} />

        {/* Payment details */}
        {hasPaymentDetails ? (
          <>
            <View style={styles.sectionWrap}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.whereToPay}</Text></View>
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {hasUpi && (
                <View style={[styles.payDetailsCard, { backgroundColor: "#6D28D910", borderColor: "#7C3AED30" }]}>
                  <View style={styles.payDetailsRow}>
                    <View style={[styles.payDetailsIcon, { backgroundColor: "#6D28D920" }]}><Ionicons name="phone-portrait-outline" size={20} color="#8B5CF6" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.payDetailsTitle, { color: "#A78BFA" }]}>{t.upiPayment}</Text>
                      <Text style={[styles.payDetailsDesc, { color: colors.mutedForeground }]}>{t.upiApps}</Text>
                    </View>
                  </View>
                  <View style={[styles.payDetailsBody, { backgroundColor: colors.background + "90" }]}>
                    <View style={styles.payDetailsKV}><Text style={[styles.payDetailsK, { color: colors.mutedForeground }]}>{t.upiId}</Text><Text style={[styles.payDetailsV, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{settings.upiId}</Text></View>
                    {settings.upiName && <View style={styles.payDetailsKV}><Text style={[styles.payDetailsK, { color: colors.mutedForeground }]}>{t.name}</Text><Text style={[styles.payDetailsV, { color: colors.foreground }]}>{settings.upiName}</Text></View>}
                  </View>
                </View>
              )}
              {hasBank && (
                <View style={[styles.payDetailsCard, { backgroundColor: "#06524310", borderColor: "#06524330" }]}>
                  <View style={styles.payDetailsRow}>
                    <View style={[styles.payDetailsIcon, { backgroundColor: "#06524320" }]}><Ionicons name="business-outline" size={20} color="#10B981" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.payDetailsTitle, { color: "#34D399" }]}>{t.bankTransfer}</Text>
                      <Text style={[styles.payDetailsDesc, { color: colors.mutedForeground }]}>{t.neftImpsRtgs}</Text>
                    </View>
                  </View>
                  <View style={[styles.payDetailsBody, { backgroundColor: colors.background + "90" }]}>
                    <View style={styles.payDetailsKV}><Text style={[styles.payDetailsK, { color: colors.mutedForeground }]}>{t.name}</Text><Text style={[styles.payDetailsV, { color: colors.foreground }]}>{settings.bankAccountName}</Text></View>
                    {settings.bankName && <View style={styles.payDetailsKV}><Text style={[styles.payDetailsK, { color: colors.mutedForeground }]}>{t.bank}</Text><Text style={[styles.payDetailsV, { color: colors.foreground }]}>{settings.bankName}</Text></View>}
                    {settings.bankAccountNumber && <View style={styles.payDetailsKV}><Text style={[styles.payDetailsK, { color: colors.mutedForeground }]}>{t.accountNo}</Text><Text style={[styles.payDetailsV, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{settings.bankAccountNumber}</Text></View>}
                    {settings.bankIfsc && <View style={styles.payDetailsKV}><Text style={[styles.payDetailsK, { color: colors.mutedForeground }]}>{t.ifsc}</Text><Text style={[styles.payDetailsV, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{settings.bankIfsc}</Text></View>}
                    {settings.bankBranch && <View style={styles.payDetailsKV}><Text style={[styles.payDetailsK, { color: colors.mutedForeground }]}>{t.branch}</Text><Text style={[styles.payDetailsV, { color: colors.foreground }]}>{settings.bankBranch}</Text></View>}
                  </View>
                </View>
              )}
              {settings?.paymentInstructions && (
                <View style={[styles.instructionsBox, { backgroundColor: "#1D4ED810", borderColor: "#1D4ED830" }]}>
                  <Ionicons name="information-circle-outline" size={16} color="#60A5FA" />
                  <Text style={[styles.instructionsText, { color: "#93C5FD" }]}>{settings.paymentInstructions}</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={[styles.noDetailsBox, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
            <Ionicons name="warning-outline" size={20} color="#D97706" />
            <Text style={[styles.noDetailsText, { color: "#92400E" }]}>{t.paymentDetailsBeingSetUp}</Text>
          </View>
        )}

        {/* Amount info */}
        {plan && (
          <View style={styles.amountBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.amountLabel}>{t.paymentSummary}</Text>
              <Text style={styles.amountValue}>₹{plan.price.toLocaleString("en-IN")}</Text>
              <View style={styles.amountDivider} />
              <Text style={styles.amountPlan}>{t.planLabel.replace("{name}", getPlanLabel(t, plan))}</Text>
              <Text style={styles.amountBilling}>{getPlanBilledAs(t, plan)}</Text>
            </View>
          </View>
        )}

        {/* UTR form */}
        <View style={styles.formSectionWrap}><Text style={styles.formSectionTitle}>{t.submitPaymentDetails}</Text></View>
        <View style={{ paddingHorizontal: 16 }}>

          {/* UTR */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>{t.utrTransactionId} <Text style={{ color: "#EF4444" }}>*</Text></Text>
            <TextInput
              value={utr}
              onChangeText={setUtr}
              placeholder={t.utrPlaceholder}
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              style={[styles.textInput, { backgroundColor: "#FFFFFF", borderColor: utr ? "#2563EB" : "#E2E8F0", color: colors.foreground }]}
            />
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>{t.utrHint}</Text>
          </View>

          {/* Payment date */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>{t.paymentDate}</Text>
            <TextInput
              value={paymentDate}
              onChangeText={setPaymentDate}
              placeholder={t.dateFormatPlaceholder}
              placeholderTextColor="#94A3B8"
              style={[styles.textInput, { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", color: colors.foreground }]}
            />
          </View>

          {/* Amount */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>{t.amountPaid}</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder={plan ? String(plan.price) : "0"}
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              style={[styles.textInput, { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", color: colors.foreground }]}
            />
          </View>

          {/* Notes */}
          <View style={styles.notesFormField}>
            <Text style={styles.fieldLabel}>{t.notesOptional}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t.notesPlaceholder}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              style={[styles.textInputMultiline, { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", color: colors.foreground }]}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmitRenewal}
            disabled={submitting || !utr.trim()}
            style={[styles.submitBtn, { opacity: submitting || !utr.trim() ? 0.6 : 1 }]}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#FB923C", "#F97316", "#EA580C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtnGrad}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <><Ionicons name="send" size={20} color="#fff" /><Text style={styles.submitBtnText}>{t.submitForVerification}</Text></>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.secureNote, { color: colors.mutedForeground }]}>
            {t.requestReviewed24h}
          </Text>

          {isFromRegistration && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={[styles.skipText, { color: colors.mutedForeground }]}>{t.skipActivateLaterFromProfile}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Plan selector (shared) ────────────────────────────────────────────────────
function PlanSelector({ plans, selectedKey, onSelect, colors }: { plans: PlanConfig[]; selectedKey: string; onSelect: (k: string) => void; colors: any }) {
  const { t } = useLanguage();
  void colors;
  return (
    <>
      <View style={styles.sectionWrap}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.chooseYourPlan}</Text></View>
      <View style={styles.plansCol}>
        {plans.map(p => {
          const active = p.key === selectedKey;
          const color = PLAN_COLORS[p.key] ?? "#2563EB";
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.planCard, active ? styles.planCardActive : styles.planCardInactive]}
              onPress={() => onSelect(p.key)}
              activeOpacity={0.8}
            >
              {p.badge && <View style={[styles.planBadge, { backgroundColor: p.badgeColor ?? color }]}><Text style={styles.planBadgeText}>{getPlanBadge(t, p.badge)}</Text></View>}
              <View style={styles.planRow}>
                <View style={[styles.radio, { borderColor: active ? color : colors.border }]}>{active && <View style={[styles.radioDot, { backgroundColor: color }]} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planLabel}>{getPlanLabel(t, p)}</Text>
                  <Text style={styles.planBilled}>{getPlanBilledAs(t, p)}</Text>
                </View>
                <Text style={styles.planPrice}>₹{p.price.toLocaleString("en-IN")}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: {
    position: "absolute", left: 16, top: 0, width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    marginTop: Platform.OS === "web" ? 67 : 0,
  },
  header: { paddingHorizontal: 20, paddingBottom: 28, alignItems: "center", gap: 0 },
  crownWrap: { marginTop: 12, marginBottom: 12 },
  crownCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 32, color: "#FFFFFF", textAlign: "center", marginBottom: 8 },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 15, color: "rgba(255,255,255,0.88)", textAlign: "center", lineHeight: 22, maxWidth: 340 },

  sectionWrap: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 10 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  formSectionWrap: { paddingHorizontal: 16, paddingTop: 24, marginBottom: 20 },
  formSectionTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#0F172A" },

  plansCol: { paddingHorizontal: 16, gap: 12 },
  planCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    position: "relative",
    overflow: "hidden",
  },
  planCardActive: {
    borderWidth: 2,
    borderColor: "#2563EB",
    backgroundColor: "#F8FBFF",
    shadowColor: "#2563EB",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  planCardInactive: {
    borderWidth: 1,
    borderColor: "#E8EDF5",
    backgroundColor: "#FFFFFF",
  },
  planBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  planBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#FFFFFF" },
  planRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  planLabel: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: "#0F172A" },
  planBilled: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2, color: "#64748B" },
  planPrice: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#0F172A", lineHeight: 32 },

  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  featuresCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  featureIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },

  payCol: { paddingHorizontal: 16, gap: 10 },
  payCard: { borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  payIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  payLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  payDesc: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },

  summaryCard: { marginHorizontal: 16, marginTop: 24, borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  summaryTitle: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryKey: { fontFamily: "Inter_400Regular", fontSize: 14 },
  summaryValue: { fontFamily: "Inter_500Medium", fontSize: 14 },
  summaryDivider: { height: 1, marginVertical: 4 },
  summaryTotal: { fontFamily: "Inter_700Bold", fontSize: 16 },
  summaryTotalAmt: { fontFamily: "Inter_700Bold", fontSize: 20 },

  payBtn: { marginHorizontal: 16, marginTop: 24, borderRadius: 16, overflow: "hidden" },
  payBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 },
  payBtnText: { fontFamily: "Inter_700Bold", fontSize: 17, color: "#FFFFFF" },

  secureNote: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", marginTop: 12, paddingHorizontal: 16, lineHeight: 18 },
  skipBtn: { alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 },
  skipText: { fontFamily: "Inter_400Regular", fontSize: 13, textDecorationLine: "underline" },

  // Manual payment styles
  payDetailsCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  payDetailsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  payDetailsIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  payDetailsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  payDetailsDesc: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  payDetailsBody: { borderRadius: 12, padding: 12, gap: 8 },
  payDetailsKV: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  payDetailsK: { fontFamily: "Inter_400Regular", fontSize: 13 },
  payDetailsV: { fontFamily: "Inter_500Medium", fontSize: 13 },
  instructionsBox: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  instructionsText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, lineHeight: 18 },
  noDetailsBox: { marginHorizontal: 16, marginTop: 16, borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  noDetailsText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, lineHeight: 18 },
  amountBox: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8EDF5",
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  amountLabel: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: "#0F172A", marginBottom: 8 },
  amountValue: { fontFamily: "Inter_700Bold", fontSize: 34, color: "#2563EB" },
  amountDivider: { height: 1, backgroundColor: "#E8EDF5", marginVertical: 12 },
  amountPlan: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#0F172A" },
  amountBilling: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#64748B", marginTop: 2 },

  formField: { marginBottom: 18 },
  notesFormField: { marginBottom: 24 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#334155", marginBottom: 8 },
  fieldHint: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 4 },
  textInput: { height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_500Medium" },
  textInputMultiline: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    textAlignVertical: "top",
  },

  submitBtn: {
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 24,
    shadowColor: "#F97316",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    paddingHorizontal: 20,
  },
  submitBtnText: { fontFamily: "Inter_700Bold", fontSize: 17, color: "#FFFFFF" },

  // Status screen
  statusIconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  statusTitle: { fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center", marginTop: 16 },
  statusSub: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22, marginTop: 8, marginBottom: 8 },
  infoCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 16, gap: 10 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { fontFamily: "Inter_400Regular", fontSize: 13 },
  infoValue: { fontFamily: "Inter_500Medium", fontSize: 13 },
  ctaBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  ctaBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
