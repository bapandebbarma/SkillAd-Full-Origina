import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Avatar } from "@/components/Avatar";
import { BookingModal } from "@/components/BookingModal";
import {
  fetchMessages,
  fetchProviderById,
  fetchProfileAvatar,
  sendMessage,
  SubscriptionInactiveError,
  subscribeToMessages,
  getOrCreateConversation,
  submitReview,
  markReviewRequestSubmitted,
  updateBookingStatus,
  recordEarning,
  API_BASE,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import {
  fetchPushTokenForProvider,
  fetchPushTokenByUserId,
  sendExpoPush,
  scheduleLocalNotification,
} from "@/lib/notifications";
import { addAppNotification } from "@/hooks/useNotifications";
import { getChatMessages, addChatMessage, generateId } from "@/lib/storage";
import type { ChatMessage, BookingCard, BookingStatus, Provider } from "@/lib/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Booking bubble ─────────────────────────────────────────────────────────────
function bookingStatusLabel(
  status: string | undefined,
  isMe: boolean,
  t: ReturnType<typeof useLanguage>["t"],
): { text: string; color: string } {
  switch (status) {
    case "accepted":                     return { text: t.bookingConfirmed,              color: "#10B981" };
    case "declined":                     return { text: t.bookingDeclined,                 color: "#EF4444" };
    case "provider_completed":           return { text: t.workDoneAwaiting, color: "#F59E0B" };
    case "customer_confirmed_completed": return { text: t.jobConfirmed,                  color: "#6366F1" };
    case "disputed":                     return { text: t.issueReported,                   color: "#EF4444" };
    default:                             return { text: isMe ? t.awaitingConfirmation : t.newBookingRequest, color: "#F59E0B" };
  }
}

function BookingBubble({
  booking,
  isMe,
  colors,
}: {
  booking: NonNullable<ChatMessage["booking"]>;
  isMe: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useLanguage();
  const { text: statusText, color: statusColor } = bookingStatusLabel(booking.status, isMe, t);
  return (
    <View
      style={[
        styles.bookingCard,
        { backgroundColor: colors.secondary, borderColor: colors.primary + "50" },
      ]}
    >
      <View style={styles.bookingHeader}>
        <View style={[styles.bookingIconWrap, { backgroundColor: colors.primary + "20" }]}>
          <Ionicons name="calendar" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bookingTitle, { color: colors.primary }]}>
            {isMe ? t.bookingRequestSent : t.bookingRequest}
          </Text>
          <Text style={[styles.bookingSubtitle, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>
      </View>
      <View style={[styles.bookingDivider, { backgroundColor: colors.border }]} />
      {(
        [
          [t.service, booking.service, false],
          [t.date, booking.date, false],
          [t.time, booking.time, false],
          [t.budget, booking.amount, true],
        ] as [string, string, boolean][]
      ).map(([k, v, highlight]) => (
        <View key={k} style={styles.bookingRow}>
          <Text style={[styles.bookingLabel, { color: colors.mutedForeground }]}>{k}</Text>
          <Text
            style={[
              styles.bookingValue,
              { color: highlight ? colors.primary : colors.foreground },
            ]}
          >
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Review request bubble ─────────────────────────────────────────────────────
function ReviewRequestBubble({
  msg,
  isMe,
  myId,
  myName,
  providerId,
  convId,
  colors,
}: {
  msg: ChatMessage;
  isMe: boolean;
  myId: string;
  myName: string;
  providerId: string;
  convId?: string;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Initialise from the persisted flag so the submitted state survives screen re-mounts
  const [submitted, setSubmitted] = useState(msg.reviewRequest?.reviewSubmitted ?? false);

  if (isMe) {
    // Provider sees "Review Submitted ✓" once the customer has rated; "Waiting…" otherwise.
    // Check both the persisted DB flag (msg.reviewRequest?.reviewSubmitted) and the local
    // state (submitted) — the local state updates instantly on the customer's device before
    // the server round-trip completes.
    const providerSubmitted = msg.reviewRequest?.reviewSubmitted ?? submitted;
    return (
      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: providerSubmitted ? "#10B98140" : colors.primary + "40" }]}>
        <View style={styles.reviewHeader}>
          <View style={[styles.reviewIconWrap, { backgroundColor: providerSubmitted ? "#10B98115" : colors.primary + "15" }]}>
            <Ionicons name={providerSubmitted ? "checkmark-circle" : "star"} size={16} color={providerSubmitted ? "#10B981" : colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reviewTitle, { color: providerSubmitted ? "#10B981" : colors.primary }]}>
              {providerSubmitted ? t.reviewSubmittedCheck : t.reviewRequestSent}
            </Text>
            <Text style={[styles.reviewSub, { color: colors.mutedForeground }]}>
              {providerSubmitted ? t.customerHasRated : t.waitingForCustomerRating}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: "#10B981" + "60" }]}>
        <View style={styles.reviewHeader}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={[styles.reviewTitle, { color: "#10B981", marginLeft: 8 }]}>{t.reviewSubmitted}</Text>
        </View>
        <Text style={[styles.reviewSub, { color: colors.mutedForeground, marginTop: 4 }]}>{t.thankYouFeedback}</Text>
      </View>
    );
  }

  const queryClient = useQueryClient();
  async function handleSubmitReview() {
    if (rating === 0) {
      Alert.alert(t.rateFirst, t.selectStarBeforeSubmit);
      return;
    }
    setSubmitting(true);
    const result = await submitReview(providerId, myId, myName, rating, comment.trim());
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["provider", providerId] });
      // Persist the submitted flag to Supabase via the API server (service-role, bypasses RLS)
      // so the provider's chat view also shows "Review Submitted ✓" on next load.
      if (convId) {
        markReviewRequestSubmitted(convId, msg.id).catch(() => {/* non-fatal */});
      }
    } else {
      Alert.alert(t.error, result.error ?? t.couldNotSubmitReview);
    }
  }

  return (
    <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }]}>
      <View style={styles.reviewHeader}>
        <View style={[styles.reviewIconWrap, { backgroundColor: colors.primary + "15" }]}>
          <Ionicons name="star" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reviewTitle, { color: colors.foreground }]}>{t.howWasExperience}</Text>
          <Text style={[styles.reviewSub, { color: colors.mutedForeground }]}>{t.shareYourFeedback}</Text>
        </View>
      </View>
      <View style={[styles.reviewDivider, { backgroundColor: colors.border }]} />
      {/* Star row */}
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
            <Ionicons
              name={s <= rating ? "star" : "star-outline"}
              size={28}
              color={s <= rating ? "#F59E0B" : colors.mutedForeground}
            />
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={[styles.reviewInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        placeholder={t.writeCommentOptional}
        placeholderTextColor={colors.mutedForeground}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={300}
      />
      <TouchableOpacity
        style={[
          styles.reviewSubmitBtn,
          { backgroundColor: submitting ? colors.muted : colors.primary },
        ]}
        onPress={handleSubmitReview}
        disabled={submitting}
        activeOpacity={0.8}
      >
        <Text style={[styles.reviewSubmitText, { color: "#FFFFFF" }]}>
          {submitting ? t.submitting : t.submitReview}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Work Completed token bubble ────────────────────────────────────────────────
// Sent by the provider to signal work is done.
// Customer responds with Approve Completion or Report Issue.
function WorkCompletedBubble({
  isMe,
  workCompleted,
  bookingStatus,
  onApprove,
  onReportIssue,
  colors,
}: {
  isMe: boolean;
  workCompleted: NonNullable<ChatMessage["workCompleted"]>;
  bookingStatus: BookingStatus | undefined;
  onApprove: () => void;
  onReportIssue: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useLanguage();
  const isApproved = bookingStatus === "customer_confirmed_completed";
  const isDisputed = bookingStatus === "disputed";

  if (isMe) {
    return (
      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: "#10B98140" }]}>
        <View style={styles.reviewHeader}>
          <View style={[styles.reviewIconWrap, { backgroundColor: "#10B98115" }]}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reviewTitle, { color: "#10B981" }]}>{t.workCompleted}</Text>
            <Text style={[styles.reviewSub, { color: colors.mutedForeground }]}>
              {isApproved  ? t.customerApprovedEarnings
               : isDisputed ? t.customerReportedIssue
               : t.awaitingCustomerConfirmation}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (isApproved) {
    return (
      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: "#10B98160" }]}>
        <View style={styles.reviewHeader}>
          <Ionicons name="checkmark-circle" size={22} color="#10B981" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[styles.reviewTitle, { color: "#10B981" }]}>{t.completionApproved}</Text>
            <Text style={[styles.reviewSub, { color: colors.mutedForeground }]}>{t.paymentReleased}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (isDisputed) {
    return (
      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: "#EF444440" }]}>
        <View style={styles.reviewHeader}>
          <Ionicons name="alert-circle" size={22} color="#EF4444" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[styles.reviewTitle, { color: "#EF4444" }]}>{t.issueReported}</Text>
            <Text style={[styles.reviewSub, { color: colors.mutedForeground }]}>{t.resolveWithProvider}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: "#F59E0B40" }]}>
      <View style={styles.reviewHeader}>
        <View style={[styles.reviewIconWrap, { backgroundColor: "#F59E0B15" }]}>
          <Ionicons name="checkmark-circle" size={16} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reviewTitle, { color: colors.foreground }]}>{t.workCompleted}</Text>
          <Text style={[styles.reviewSub, { color: colors.mutedForeground }]}>{t.providerSaysWorkDone}</Text>
        </View>
      </View>
      <View style={[styles.reviewDivider, { backgroundColor: colors.border }]} />
      <View style={styles.bookingRow}>
        <Text style={[styles.bookingLabel, { color: colors.mutedForeground }]}>{t.service}</Text>
        <Text style={[styles.bookingValue, { color: colors.foreground }]}>{workCompleted.service}</Text>
      </View>
      <View style={styles.bookingRow}>
        <Text style={[styles.bookingLabel, { color: colors.mutedForeground }]}>{t.amount}</Text>
        <Text style={[styles.bookingValue, { color: colors.primary }]}>{workCompleted.amount}</Text>
      </View>
      <View style={[styles.bookingActionRow, { marginTop: 10 }]}>
        <TouchableOpacity
          style={[styles.bookingDeclineBtn, { borderColor: "#EF444460", flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" }]}
          onPress={() =>
            Alert.alert(t.reportIssue, t.reportIssueConfirm, [
              { text: t.cancel, style: "cancel" },
              { text: t.reportIssue, style: "destructive", onPress: onReportIssue },
            ])
          }
          activeOpacity={0.7}
        >
          <Ionicons name="alert-circle-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
          <Text style={[styles.bookingDeclineBtnText, { color: "#EF4444" }]}>{t.reportIssue}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bookingAcceptBtn, { backgroundColor: "#10B981", flex: 1 }]}
          onPress={() =>
            Alert.alert(t.approveCompletion, t.approveCompletionConfirm, [
              { text: t.cancel, style: "cancel" },
              { text: t.approve, onPress: onApprove },
            ])
          }
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          <Text style={styles.bookingAcceptBtnText}>{t.approve}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, supabaseUserId } = useAuth();
  const { t } = useLanguage();
  const {
    id,
    convId: paramConvId,
    name,
    phone,
    initials,
    avatarColor,
    avatarUrl,
    verified,
    category,
  } = useLocalSearchParams<{
    id: string;
    convId?: string;
    name: string;
    phone?: string;
    initials: string;
    avatarColor: string;
    avatarUrl?: string;
    verified?: "true" | "false";
    category: string;
  }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [convId, setConvId] = useState<string | null>(paramConvId ?? null);
  const [usingRealtime, setUsingRealtime] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [providerData, setProviderData] = useState<Provider | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [providerPushToken, setProviderPushToken] = useState<string | null>(null);
  const channelRef    = useRef<any>(null);
  const isSendingWC   = useRef(false);   // double-tap guard for Work Completed token
  const localConvId = `conv_${id}`;

  // Is the currently logged-in user the PROVIDER in this conversation?
  // Simple rule: if the authenticated user has isProvider=true, they are always the
  // provider side. When a provider opens a chat from the Messages tab, `id` is the
  // customer's UUID (not the provider's), so the old multi-case check always failed.
  const isProviderUser = !!(supabaseUserId && user?.isProvider);

  // Can the user interact with the input?
  const isLoggedIn = !!(user);
  const headerName = (name ?? "").trim() || providerData?.name || t.user;
  const headerAvatarUrl = avatarUrl || profileAvatarUrl || providerData?.avatarUrl || undefined;
  const headerVerified = verified === "true" || (!!providerData?.verified && verified !== "false");

  useEffect(() => {
    async function init() {
      // ── Step 1: Show cached messages instantly (zero network delay) ──────────
      const cached = await getChatMessages(localConvId);
      if (cached.length > 0) setMessages(cached);

      // ── Step 2: Kick off provider + push-token fetches in the background ─────
      // These do NOT block message loading — they update state when they resolve.
      if (id) {
        fetchProviderById(id)
          .then(async (p) => {
            if (p) {
              setProviderData(p);
              // Gap #3 fix: always fetch profiles.avatar_url — it is the single source of truth
              const fromProfile = await fetchProfileAvatar(p.userId ?? id);
              if (fromProfile) setProfileAvatarUrl(fromProfile);
            } else {
              const fromProfile = await fetchProfileAvatar(id);
              if (fromProfile) setProfileAvatarUrl(fromProfile);
            }
          })
          .catch(() => {});
        fetchPushTokenForProvider(id)
          .then(async (t) => {
            if (t) {
              setProviderPushToken(t);
            } else {
              // id is a customer profile UUID (provider opened this chat).
              // fetchPushTokenForProvider expects a provider record ID and returns
              // null for plain profile UUIDs, so fall back to a direct profile lookup.
              const direct = await fetchPushTokenByUserId(id);
              if (direct) setProviderPushToken(direct);
            }
          })
          .catch(() => {});
      }

      // ── Step 3: Real-time path (runs in parallel with provider fetch) ─────────
      console.log("[chat:init] supabaseUserId=" + (supabaseUserId ?? "null") + " id=" + (id ?? "null") + " convId=" + (convId ?? "null"));
      if (!supabaseUserId || !id) {
        console.warn("[chat:init] GATE-1 BLOCKED — supabaseUserId=" + (supabaseUserId ?? "null") + " → usingRealtime stays false");
        return;
      }

      let cid = convId;
      if (!cid) {
        try {
          cid = await getOrCreateConversation(supabaseUserId, id);
          console.log("[chat:init] getOrCreateConversation →", cid ?? "null");
          if (cid) setConvId(cid);
        } catch (e) {
          // getOrCreateConversation failed — fall back to cached messages already shown
          console.error("[chat:init] GATE-2 BLOCKED — getOrCreateConversation threw:", e);
          return;
        }
      }
      if (!cid) {
        console.warn("[chat:init] GATE-3 BLOCKED — cid is null after getOrCreate → usingRealtime stays false");
        return;
      }

      try {
        const serverMsgs = await fetchMessages(cid);
        if (serverMsgs.length > 0) setMessages(serverMsgs);
      } catch {
        // Network error — keep the cached messages shown in step 1
      }
      console.log("[chat:init] ALL GATES PASSED → setUsingRealtime(true) convId=" + cid);
      setUsingRealtime(true);
      channelRef.current = subscribeToMessages(
        cid,
        (newMsg) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
          // FIX-C: in-app notification for the recipient (not the sender)
          if (supabaseUserId && newMsg.senderId !== supabaseUserId) {
            const isBookingMsg = newMsg.type === "booking";
            addAppNotification({
              title: isBookingMsg ? `📅 ${t.newBookingRequestTitle}` : `💬 ${t.newMessage}`,
              body: isBookingMsg
                ? t.sentBookingRequest.replace("{name}", name ?? t.customer)
                : typeof newMsg.text === "string" && newMsg.text.length > 80
                ? newMsg.text.slice(0, 80) + "…"
                : newMsg.text ?? "",
              type: isBookingMsg ? "booking" : "message",
              data: { providerId: id, senderName: name, conversationId: cid },
            });
          }
        },
        (msgId, status) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId && m.type === "booking" && m.booking
                ? { ...m, booking: { ...m.booking, status: status as any } }
                : m
            )
          );
        },
      );
    }
    init();
    return () => {
      if (channelRef.current) channelRef.current.unsubscribe();
    };
  }, [supabaseUserId, id]);

  // ── Polling fallback (every 5s) — safety net if Supabase Realtime WS drops ──
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!usingRealtime || !convId || !supabaseUserId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const fresh = await fetchMessages(convId);
        setMessages((prev) => {
          const freshById = new Map(fresh.map((m) => [m.id, m]));
          const prevIds = new Set(prev.map((m) => m.id));
          const brandNew = fresh.filter((m) => !prevIds.has(m.id));
          // Also refresh booking messages whose status changed
          let anyStatusChange = false;
          const updated = prev.map((m) => {
            if (m.type !== "booking") return m;
            const refreshed = freshById.get(m.id);
            if (refreshed && refreshed.booking?.status !== m.booking?.status) {
              anyStatusChange = true;
              return refreshed;
            }
            return m;
          });
          if (brandNew.length === 0 && !anyStatusChange) return prev;
          return [...brandNew, ...updated];
        });
      } catch {
        // Silently swallow — realtime is still the primary path
      }
    }, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [usingRealtime, convId, supabaseUserId]);

  // ── Send text message ────────────────────────────────────────────────────────
  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setText("");

    console.log("[chat:send] usingRealtime=" + usingRealtime + " convId=" + (convId ?? "null") + " supabaseUserId=" + (supabaseUserId ?? "null") + " isLoggedIn=" + isLoggedIn);
    if (usingRealtime && convId && supabaseUserId) {
      console.log("[chat:send] → REAL PATH (API + Supabase)");
      const optimisticId = generateId();
      const optimistic: ChatMessage = {
        id: optimisticId,
        senderId: supabaseUserId,
        text: trimmed,
        timestamp: new Date().toISOString(),
        read: false,
        type: "text",
      };
      setMessages((prev) => [optimistic, ...prev]);
      const sent = await sendMessage(convId, supabaseUserId, trimmed);
      // Replace optimistic local ID with real Supabase UUID so the realtime
      // subscription dedup check finds it and doesn't insert a duplicate.
      if (sent?.id) {
        setMessages((prev) => prev.map((m) => m.id === optimisticId ? { ...m, id: sent.id } : m));
      }
      // FIX-A: client-side secondary push (server is primary; fires when token locally known)
      if (providerPushToken && sent) {
        // providerId in the payload is the ID the RECIPIENT uses to open /chat/[id].
        // Customer → Provider: recipient (provider) opens /chat/[customer UUID].
        // Provider → Customer: recipient (customer) opens /chat/[provider record ID].
        const recipientChatId = user?.isProvider
          ? (user?.providerId ?? supabaseUserId ?? undefined)
          : (supabaseUserId ?? undefined);
        sendExpoPush(providerPushToken, {
          title: `💬 ${user?.name ?? t.message}`,
          body: trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed,
          data: {
            type: "message",
            conversationId: convId,
            providerId: recipientChatId,
            senderName: user?.name ?? t.user,
          },
        });
      }
    } else if (isLoggedIn) {
      console.warn("[chat:send] → LOCAL FALLBACK PATH (AsyncStorage only — message will NOT reach Supabase)");
      // Authenticated but no Supabase realtime — save locally
      const msg: ChatMessage = {
        id: generateId(),
        senderId: user!.id,
        text: trimmed,
        timestamp: new Date().toISOString(),
        read: false,
        type: "text",
      };
      const updated = await addChatMessage(localConvId, msg);
      setMessages(updated);
    }
  }

  // ── Send booking ─────────────────────────────────────────────────────────────
  async function handleSendBooking(booking: BookingCard) {
    setBookingOpen(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const summaryText = t.bookingRequestSummary
      .replace("{service}", booking.service)
      .replace("{date}", booking.date)
      .replace("{time}", booking.time)
      .replace("{amount}", booking.amount);
    const customerName = user?.name ?? t.customer;

    if (providerPushToken) {
      sendExpoPush(providerPushToken, {
        title: `📅 ${t.newBookingRequestTitle}`,
        body: t.wantsToBook
          .replace("{name}", customerName)
          .replace("{service}", booking.service)
          .replace("{date}", booking.date)
          .replace("{time}", booking.time),
        data: { type: "booking", ...booking, customerName },
      });
    }

    addAppNotification({
      title: t.bookingRequestSent,
      body: t.bookingRequestSentBody
        .replace("{service}", booking.service)
        .replace("{date}", booking.date)
        .replace("{time}", booking.time)
        .replace("{name}", name ?? ""),
      type: "booking",
      data: { booking },
    });

    scheduleLocalNotification({
      title: t.bookingSent,
      body: t.requestSentToProvider
        .replace("{service}", booking.service)
        .replace("{date}", booking.date)
        .replace("{name}", name ?? ""),
      data: { type: "booking" },
    });

    const msgBase: ChatMessage = {
      id: generateId(),
      senderId: supabaseUserId ?? user?.id ?? "user",
      text: summaryText,
      timestamp: new Date().toISOString(),
      read: false,
      type: "booking",
      booking,
    };

    if (usingRealtime && convId && supabaseUserId) {
      setMessages((prev) => [msgBase, ...prev]);
      try {
        const sent = await sendMessage(convId, supabaseUserId, summaryText, "booking", booking);
        if (sent?.id) {
          setMessages((prev) => prev.map((m) => m.id === msgBase.id ? { ...m, id: sent.id } : m));
        }
      } catch (e) {
        if (e instanceof SubscriptionInactiveError) {
          // Remove the optimistically added message
          setMessages((prev) => prev.filter((m) => m.id !== msgBase.id));
          Alert.alert(
            t.bookingUnavailable,
            t.providerNotAcceptingBookings.replace("{name}", name ?? t.provider),
            [{ text: t.ok }],
          );
        }
      }
    } else {
      const updated = await addChatMessage(localConvId, msgBase);
      setMessages(updated);
    }
  }

  // ── Booking management (provider side) ──────────────────────────────────────
  function notifyCustomerOfBookingStatus(
    customerId: string,
    status: BookingStatus,
    service: string,
  ): void {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token;
      if (!token) return;
      fetch(`${API_BASE}/bookings/notify-customer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId,
          status,
          providerName: user?.name ?? t.provider,
          service,
        }),
      }).catch(() => {});
    }).catch(() => {});
  }

  function handleBookingAccept(msgId: string, booking: NonNullable<ChatMessage["booking"]>) {
    // Only handles pending → accepted. Work completion is done via the Work Completed token.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.booking
          ? { ...m, booking: { ...m.booking, status: "accepted" as BookingStatus } }
          : m,
      ),
    );
    updateBookingStatus(msgId, "accepted").catch((err: Error) => {
      console.error("[booking] accept failed:", err.message);
      // Revert optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.booking
            ? { ...m, booking: { ...m.booking, status: "pending" as BookingStatus } }
            : m,
        ),
      );
      Alert.alert(t.failedToAccept, err.message);
    });
    notifyCustomerOfBookingStatus(id, "accepted", booking.service);
  }

  // ── Provider sends Work Completed token ──────────────────────────────────────
  async function handleProviderSendWorkCompleted() {
    // Double-tap guard
    if (isSendingWC.current) return;

    const acceptedBookingMsg = messages.find(
      (m) => m.type === "booking" && m.booking?.status === "accepted",
    );
    if (!acceptedBookingMsg?.booking) {
      Alert.alert(t.noActiveBooking, t.noAcceptedBookingDesc);
      return;
    }

    // Block if a Work Completed token already exists for this booking
    const alreadySentWC = messages.some(
      (m) => m.type === "work_completed" && m.workCompleted?.bookingMsgId === acceptedBookingMsg.id,
    );
    if (alreadySentWC) {
      Alert.alert(t.alreadySent, t.workCompletedAlreadySent);
      return;
    }

    isSendingWC.current = true;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const wcPayload: NonNullable<ChatMessage["workCompleted"]> = {
      bookingMsgId: acceptedBookingMsg.id,
      service:      acceptedBookingMsg.booking.service,
      amount:       acceptedBookingMsg.booking.amount,
      amountValue:  acceptedBookingMsg.booking.amountValue,
    };

    const workCompletedMsg: ChatMessage = {
      id:           generateId(),
      senderId:     supabaseUserId ?? user?.id ?? "provider",
      text:         t.workCompletedFor.replace("{service}", acceptedBookingMsg.booking.service),
      timestamp:    new Date().toISOString(),
      read:         false,
      type:         "work_completed",
      workCompleted: wcPayload,
    };

    // Optimistically update booking status + prepend the new token
    setMessages((prev) => [
      workCompletedMsg,
      ...prev.map((m) =>
        m.id === acceptedBookingMsg.id && m.booking
          ? { ...m, booking: { ...m.booking, status: "provider_completed" as BookingStatus } }
          : m,
      ),
    ]);

    updateBookingStatus(acceptedBookingMsg.id, "provider_completed").catch((err: Error) => {
      console.error("[booking] provider_completed failed:", err.message);
      Alert.alert(t.failedToMarkComplete, err.message);
    });
    notifyCustomerOfBookingStatus(id, "provider_completed", acceptedBookingMsg.booking.service);

    try {
      if (usingRealtime && convId && supabaseUserId) {
        const sent = await sendMessage(convId, supabaseUserId, workCompletedMsg.text, "work_completed", wcPayload as any);
        if (sent?.id) {
          setMessages((prev) => prev.map((m) => m.id === workCompletedMsg.id ? { ...m, id: sent.id } : m));
        }
      } else {
        const updated = await addChatMessage(localConvId, workCompletedMsg);
        setMessages(updated);
      }
    } finally {
      isSendingWC.current = false;
    }
  }

  // ── Customer approves completion (triggered from WorkCompletedBubble) ─────────
  function handleCustomerApproveCompletion(workCompleted: NonNullable<ChatMessage["workCompleted"]>) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === workCompleted.bookingMsgId && m.booking
          ? { ...m, booking: { ...m.booking, status: "customer_confirmed_completed" as BookingStatus } }
          : m,
      ),
    );
    updateBookingStatus(workCompleted.bookingMsgId, "customer_confirmed_completed").catch((err: Error) => {
      console.error("[booking] customer_confirmed_completed failed:", err.message);
      Alert.alert(t.failedToApprove, err.message);
    });

    // Record earning for the provider — id (route param) = provider's record/user ID
    if (supabaseUserId) {
      const amountNum =
        typeof workCompleted.amountValue === "number" && workCompleted.amountValue > 0
          ? workCompleted.amountValue
          : parseFloat((workCompleted.amount ?? "0").replace(/[^\d.]/g, "")) || 0;
      const custInitials = (user?.name ?? "C")
        .split(" ")
        .map((w: string) => w[0] ?? "")
        .join("")
        .toUpperCase()
        .slice(0, 2) || "C";
      recordEarning({
        bookingId:           workCompleted.bookingMsgId,
        providerId:          id,
        amount:              amountNum,
        service:             workCompleted.service,
        customerName:        user?.name ?? t.customer,
        customerInitials:    custInitials,
        customerAvatarColor: "#64748B",
        customerAvatarUrl:   user?.avatarUrl ?? null,
        conversationId:      convId ?? "",
      }).catch(() => {});
    }
  }

  // ── Customer reports issue (triggered from WorkCompletedBubble) ───────────────
  function handleCustomerReportIssue(bookingMsgId: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === bookingMsgId && m.booking
          ? { ...m, booking: { ...m.booking, status: "disputed" as BookingStatus } }
          : m,
      ),
    );
    updateBookingStatus(bookingMsgId, "disputed").catch((err: Error) => {
      console.error("[booking] disputed failed:", err.message);
    });
    Alert.alert(t.issueReported, t.issueNotedContactProvider);
  }

  function handleBookingDecline(msgId: string, booking: NonNullable<ChatMessage["booking"]>) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(t.declineBooking, t.declineThisBookingConfirm, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.decline,
        style: "destructive",
        onPress: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId && m.booking
                ? { ...m, booking: { ...m.booking, status: "declined" } }
                : m,
            ),
          );
          updateBookingStatus(msgId, "declined").catch((err: Error) => {
            console.error("[booking] decline failed:", err.message);
            // Revert optimistic update
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId && m.booking
                  ? { ...m, booking: { ...m.booking, status: "pending" as BookingStatus } }
                  : m,
              ),
            );
            Alert.alert(t.failedToDecline, err.message);
          });
          notifyCustomerOfBookingStatus(id, "declined", booking.service);
        },
      },
    ]);
  }

  // ── Delete message (long press) ─────────────────────────────────────────────
  const handleDeleteMessage = useCallback((msgId: string, senderId: string) => {
    const myCurrentId = supabaseUserId ?? user?.id ?? "user";
    if (senderId !== myCurrentId && senderId !== "user") return; // can only delete own messages
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t.deleteMessage,
      t.removeThisMessage,
      [
        { text: t.cancel, style: "cancel" },
        {
          text: t.delete,
          style: "destructive",
          onPress: () => {
            setMessages((prev) => prev.filter((m) => m.id !== msgId));
          },
        },
      ],
    );
  }, [supabaseUserId, user?.id, t]);

  // ── Send rating request (provider → customer) ────────────────────────────────
  async function handleSendReviewRequest() {
    // Block if a Rate & Review token has already been sent in this conversation
    if (messages.some((m) => m.type === "review_request")) {
      Alert.alert(t.alreadySent, t.rateReviewAlreadySent);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Notify the customer via push so they know to open the chat and rate
    if (providerPushToken) {
      sendExpoPush(providerPushToken, {
        title: `⭐ ${t.rateYourExperience}`,
        body: t.askedYouToRate.replace("{name}", user?.name ?? t.provider),
        data: { type: "review_request" },
      });
    }

    const reviewReqMsg: ChatMessage = {
      id: generateId(),
      senderId: supabaseUserId ?? user?.id ?? "provider",
      text: t.pleaseRateExperience,
      timestamp: new Date().toISOString(),
      read: false,
      type: "review_request",
      reviewRequest: { providerId: id, providerName: name ?? t.provider },
    };

    if (usingRealtime && convId && supabaseUserId) {
      setMessages((prev) => [reviewReqMsg, ...prev]);
      const sent = await sendMessage(convId, supabaseUserId, reviewReqMsg.text, "review_request", undefined);
      if (sent?.id) {
        setMessages((prev) => prev.map((m) => m.id === reviewReqMsg.id ? { ...m, id: sent.id } : m));
      }
    } else {
      const updated = await addChatMessage(localConvId, reviewReqMsg);
      setMessages(updated);
    }

    Alert.alert(t.ratingRequestSent, t.customerPromptedToRate);
  }


  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const myId = supabaseUserId ?? user?.id ?? "user";

  // Block new booking only when an active booking exists (pending or accepted).
  // Allow re-booking after declined, completed, or disputed.
  const hasExistingBooking = messages.some(
    (m) =>
      m.type === "booking" &&
      !["declined", "customer_confirmed_completed", "disputed"].includes(m.booking?.status ?? ""),
  );
  // "Rate & Review" button (provider-only): only after customer confirms completion.
  const hasCompletedBooking = messages.some(
    (m) => m.type === "booking" && m.booking?.status === "customer_confirmed_completed",
  );
  // Hide ⭐ button once any review_request token has been sent (one per booking).
  const hasReviewRequestSent = messages.some((m) => m.type === "review_request");
  // "Work Done" token button (provider-only): only when there is an accepted booking.
  const hasAcceptedBooking = messages.some(
    (m) => m.type === "booking" && m.booking?.status === "accepted",
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.chatHeader,
          {
            paddingTop: topPad + 10,
            backgroundColor: "#FFFFFF",
            borderBottomColor: "#E8EDF5",
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Avatar
          initials={initials ?? "?"}
          color={avatarColor ?? "#64748B"}
          size={50}
          fontSize={16}
          imageUri={headerAvatarUrl}
        />
        <View style={styles.headerInfo}>
          <View style={styles.headerNameRow}>
            <Text style={[styles.headerName, { color: colors.foreground }]}>{headerName}</Text>
            {headerVerified && (
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={styles.verifiedIcon} />
            )}
          </View>
          <View style={styles.onlineRow}>
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: usingRealtime ? "#10B981" : colors.mutedForeground },
              ]}
            />
            <Text
              style={[
                styles.onlineText,
                { color: usingRealtime ? "#10B981" : colors.mutedForeground },
              ]}
            >
              {usingRealtime ? t.connected : isLoggedIn ? t.offlineMode : t.signInToChat}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {isLoggedIn ? t.noMessagesYet : t.signInToStartMessaging}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {isLoggedIn
                  ? t.sendMessageToStart
                  : t.createAccountToMessage}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe =
              item.senderId !== "provider" &&
              (item.senderId === myId || item.senderId === user?.id);

            if (item.type === "booking" && item.booking) {
              const booking = item.booking;
              const isPending = booking.status === "pending" || !booking.status;
              const showProviderActions = isProviderUser && !isMe;
              return (
                <View style={[styles.bookingWrap, isMe && styles.bookingWrapMe]}>
                  <BookingBubble booking={booking} isMe={isMe} colors={colors} />

                  {showProviderActions && isPending && (
                    <View style={styles.bookingActionRow}>
                      <TouchableOpacity
                        style={[styles.bookingDeclineBtn, { borderColor: "#EF444460" }]}
                        onPress={() => handleBookingDecline(item.id, booking)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.bookingDeclineBtnText}>{t.decline}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.bookingAcceptBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleBookingAccept(item.id, booking)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        <Text style={styles.bookingAcceptBtnText}>{t.accept}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text
                    style={[
                      styles.msgTime,
                      { color: colors.mutedForeground, textAlign: isMe ? "right" : "left" },
                    ]}
                  >
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
              );
            }

            if (item.type === "review_request") {
              return (
                <View style={[styles.bookingWrap, isMe && styles.bookingWrapMe]}>
                  <ReviewRequestBubble
                    msg={item}
                    isMe={isMe}
                    myId={myId}
                    myName={user?.name ?? t.customer}
                    providerId={id}
                    convId={convId ?? undefined}
                    colors={colors}
                  />
                  <Text
                    style={[
                      styles.msgTime,
                      { color: colors.mutedForeground, textAlign: isMe ? "right" : "left" },
                    ]}
                  >
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
              );
            }

            if (item.type === "work_completed" && item.workCompleted) {
              const wc = item.workCompleted;
              const refBookingStatus = messages.find((m) => m.id === wc.bookingMsgId)?.booking?.status;
              return (
                <View style={[styles.bookingWrap, isMe && styles.bookingWrapMe]}>
                  <WorkCompletedBubble
                    isMe={isMe}
                    workCompleted={wc}
                    bookingStatus={refBookingStatus}
                    onApprove={() => handleCustomerApproveCompletion(wc)}
                    onReportIssue={() => handleCustomerReportIssue(wc.bookingMsgId)}
                    colors={colors}
                  />
                  <Text
                    style={[
                      styles.msgTime,
                      { color: colors.mutedForeground, textAlign: isMe ? "right" : "left" },
                    ]}
                  >
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
              );
            }

            return (
              <TouchableOpacity
                activeOpacity={0.92}
                onLongPress={() => handleDeleteMessage(item.id, item.senderId)}
                delayLongPress={400}
                style={[styles.msgRow, isMe && styles.msgRowMe]}
              >
                {!isMe && (
                  <Avatar
                    initials={initials ?? "?"}
                    color={avatarColor ?? "#64748B"}
                    imageUri={profileAvatarUrl ?? providerData?.avatarUrl ?? (avatarUrl || undefined)}
                    size={28}
                    fontSize={10}
                  />
                )}
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isMe ? colors.primary : colors.card,
                      borderWidth: isMe ? 0 : 1,
                      borderColor: isMe ? "transparent" : "#E8EDF5",
                    },
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: isMe ? "#FFFFFF" : colors.foreground }]}>
                    {item.text}
                  </Text>
                </View>
                {isMe && (
                  <Ionicons
                    name={item.read ? "checkmark-done" : "checkmark"}
                    size={12}
                    color={item.read ? colors.primary : colors.mutedForeground}
                    style={{ alignSelf: "flex-end", marginLeft: 2 }}
                  />
                )}
              </TouchableOpacity>
            );
          }}
        />

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 10,
            },
          ]}
        >
          {/* Booking button — only for customers, hidden once a booking token exists (one per conv) */}
          {!isProviderUser && !user?.isProvider && !hasExistingBooking && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => setBookingOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* Work Done token — provider-only, only when there is an accepted booking */}
          {(isProviderUser || user?.isProvider) && hasAcceptedBooking && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#D1FAE5", borderColor: "#10B98140" }]}
              onPress={handleProviderSendWorkCompleted}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            </TouchableOpacity>
          )}

          {/* Rate & Review token — provider-only, once per booking after customer confirms completion */}
          {(isProviderUser || user?.isProvider) && hasCompletedBooking && !hasReviewRequestSent && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B40" }]}
              onPress={handleSendReviewRequest}
              activeOpacity={0.7}
            >
              <Ionicons name="star" size={20} color="#F59E0B" />
            </TouchableOpacity>
          )}

          <View
            style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder={
                isLoggedIn
                  ? t.typeAMessage
                  : t.signInToMessage
              }
              placeholderTextColor="#94A3B8"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
              editable={isLoggedIn}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: text.trim() && isLoggedIn ? colors.primary : colors.muted },
            ]}
            onPress={handleSend}
            disabled={!text.trim() || !isLoggedIn}
          >
            <Ionicons
              name="send"
              size={24}
              color={text.trim() && isLoggedIn ? "#FFFFFF" : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <BookingModal
        visible={bookingOpen}
        providerName={name ?? t.provider}
        providerServices={providerData?.services ?? []}
        onClose={() => setBookingOpen(false)}
        onSend={handleSendBooking}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { width: 36, alignItems: "center" },
  headerInfo: { flex: 1 },
  headerNameRow: { flexDirection: "row", alignItems: "center" },
  headerName: { fontFamily: "Inter_600SemiBold", fontSize: 20 },
  verifiedIcon: { marginLeft: 6 },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  bookingHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bookingHeaderBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  msgList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: "75%",
    alignSelf: "flex-start",
    marginVertical: 1,
  },
  msgRowMe: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  bubble: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  bookingWrap: {
    alignItems: "flex-start",
    marginVertical: 4,
    maxWidth: "90%",
    alignSelf: "flex-start",
  },
  bookingWrapMe: { alignSelf: "flex-end", alignItems: "flex-end" },
  bookingActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    alignSelf: "stretch",
  },
  bookingDeclineBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bookingDeclineBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#EF4444",
  },
  bookingAcceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 10,
    paddingVertical: 8,
  },
  bookingAcceptBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  bookingDoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 6,
    alignSelf: "stretch",
  },
  bookingCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
    minWidth: 240,
  },
  bookingHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  bookingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bookingTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  bookingSubtitle: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  bookingDivider: { height: 1, marginVertical: 2 },
  bookingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bookingLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  bookingValue: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  // Review request
  reviewCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 10,
    minWidth: 240,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  reviewSub: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  reviewDivider: { height: 1 },
  starRow: { flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 4 },
  reviewInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    minHeight: 64,
    textAlignVertical: "top",
  },
  reviewSubmitBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  reviewSubmitText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  // Input bar
  msgTime: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 3 },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    minHeight: 53,
    borderRadius: 28,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderColor: "#E8EDF5",
    paddingHorizontal: 18,
    paddingVertical: 8,
    maxHeight: 100,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  input: { fontFamily: "Inter_400Regular", fontSize: 15, paddingLeft: 2 },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
