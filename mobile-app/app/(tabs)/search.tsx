import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useLanguage } from "@/context/LanguageContext";
import { ProviderCard } from "@/components/ProviderCard";
import { SEARCH_BAR_COLORS, SEARCH_BAR_SHARED, SEARCH_BAR_TEXT } from "@/components/searchBarStyles";
import { CATEGORIES } from "@/lib/mockData";
import { fetchProviders, searchProviders, getOrCreateConversation, SubscriptionInactiveError } from "@/lib/db";
import type { Provider } from "@/lib/types";

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { supabaseUserId } = useAuth();
  const { location } = useLocation();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ category?: string; query?: string }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [query, setQuery] = useState(params.query ?? "");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params.category ?? null,
  );
  const inputRef = useRef<TextInput>(null);

  const selectedCategoryName =
    CATEGORIES.find((c) => c.id === selectedCategory)?.name ?? null;

  const isSearching = query.trim().length >= 2;

  // Backend strictly filters providers whose service radius covers the customer's location.
  // No client-side filtering or sorting needed — backend handles radius + distance ordering.
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["search", query.trim(), selectedCategoryName, location?.latitude, location?.longitude],
    queryFn: async () => {
      if (isSearching) {
        return searchProviders(query.trim(), location?.latitude, location?.longitude);
      }
      return fetchProviders(selectedCategoryName, location?.latitude, location?.longitude);
    },
    staleTime: 20000,
  });

  async function handleMessage(provider: Provider) {
    if (supabaseUserId) {
      try {
        const convId = await getOrCreateConversation(supabaseUserId, provider.id);
        if (convId) {
          router.push({
            pathname: "/chat/[id]",
            params: {
              id: provider.id,
              convId,
              name: provider.name,
              initials: provider.initials,
              avatarColor: provider.avatarColor,
              avatarUrl: provider.avatarUrl ?? "",
              category: provider.category,
            },
          });
          return;
        }
      } catch (e) {
        if (e instanceof SubscriptionInactiveError) {
          Alert.alert(
            t.providerUnavailable,
            t.providerNotAcceptingCustomers.replace("{name}", provider.name),
            [{ text: t.ok }],
          );
          return;
        }
      }
    }
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: provider.id,
        name: provider.name,
        initials: provider.initials,
        avatarColor: provider.avatarColor,
        avatarUrl: provider.avatarUrl ?? "",
        category: provider.category,
      },
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View
        style={[
          styles.topBar,
          { paddingTop: topPad - 14, backgroundColor: colors.background },
        ]}
      >
        <View
          style={[
            styles.searchWrap,
            { backgroundColor: colors.card, borderColor: SEARCH_BAR_COLORS.border },
          ]}
        >
          <Ionicons name="search" size={20} color={SEARCH_BAR_COLORS.icon} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t.searchBySkillOrService}
            placeholderTextColor={SEARCH_BAR_COLORS.placeholder}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category badge (clearable) */}
        {selectedCategoryName && (
          <TouchableOpacity
            style={[styles.categoryBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.categoryBadgeText, { color: colors.primary }]}>
              {selectedCategoryName}
            </Text>
            <Ionicons name="close" size={13} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Result count */}
      <View style={styles.resultMeta}>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={styles.resultHeadingRow}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={[styles.resultCount, { color: colors.foreground }]}>
              {(providers.length === 1 ? t.skilledWorkerFoundNearby : t.skilledWorkersFoundNearby).replace(
                "{n}",
                String(providers.length),
              )}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={providers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProviderCard
            provider={item}
            onPress={() =>
              router.push({
                pathname: "/provider/[id]",
                params: { id: item.id },
              })
            }
            onMessage={() => handleMessage(item)}
            isOwnCard={!!(supabaseUserId && item.userId && item.userId === supabaseUserId)}
          />
        )}
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 84 : 90,
          paddingTop: 4,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {t.noProvidersMatch}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {location
                  ? t.noProvidersInArea
                  : t.tryAdjustingFilters}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    ...SEARCH_BAR_SHARED,
  },
  searchInput: {
    flex: 1,
    ...SEARCH_BAR_TEXT,
    height: "100%",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 5,
  },
  categoryBadgeText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  resultMeta: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    minHeight: 26,
    justifyContent: "center",
  },
  resultHeadingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultCount: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 15 },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});
