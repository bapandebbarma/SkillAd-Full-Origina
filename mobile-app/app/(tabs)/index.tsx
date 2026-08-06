import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useLanguage } from "@/context/LanguageContext";
import { ProviderCard } from "@/components/ProviderCard";
import { AdBannerSlider } from "@/components/AdBanner";
import { CategoryGrid } from "@/components/CategoryGrid";
import { SEARCH_BAR_COLORS, SEARCH_BAR_SHARED, SEARCH_BAR_TEXT } from "@/components/searchBarStyles";
import { CATEGORIES } from "@/lib/mockData";
import { fetchProviders, getOrCreateConversation, API_BASE, SubscriptionInactiveError } from "@/lib/db";
import type { Provider, Category, AdBanner } from "@/lib/types";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, supabaseUserId } = useAuth();
  const { location } = useLocation();
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Fetch categories from API (sorted by popularity / admin order)
  const { data: apiCategories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        if (!res.ok) return CATEGORIES;
        const d = await res.json() as { categories: any[] };
        return (d.categories ?? []).map((c: any): Category => ({
          id: c.id,
          name: c.name,
          icon: c.icon ?? "apps",
          color: c.color ?? "#94A3B8",
          showOnHome: c.showOnHome ?? false,
          searchCount: c.searchCount ?? 0,
          homeOrder: c.homeOrder ?? null,
        }));
      } catch {
        return CATEGORIES;
      }
    },
    staleTime: 60_000,
  });

  const allCategories = apiCategories ?? CATEGORIES;

  // Home page: categories with showOnHome true, or top 12 by default
  const homeCategories = allCategories.filter((c) => c.showOnHome).length > 0
    ? allCategories.filter((c) => c.showOnHome)
    : allCategories.slice(0, 12);

  // Track search count when category is tapped
  async function trackCategorySearch(catId: string) {
    try {
      await fetch(`${API_BASE}/categories/${catId}/search`, { method: "POST" });
    } catch { /* non-fatal */ }
  }

  const selectedCategoryName = allCategories.find((c) => c.id === selectedCategory)?.name ?? null;

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["providers", selectedCategoryName, location?.latitude, location?.longitude],
    queryFn: () => fetchProviders(selectedCategoryName, location?.latitude, location?.longitude),
  });

  const { data: announcements = [] } = useQuery<{ id: string; text: string; createdAt: string }[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/content`);
        if (!res.ok) return [];
        const d = await res.json() as { content: { announcements?: any[] } };
        return d.content?.announcements ?? [];
      } catch { return []; }
    },
    staleTime: 60_000,
  });

  const { data: liveAds = [], isLoading: adsLoading } = useQuery<AdBanner[]>({
    queryKey: ["ads"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ads`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { ads: any[] };
      // Resolve relative image paths to absolute URLs
      const apiOrigin = (() => {
        try { return new URL(API_BASE).origin; } catch { return ""; }
      })();
      return (data.ads ?? []).map((a: any): AdBanner => ({
        id: a.id,
        title: a.title ?? "",
        subtitle: a.subtitle ?? "",
        bgColor: a.bgColor ?? "#FF6B35",
        textColor: a.textColor ?? "#FFFFFF",
        imageUri: a.imageUrl
          ? (a.imageUrl.startsWith("http") ? a.imageUrl : `${apiOrigin}${a.imageUrl}`)
          : undefined,
        linkUrl: a.linkUrl ?? undefined,
      }));
    },
    staleTime: 30_000,
    retry: 2,
  });

  const banners: AdBanner[] = liveAds;

  // Server already applies radius filter when lat/lng is sent.
  // Client-side: trust server result — show all returned providers.
  // (Server uses provider's serviceRadius; default 50km when not set.)
  const filtered = providers;

  async function handleMessage(provider: Provider) {
    if (supabaseUserId) {
      try {
        const convId = await getOrCreateConversation(supabaseUserId, provider.id);
        if (convId) {
          router.push({
            pathname: "/chat/[id]",
            params: { id: provider.id, convId, name: provider.name, initials: provider.initials, avatarColor: provider.avatarColor, category: provider.category },
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
      params: { id: provider.id, name: provider.name, initials: provider.initials, avatarColor: provider.avatarColor, category: provider.category },
    });
  }

  function handleCategorySelect(cat: Category | null) {
    setSelectedCategory(cat?.id ?? null);
    if (cat) trackCategorySearch(cat.id);
  }

  function handleAllCategorySelect(cat: Category) {
    setShowAllCategories(false);
    setSelectedCategory(cat.id === selectedCategory ? null : cat.id);
    trackCategorySearch(cat.id);
  }

  // "See All" chip appended after home categories
  const SEE_ALL_CAT: Category = { id: "__seeall__", name: t.seeAll, icon: "apps-outline", color: "#94A3B8" };
  const displayCategories = [...homeCategories, SEE_ALL_CAT];

  const ListHeader = useCallback(
    () => (
      <View>
        <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              {t.hi} {user?.name?.split(" ")[0] ?? ""}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={[styles.locationText, { color: colors.foreground }]} numberOfLines={1}>
                {location?.address ?? t.detectingLocation}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/notifications")}>
            <View style={[styles.notifBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="notifications" size={20} color={colors.foreground} />
              <View style={[styles.notifBadge, { backgroundColor: colors.primary }]} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: SEARCH_BAR_COLORS.border }]}
          activeOpacity={0.75}
          onPress={() => router.push("/(tabs)/search")}
        >
          <Ionicons name="search" size={20} color={SEARCH_BAR_COLORS.icon} />
          <Text style={[styles.searchPlaceholder, { color: SEARCH_BAR_COLORS.placeholder }]}>
            {t.searchPlaceholder}
          </Text>
          <View style={[styles.searchArrow, { backgroundColor: colors.primary }]}>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        <AdBannerSlider banners={banners} isLoading={adsLoading} />

        {announcements.length > 0 && (
          <View style={styles.announcementsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.announcementsScroll}
            >
              {announcements.map((ann) => (
                <View key={ann.id} style={[styles.announcementChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
                  <Text style={styles.annIcon}>📣</Text>
                  <Text style={[styles.annText, { color: colors.foreground }]} numberOfLines={2}>
                    {ann.text}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.categories}</Text>
          {selectedCategory && (
            <TouchableOpacity onPress={() => setSelectedCategory(null)}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>{t.clear}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Home categories + See All chip */}
        <View style={styles.homeCategoriesWrap}>
          <CategoryGrid
            categories={displayCategories}
            selected={selectedCategory}
            onSelect={(cat) => {
              if (cat?.id === "__seeall__") {
                setShowAllCategories(true);
              } else {
                handleCategorySelect(cat);
              }
            }}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {selectedCategoryName ? selectedCategoryName : t.nearbySkilled}
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/search")}>
            <Text style={[styles.viewAll, { color: colors.primary }]}>{t.viewAll}</Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!isLoading && filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t.noProvidersFound}</Text>
          </View>
        )}
      </View>
    ),
    [selectedCategory, selectedCategoryName, displayCategories, colors, location, user, filtered.length, topPad, isLoading, t, announcements, banners],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProviderCard
            provider={item}
            onPress={() => router.push({ pathname: "/provider/[id]", params: { id: item.id } })}
            onMessage={() => handleMessage(item)}
            isOwnCard={!!(supabaseUserId && item.userId && item.userId === supabaseUserId)}
          />
        )}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 : 90 }}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/register-provider")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.fabText}>{t.offerSkills}</Text>
      </TouchableOpacity>

      {/* All Categories Modal */}
      <Modal
        visible={showAllCategories}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAllCategories(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAllCategories(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t.allCategories}</Text>
            <TouchableOpacity onPress={() => setShowAllCategories(false)} style={[styles.modalClose, { backgroundColor: colors.card }]}>
              <Ionicons name="close" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalGrid}>
            {allCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const isSingleWord = !cat.name.trim().includes(" ");
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.modalItem,
                    {
                      backgroundColor: isSelected ? cat.color : colors.card,
                      borderColor: isSelected ? cat.color : colors.border,
                    },
                  ]}
                  onPress={() => handleAllCategorySelect(cat)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.modalIconWrap, { backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : cat.color + "20" }]}>
                    <Ionicons name={cat.icon as any} size={25} color={isSelected ? "#FFFFFF" : cat.color} />
                  </View>
                  <Text
                    style={[styles.modalLabel, { color: isSelected ? "#FFFFFF" : colors.foreground }]}
                    numberOfLines={isSingleWord ? 1 : 2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    ellipsizeMode="tail"
                    textBreakStrategy="simple"
                  >
                    {cat.name}
                  </Text>
                  {(cat.searchCount ?? 0) > 0 && (
                    <View style={[styles.popularBadge, { backgroundColor: colors.primary + "25" }]}>
                      <Text style={[styles.popularText, { color: colors.primary }]}>🔥</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 16, paddingBottom: 14 },
  greeting: { fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 220 },
  locationText: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  notifBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  notifBadge: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "#FFFFFF" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    ...SEARCH_BAR_SHARED,
  },
  searchPlaceholder: { flex: 1, ...SEARCH_BAR_TEXT },
  searchArrow: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  homeCategoriesWrap: { marginBottom: -4 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  viewAll: { fontFamily: "Inter_500Medium", fontSize: 13 },
  loadingState: { alignItems: "center", paddingVertical: 32 },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15 },
  fab: { position: "absolute", right: 20, bottom: Platform.OS === "web" ? 94 : 100, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, shadowColor: "#2563EB", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FFFFFF" },
  announcementsWrap: { marginBottom: 4 },
  announcementsScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  announcementChip: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, maxWidth: 280, minWidth: 180 },
  annIcon: { fontSize: 14, marginTop: 1 },
  annText: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, lineHeight: 18 },
  // Modal
  modalBackdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", paddingBottom: Platform.OS === "web" ? 16 : 32 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  modalClose: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, paddingBottom: 16 },
  modalItem: {
    width: "22%",
    aspectRatio: 0.85,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 6,
    position: "relative",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  modalLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11.5,
    lineHeight: 13.8,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 2,
  },
  popularBadge: { position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  popularText: { fontSize: 9 },
});
