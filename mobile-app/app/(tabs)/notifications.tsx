import React, { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import {
  useNotificationStore,
  markAllRead,
  markRead,
  dismissNotification,
  syncAdminNotifications,
  initNotificationStore,
  type AppNotification,
} from "@/hooks/useNotifications";
import { useAuth } from "@/context/AuthContext";

type NotifIconStyle = {
  name: string;
  color: string;
  backgroundColor: string;
};

function notifIcon(item: AppNotification): NotifIconStyle {
  const title = (item.title ?? "").toLowerCase();
  const body = (item.body ?? "").toLowerCase();
  const data = (item.data ?? {}) as Record<string, unknown>;
  const status = String(data.status ?? "").toLowerCase();
  const notifType = String(data.notifType ?? data.type ?? "").toLowerCase();
  const source = String(data.source ?? "").toLowerCase();

  const fallback: NotifIconStyle = {
    name: "notifications",
    color: "#64748B",
    backgroundColor: "#E2E8F0",
  };

  if (title.includes("welcome")) {
    return { name: "heart", color: "#9333EA", backgroundColor: "#F3E8FF" };
  }

  if (
    title.includes("payment released") ||
    body.includes("payment has been released") ||
    body.includes("payment released") ||
    status === "customer_confirmed_completed" ||
    (title.includes("job confirmed") && body.includes("earning"))
  ) {
    return { name: "cash", color: "#059669", backgroundColor: "#DCFCE7" };
  }

  if (title.includes("work completed") || status === "provider_completed") {
    return { name: "briefcase", color: "#D97706", backgroundColor: "#FEF3C7" };
  }

  if (title.includes("booking accepted") || status === "accepted") {
    return { name: "checkmark-circle", color: "#16A34A", backgroundColor: "#DCFCE7" };
  }

  if (
    item.type === "review" ||
    notifType === "review_request" ||
    title.includes("rate your") ||
    title.includes("review request") ||
    title.includes("rate & review") ||
    title.includes("new review")
  ) {
    return { name: "star", color: "#F59E0B", backgroundColor: "#FEF3C7" };
  }

  if (
    title.includes("new booking request") ||
    title.includes("new booking") ||
    title.includes("booking request") ||
    (item.type === "booking" && source !== "booking_update")
  ) {
    return { name: "calendar", color: "#2563EB", backgroundColor: "#DBEAFE" };
  }

  if (item.type === "system" || item.type === "subscription") {
    return fallback;
  }

  return fallback;
}

function getTime(n: AppNotification, justNow: string): string {
  return formatTimeAgo(n.timestamp, justNow);
}

function formatTimeAgo(iso: string, justNow: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return justNow;
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotifRow({
  item,
  onPress,
  onDismiss,
  colors,
  justNow,
}: {
  item: AppNotification;
  onPress: () => void;
  onDismiss: () => void;
  colors: ReturnType<typeof useColors>;
  justNow: string;
}) {
  const icon = notifIcon(item);
  const time = getTime(item, justNow);

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.notifRowInner}
          onPress={onPress}
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: icon.backgroundColor }]}>
            <Ionicons name={icon.name as any} size={20} color={icon.color} />
          </View>
          <View style={styles.notifContent}>
            <View style={styles.notifTop}>
              <View style={styles.titleRow}>
                <Text style={styles.notifTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.read && (
                  <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                )}
              </View>
              <Text style={styles.notifTime}>{time}</Text>
            </View>
            <Text style={styles.notifBody} numberOfLines={2}>
              {item.body}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={onDismiss}
          hitSlop={6}
          activeOpacity={0.75}
        >
          <Ionicons name="close" size={14} color="#64748B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { supabaseUserId } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const notifications = useNotificationStore();

  // Load persisted notifications on mount, then sync from server every 10 s
  useEffect(() => {
    void initNotificationStore().then(() => {
      void syncAdminNotifications(supabaseUserId ?? undefined);
    });
    const interval = setInterval(
      () => void syncAdminNotifications(supabaseUserId ?? undefined),
      10_000,
    );
    return () => clearInterval(interval);
  }, [supabaseUserId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleMarkAll() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllRead();
  }

  function handlePress(item: AppNotification) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markRead(item.id);
    if (item.type === "booking") {
      const source = (item.data as any)?.source;
      // booking_update = status change sent to customer → stay on notifications
      // plain booking = new booking request arriving at provider → go to dashboard
      if (source === "booking_update") {
        router.push("/(tabs)/notifications");
      } else {
        router.push("/(tabs)/dashboard");
      }
    } else if (item.type === "message") {
      const data = item.data ?? {};
      if (data.conversationId || data.providerId) {
        router.push("/(tabs)/messages");
      } else {
        router.push("/(tabs)/messages");
      }
    } else if (item.type === "review") {
      router.push("/(tabs)/profile");
    } else if (item.type === "subscription") {
      router.push("/subscription");
    } else {
      router.push("/(tabs)/notifications");
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.title}>{t.notifications}</Text>

        {unreadCount > 0 && (
          <View style={styles.headerActions}>
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount} {t.unread}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={handleMarkAll}
              activeOpacity={0.75}
              hitSlop={8}
            >
              <Text style={styles.markAllBtnText}>{t.markAllRead}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.subtitle}>
          {t.stayUpdatedBookings}
        </Text>
      </View>

      {Platform.OS !== "web" && (
        <View
          style={[
            styles.statusChip,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="notifications-circle-outline"
            size={14}
            color={colors.primary}
          />
          <Text
            style={[
              styles.statusChipText,
              { color: colors.mutedForeground },
            ]}
          >
            {t.pushNotifActive}
          </Text>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotifRow
            item={item}
            onPress={() => handlePress(item)}
            onDismiss={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              dismissNotification(item.id);
            }}
            colors={colors}
            justNow={t.justNow}
          />
        )}
        contentContainerStyle={{
          paddingTop: 4,
          paddingBottom: Platform.OS === "web" ? 84 : 90,
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="notifications-outline"
              size={48}
              color={colors.mutedForeground}
            />
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground }]}
            >
              {t.noNotificationsYet}
            </Text>
            <Text
              style={[styles.emptySub, { color: colors.mutedForeground }]}
            >
              {t.notifDesc}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: "#0F172A",
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  unreadBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unreadBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#2563EB",
  },
  markAllBtn: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markAllBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#2563EB",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#64748B",
    marginTop: 8,
    marginBottom: 16,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusChipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flex: 1,
  },
  cardWrapper: {
    marginHorizontal: 16,
    marginBottom: 11,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EDF5",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  notifRowInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: 16,
    paddingRight: 18,
    paddingVertical: 16,
    gap: 14,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: 3,
    marginRight: 2,
    flexShrink: 0,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  notifTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#0F172A",
    flexShrink: 1,
  },
  notifTime: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#94A3B8",
    flexShrink: 0,
    marginTop: 2,
  },
  notifBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
});
