import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Avatar } from "@/components/Avatar";
import { fetchConversations } from "@/lib/db";
import { getConversations, getHiddenConversationIds, hideConversation } from "@/lib/storage";
import { API_BASE } from "@/lib/db";
import type { Conversation } from "@/lib/types";

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, supabaseUserId } = useAuth();
  const { t } = useLanguage();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [localConvos, setLocalConvos] = useState<Conversation[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabaseUserId) {
      getConversations().then(setLocalConvos);
    }
    // Load locally hidden conversation IDs
    getHiddenConversationIds().then(setHiddenIds);
  }, [supabaseUserId]);

  const {
    data: supabaseConvos = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["conversations", supabaseUserId, user?.providerId],
    queryFn: () => fetchConversations(supabaseUserId!, user?.providerId),
    enabled: !!supabaseUserId,
    refetchInterval: 10000,
  });

  const allConversations: Conversation[] = supabaseUserId
    ? supabaseConvos
    : localConvos;

  // Filter out locally deleted conversations
  const conversations = allConversations.filter((c) => !hiddenIds.has(c.id));

  // ── Delete conversation ───────────────────────────────────────────────────
  const handleDeleteConversation = useCallback(async (item: Conversation) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t.deleteConversation,
      t.removeConversationConfirm.replace("{name}", item.providerName),
      [
        { text: t.cancel, style: "cancel" },
        {
          text: t.delete,
          style: "destructive",
          onPress: async () => {
            // Optimistically remove from UI
            setHiddenIds((prev) => new Set([...prev, item.id]));
            // Persist locally
            await hideConversation(item.id);
            // Delete on server (best-effort)
            try {
              await fetch(`${API_BASE}/conversations/${item.id}`, { method: "DELETE" });
            } catch {
              // Non-fatal — local hide is sufficient
            }
          },
        },
      ],
    );
  }, [t]);

  function goToChat(item: Conversation) {
    // For provider-view rows, customerId is the OTHER participant (the customer).
    // For customer-view rows, customerId is absent and providerId is the correct partner.
    const chatPartnerId = item.customerId ?? item.providerId;
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: chatPartnerId,
        convId: item.id,
        name: item.providerName,
        phone: item.phone,
        initials: item.providerInitials,
        avatarColor: item.providerAvatarColor,
        avatarUrl: item.providerAvatarUrl ?? "",
        verified: item.providerCategory !== "Customer" ? "true" : "false",
        category: item.providerCategory,
      },
    });
  }

  function formatConversationDateLabel(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed === "Yesterday") return t.yesterday;

    const weekdayMap: Record<string, string> = {
      Mon: t.weekdayMon,
      Tue: t.weekdayTue,
      Wed: t.weekdayWed,
      Thu: t.weekdayThu,
      Fri: t.weekdayFri,
      Sat: t.weekdaySat,
      Sun: t.weekdaySun,
    };
    if (weekdayMap[trimmed]) return weekdayMap[trimmed];

    // The API currently returns a clock time for same-day messages.
    if (trimmed.includes(":")) return t.today;

    return trimmed;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t.messages}
        </Text>
        {conversations.length > 0 && (
          <View
            style={[styles.countBadge, { backgroundColor: colors.secondary }]}
          >
            <Text
              style={[styles.countText, { color: colors.mutedForeground }]}
            >
              {conversations.length}
            </Text>
          </View>
        )}
      </View>

      {isLoading && supabaseUserId ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshControl={
            supabaseUserId ? (
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refetch}
                tintColor={colors.primary}
              />
            ) : undefined
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderColor: "#E8EDF5" }]}
              onPress={() => goToChat(item)}
              onLongPress={() => handleDeleteConversation(item)}
              delayLongPress={400}
              activeOpacity={0.75}
            >
              <Avatar
                initials={item.providerInitials}
                color={item.providerAvatarColor}
                imageUri={item.providerAvatarUrl ?? undefined}
                size={60}
              />
              <View style={styles.rowContent}>
                <View style={styles.rowTop}>
                  <View style={styles.nameRow}>
                    <Text
                      style={[
                        styles.providerName,
                        { color: colors.foreground },
                      ]}
                    >
                      {item.providerName}
                    </Text>
                    {item.providerCategory !== "Customer" && (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={colors.primary}
                        style={styles.verifiedIcon}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.time,
                      { color: "#94A3B8" },
                    ]}
                  >
                    {formatConversationDateLabel(item.lastMessageTime)}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text
                    style={[
                      styles.lastMsg,
                      { color: "#64748B" },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.lastMessage || item.providerCategory}
                  </Text>
                  {item.unreadCount > 0 && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {item.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={40}
                  color={colors.primary}
                />
              </View>
              <Text
                style={[styles.emptyTitle, { color: colors.foreground }]}
              >
                {t.noMessagesYet}
              </Text>
              <Text
                style={[
                  styles.emptyText,
                  { color: colors.mutedForeground },
                ]}
              >
                {t.noMessagesDesc.replace("Message", t.message)}
              </Text>
              <TouchableOpacity
                style={[
                  styles.findBtn,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => router.push("/(tabs)/search")}
                activeOpacity={0.85}
              >
                <Ionicons name="search" size={16} color="#FFFFFF" />
                <Text style={styles.findBtnText}>{t.findProviders}</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{
            paddingBottom: Platform.OS === "web" ? 84 : 90,
            flexGrow: 1,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 26 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 14,
  },
  rowContent: { flex: 1 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  nameRow: { flexDirection: "row", alignItems: "center", flexShrink: 1, marginRight: 8 },
  providerName: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  verifiedIcon: { marginLeft: 6 },
  time: { fontFamily: "Inter_400Regular", fontSize: 12 },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMsg: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 14,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  findBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  findBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});
