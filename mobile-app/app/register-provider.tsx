import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useLocation } from "@/context/LocationContext";
import { CATEGORIES } from "@/lib/mockData";
import { registerProvider, apiPostProvider, fetchProviderByPhone, API_BASE, AVATAR_COLORS } from "@/lib/db";
import { saveLocalProvider, generateId } from "@/lib/storage";
import { queryClient } from "@/app/_layout";
import type { Category, Provider } from "@/lib/types";

const RADIUS_OPTIONS = [50, 75, 100, 150, 200];

const DROPDOWN_CATEGORIES = CATEGORIES.filter((c) => c.name !== "More");

// ── Radius Dropdown ───────────────────────────────────────────────────────────

function RadiusDropdown({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (r: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  function pick(r: number) {
    onChange(r);
    setOpen(false);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.dropdownTrigger,
          { borderColor: colors.primary, backgroundColor: colors.card },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <View style={styles.dropdownSelected}>
          <View style={[styles.dropdownIconBox, { backgroundColor: "#2563EB20" }]}>
            <Ionicons name="navigate-circle-outline" size={16} color="#2563EB" />
          </View>
          <Text style={[styles.dropdownSelectedText, { color: colors.foreground }]}>
            {t.kmRadius.replace("{n}", String(value))}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t.workingRadius}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10} style={styles.modalCloseBtn}>
                <Ionicons name="close-circle" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.radiusHint, { color: colors.mutedForeground }]}>
              {t.workingRadiusHint}
            </Text>

            <View style={styles.radiusGrid}>
              {RADIUS_OPTIONS.map(r => {
                const isSelected = r === value;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.radiusGridBtn,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => pick(r)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="navigate-circle-outline"
                      size={18}
                      color={isSelected ? "#FFFFFF" : colors.mutedForeground}
                    />
                    <Text style={[styles.radiusGridText, { color: isSelected ? "#FFFFFF" : colors.foreground }]}>
                      {t.nKm.replace("{n}", String(r))}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={15} color="rgba(255,255,255,0.8)" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Category Dropdown ─────────────────────────────────────────────────────────

function CategoryDropdown({
  value,
  onChange,
  colors,
  hasError,
}: {
  value: string;
  onChange: (cat: string) => void;
  colors: ReturnType<typeof useColors>;
  hasError?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const insets = useSafeAreaInsets();

  const selected = DROPDOWN_CATEGORIES.find((c) => c.name === value);

  const filtered = useMemo(
    () =>
      search.trim()
        ? DROPDOWN_CATEGORIES.filter((c) =>
            c.name.toLowerCase().includes(search.toLowerCase())
          )
        : DROPDOWN_CATEGORIES,
    [search]
  );

  function pick(cat: Category) {
    onChange(cat.name);
    setSearch("");
    setOpen(false);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }

  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity
        style={[
          styles.dropdownTrigger,
          {
            borderColor: hasError ? colors.destructive : value ? colors.primary : colors.border,
            backgroundColor: colors.card,
          },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        {selected ? (
          <View style={styles.dropdownSelected}>
            <View style={[styles.dropdownIconBox, { backgroundColor: selected.color + "20" }]}>
              <Ionicons name={selected.icon as any} size={16} color={selected.color} />
            </View>
            <Text style={[styles.dropdownSelectedText, { color: colors.foreground }]}>
              {selected.name}
            </Text>
          </View>
        ) : (
          <Text style={[styles.dropdownPlaceholder, { color: colors.mutedForeground }]}>
            {t.selectACategory}
          </Text>
        )}
        <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={open} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View
              style={[
                styles.modalSheet,
                {
                  backgroundColor: colors.background,
                  paddingBottom: insets.bottom + 12,
                },
              ]}
            >
              {/* Sheet header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.modalHandle} />
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {t.selectSkillCategory}
                </Text>
                <TouchableOpacity
                  onPress={() => { setSearch(""); setOpen(false); }}
                  hitSlop={10}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close-circle" size={24} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={[styles.searchBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.searchInput, { color: colors.foreground }]}
                  placeholder={t.searchCategory}
                  placeholderTextColor={colors.mutedForeground}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {/* List */}
              <FlatList
                data={filtered}
                keyExtractor={(c) => c.id}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}
                ItemSeparatorComponent={() => (
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                )}
                ListEmptyComponent={
                  <View style={styles.emptySearch}>
                    <Ionicons name="search-outline" size={30} color={colors.mutedForeground} />
                    <Text style={[styles.emptySearchText, { color: colors.mutedForeground }]}>
                      {t.noCategoriesFound}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isSelected = item.name === value;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.categoryRow,
                        isSelected && { backgroundColor: colors.primary + "12" },
                      ]}
                      onPress={() => pick(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.catIconBox, { backgroundColor: item.color + "20" }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.color} />
                      </View>
                      <Text
                        style={[
                          styles.catName,
                          {
                            color: isSelected ? colors.primary : colors.foreground,
                            fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                          },
                        ]}
                      >
                        {item.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function RegisterProviderScreen() {
  const colors = useColors();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = mode === "edit";
  const { user, supabaseUserId, updateProfile, updateAvatarUrl } = useAuth();
  const { location } = useLocation();

  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [experience, setExperience] = useState("");
  const [description, setDescription] = useState("");
  const [radius, setRadius] = useState<number>(50);
  const [serviceArea, setServiceArea] = useState("");
  const [charge, setCharge] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [services, setServices] = useState("");
  const [providerName, setProviderName] = useState(user?.name ?? "");
  const [manualLocation, setManualLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [freeTrialDays, setFreeTrialDays] = useState(0);

  // Existing provider record — if set, we UPDATE instead of INSERT
  const [existingProviderId, setExistingProviderId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then((r) => r.json())
      .then((d: any) => {
        setPaymentEnabled(d.paymentGatewayEnabled === true);
        setFreeTrialDays(typeof d.freeTrialDays === "number" ? d.freeTrialDays : 0);
      })
      .catch(() => { setPaymentEnabled(false); setFreeTrialDays(0); });
  }, []);

  // On mount, check if this phone number already has a provider account.
  // If yes, pre-fill the form so editing updates the same record.
  useEffect(() => {
    const phone = user?.phone ?? "";
    if (!phone) { setLoadingExisting(false); return; }

    fetchProviderByPhone(phone).then((existing) => {
      if (existing) {
        setExistingProviderId(existing.id);
        setCategory(existing.category ?? "");
        setSubcategory(existing.subcategory ?? "");
        setExperience(existing.experience ? String(existing.experience) : "");
        setDescription(existing.description ?? "");
        setRadius(existing.serviceRadius ?? 50);
        setServiceArea(existing.serviceArea?.trim() || existing.workingHours || "");
        setCharge(existing.serviceCharge ?? "");
        setAvatarColor(existing.avatarColor ?? AVATAR_COLORS[0]);
        setServices((existing.services ?? []).join(", "));
        if (existing.avatarUrl) setPickedImageUri(existing.avatarUrl);
        setProviderName(existing.name ?? user?.name ?? "");
        setManualLocation(existing.location ?? "");
      } else {
        setProviderName(user?.name ?? "");
      }
      setLoadingExisting(false);
    }).catch(() => setLoadingExisting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phone]);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Upload photo to server immediately after picking.
  // Returns the server URL on success, or null on failure (never saves a local file:// URI
  // to the provider profile — local URIs are only accessible on the current device).
  async function uploadPhotoToServer(localUri: string): Promise<string | null> {
    const uploadUrl = `${API_BASE}/upload/profile`;
    console.log("[upload:register] start", { localUri, API_BASE, uploadUrl });
    try {
      setUploadingPhoto(true);
      const rawName = localUri.split("/").pop()?.split("?")[0] ?? "photo.jpg";
      const ext = rawName.split(".").pop()?.toLowerCase().replace(/[^a-z]/g, "") ?? "jpg";
      const mimeType =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      console.log("[upload:register] uploading", { ext, mimeType });

      // uploadAsync handles both content:// and file:// URIs reliably on Android.
      // fetch + FormData { uri, name, type } fails on Android — OkHttp cannot stream
      // local file URIs through the RN JS bridge ("Network request failed").
      const uploadResult = await uploadAsync(uploadUrl, localUri, {
        fieldName: "image",
        httpMethod: "POST",
        uploadType: FileSystemUploadType.MULTIPART,
        mimeType,
        // userId lets the server update profiles.avatar_url with the service-role key
        // (same as profile.tsx). Without it, storage succeeds but DB sync is skipped.
        parameters: { userId: supabaseUserId ?? "" },
      });

      console.log("[upload:register] response", { status: uploadResult.status, body: uploadResult.body });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const data = JSON.parse(uploadResult.body) as { fileUrl?: string; error?: string };
        if (data.fileUrl) {
          console.log("[upload:register] success →", data.fileUrl);
          return data.fileUrl;
        }
        console.warn("[upload:register] no fileUrl in response", data);
      }
    } catch (err: any) {
      console.error("[upload:register] error", err?.message ?? err);
      Alert.alert(
        t.photoUploadFailed,
        t.photoUploadFailedDesc,
        [{ text: t.ok }],
      );
    } finally {
      setUploadingPhoto(false);
    }
    return null;
  }

  async function handlePickPhoto() {
    // Android Photo Picker does not need broad READ_MEDIA_* access.
    if (Platform.OS === "ios") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t.permissionNeeded, t.pleaseAllowPhotoLibrary);
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const localUri = result.assets[0].uri;
      setPickedImageUri(localUri); // show immediately
      const serverUri = await uploadPhotoToServer(localUri);
      setPickedImageUri(serverUri);
      if (serverUri) {
        await updateAvatarUrl(serverUri);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["providers"] });
        console.log("[upload:register:pick] AuthContext + caches updated →", serverUri.slice(0, 60));
      }
    }
  }

  async function handleTakePhoto() {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t.permissionNeeded, t.pleaseAllowCamera);
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const localUri = result.assets[0].uri;
      setPickedImageUri(localUri); // show immediately (optimistic)
      const serverUri = await uploadPhotoToServer(localUri);
      // If upload succeeded, replace optimistic local URI with the permanent server URL.
      // If upload failed (null), revert to null — never persist a local file:// URI to the DB
      // because it's only readable on this device.
      setPickedImageUri(serverUri);
      if (serverUri) {
        await updateAvatarUrl(serverUri);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["providers"] });
        console.log("[upload:register:camera] AuthContext + caches updated →", serverUri.slice(0, 60));
      }
    }
  }

  function handlePhotoPress() {
    Alert.alert(t.uploadPhoto, t.chooseHowAddPhoto, [
      { text: t.takePhoto, onPress: handleTakePhoto },
      { text: t.chooseFromLibrary, onPress: handlePickPhoto },
      { text: t.cancel, style: "cancel" },
    ]);
  }

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function validate() {
    const errs: Record<string, string> = {};
    if (!providerName.trim())    errs.providerName = t.pleaseEnterDisplayName;
    if (!category)               errs.category    = t.pleaseSelectSkillCategory;
    if (!experience)             errs.experience  = t.pleaseEnterExperience;
    if (description.length < 20) errs.description = t.atLeast20Chars.replace("{n}", String(description.length));
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setErrors({});
    setLoading(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const name = providerName.trim() || user?.name || t.provider;
    const phone = user?.phone ?? "";
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    const serviceList = services.split(",").map((s) => s.trim()).filter(Boolean);
    const providerLocation = manualLocation.trim() || location?.address || "Agartala";
    const providerLat = location?.latitude ?? 23.8315;
    const providerLng = location?.longitude ?? 91.2868;

    // Use a stable, deterministic ID:
    // - Supabase users  → "sb-<userId>"
    // - Demo/offline    → "ph-<last10digits>" (phone-based, survives reinstall)
    // - If we already know the existing server ID, use that directly
    const stableId = existingProviderId
      ?? (supabaseUserId ? `sb-${supabaseUserId}` : `ph-${phone.replace(/\D/g, "").slice(-10)}`);

    const localProvider: Provider = {
      id: stableId,
      userId: supabaseUserId ?? undefined,
      name,
      category,
      subcategory: subcategory || undefined,
      rating: 0,
      reviewCount: 0,
      distance: 0,
      available: true,
      experience: parseInt(experience, 10) || 0,
      description,
      phone,
      location: providerLocation,
      serviceRadius: radius,
      serviceCharge: charge || undefined,
      serviceArea: serviceArea.trim() || undefined,
      workingHours: "",
      latitude: providerLat,
      longitude: providerLng,
      verified: false,
      initials,
      avatarColor,
      avatarUrl: pickedImageUri ?? undefined,
      services: serviceList,
      reviews: [],
    };

    // Persist locally (works offline / demo users)
    await saveLocalProvider(localProvider);

    // ── API Server: upsert by phone ──────────────────────────────────────────
    // POST always upserts by phone on the server — no duplicates possible.
    // apiPostProvider retries once on failure and returns { ok, error }.
    const apiResult = await apiPostProvider(localProvider);
    if (!apiResult.ok) {
      console.warn("[register-provider] apiPostProvider failed — trial subscription may be missing:", apiResult.error);
    }

    // Invalidate providers list so home/search screens refresh immediately
    queryClient.invalidateQueries({ queryKey: ["providers"] });

    // ── Supabase: upsert by user_id ──────────────────────────────────────────
    if (supabaseUserId) {
      try {
        await registerProvider(supabaseUserId, {
          name,
          phone,
          category,
          subcategory: subcategory || undefined,
          experience: parseInt(experience, 10) || 0,
          description,
          serviceRadius: radius,
          serviceArea: serviceArea.trim() || undefined,
          serviceCharge: charge || undefined,
          initials,
          avatarColor,
          services: serviceList,
          location: providerLocation,
          latitude: providerLat,
          longitude: providerLng,
        });
      } catch (_) {
        // Supabase failed — local + API copy already saved, so carry on
      }

    }

    // Update local user profile flag (and sync name if changed)
    try {
      await updateProfile({
        isProvider: true,
        name,
        providerProfile: {
          category,
          subcategory,
          experience: parseInt(experience, 10),
          description,
          serviceRadius: radius,
          serviceArea: serviceArea.trim() || undefined,
          serviceCharge: charge,
        },
      });
    } catch (_) {}

    setLoading(false);

    const isUpdate = isEditMode || !!existingProviderId;
    if (isUpdate) {
      Alert.alert(t.profileUpdatedTitle, t.providerProfileSaved, [
        { text: t.ok, onPress: () => router.back() },
      ]);
    } else if (!paymentEnabled) {
      // Payment gateway off — auto-activate free trial (duration from settings.json via API)
      const uid = supabaseUserId ?? (user as any)?.id;
      if (uid) {
        try {
          const trialRes = await fetch(`${API_BASE}/subscriptions/trial`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: uid, providerId: stableId }),
          });
          if (!trialRes.ok) {
            const errBody = await trialRes.text().catch(() => "");
            console.warn(
              "[register-provider] trial subscription HTTP",
              trialRes.status,
              errBody || trialRes.statusText,
            );
          }
        } catch (err: any) {
          console.warn("[register-provider] trial subscription call failed:", err?.message);
        }
      }
      router.replace("/(tabs)");
    } else if (freeTrialDays > 0) {
      // Subscription enabled but free trial configured — auto-activate trial
      const uid = supabaseUserId ?? (user as any)?.id;
      if (uid) {
        fetch(`${API_BASE}/subscriptions/trial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid, providerId: stableId }),
        }).catch((err: any) => {
          console.warn("[register-provider] trial subscription call failed:", err?.message);
        });
      }
      router.replace("/(tabs)");
    } else {
      // Payment required — show subscription screen
      router.replace({ pathname: "/subscription", params: { fromRegistration: "1", providerId: stableId } });
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero banner */}
        <View style={[styles.heroBanner, { backgroundColor: colors.secondary }]}>
          <Ionicons name={isEditMode ? "pencil" : "briefcase"} size={26} color={colors.primary} />
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            {isEditMode ? t.editProfile : t.registerAsProvider}
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            {isEditMode
              ? t.updateSkillsProfile
              : t.showcaseSkillsGetHired}
          </Text>
        </View>

        {/* Provider Name */}
        <FormLabel label={t.displayName} required colors={colors} />
        <View style={[
          styles.inputWrap,
          { borderColor: errors.providerName ? colors.destructive : colors.border, backgroundColor: colors.card, marginHorizontal: 16, marginBottom: errors.providerName ? 5 : 14 },
        ]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder={t.displayNamePlaceholder}
            placeholderTextColor={colors.mutedForeground}
            value={providerName}
            onChangeText={(v) => { setProviderName(v); setErrors(e => ({ ...e, providerName: "" })); }}
          />
        </View>
        {errors.providerName ? <FieldError msg={errors.providerName} colors={colors} /> : null}

        {/* Service Location */}
        <FormLabel label={t.serviceLocation} colors={colors} />
        <View style={[
          styles.locationFieldRow,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}>
          <TextInput
            style={[styles.locationFieldInput, { color: colors.foreground }]}
            placeholder={t.serviceLocationPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            value={manualLocation}
            onChangeText={setManualLocation}
          />
          <TouchableOpacity
            style={styles.locationGpsBtn}
            onPress={() => { if (location?.address) setManualLocation(location.address); }}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate-circle-outline" size={22} color="#2563EB" />
          </TouchableOpacity>
        </View>
        <Text style={[styles.locationHint, { color: colors.mutedForeground }]}>
          {t.typeOrUseGps}
        </Text>

        {/* Skill Category — dropdown */}
        <FormLabel label={t.skillCategory} required colors={colors} />
        <View style={{ paddingHorizontal: 16, marginBottom: errors.category ? 5 : 14 }}>
          <CategoryDropdown
            value={category}
            onChange={(v) => { setCategory(v); setErrors(e => ({ ...e, category: "" })); }}
            colors={colors}
            hasError={!!errors.category}
          />
        </View>
        {errors.category ? <FieldError msg={errors.category} colors={colors} /> : null}

        {/* Subcategory */}
        <FormLabel label={t.subcategorySpecialization} colors={colors} />
        <InputField
          placeholder={t.subcategoryPlaceholder}
          value={subcategory}
          onChangeText={setSubcategory}
          colors={colors}
        />

        {/* Experience */}
        <FormLabel label={t.yearsOfExperience} required colors={colors} />
        <InputField
          placeholder={t.yearsExperiencePlaceholder}
          value={experience}
          onChangeText={(v) => { setExperience(v.replace(/\D/g, "")); setErrors(e => ({ ...e, experience: "" })); }}
          keyboardType="numeric"
          colors={colors}
          hasError={!!errors.experience}
        />
        {errors.experience ? <FieldError msg={errors.experience} colors={colors} /> : null}

        {/* Services */}
        <FormLabel label={t.servicesOffered} colors={colors} />
        <InputField
          placeholder={t.servicesOfferedPlaceholder}
          value={services}
          onChangeText={setServices}
          colors={colors}
        />

        {/* Description */}
        <FormLabel label={t.serviceDescription} required colors={colors} />
        <View style={[
          styles.textAreaWrap,
          { borderColor: errors.description ? colors.destructive : colors.border, backgroundColor: colors.card },
        ]}>
          <TextInput
            style={[styles.textArea, { color: colors.foreground }]}
            placeholder={t.serviceDescriptionPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={(v) => { setDescription(v); setErrors(e => ({ ...e, description: "" })); }}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
            {description.length}/500
          </Text>
        </View>
        {errors.description ? <FieldError msg={errors.description} colors={colors} /> : null}

        {/* Profile colour */}
        <FormLabel label={t.profileColor} colors={colors} />
        <View style={styles.colorRow}>
          {AVATAR_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorDot,
                {
                  backgroundColor: c,
                  borderWidth: avatarColor === c ? 3 : 0,
                  borderColor: "#2563EB",
                },
              ]}
              onPress={() => setAvatarColor(c)}
            >
              {avatarColor === c && <View style={styles.colorDotInnerRing} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Working radius */}
        <FormLabel label={t.workingRadius} required colors={colors} />
        <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
          <RadiusDropdown value={radius} onChange={setRadius} colors={colors} />
        </View>

        {/* Service area */}
        <FormLabel label={t.serviceArea} colors={colors} />
        <InputField
          placeholder={t.serviceAreaPlaceholder}
          value={serviceArea}
          onChangeText={setServiceArea}
          colors={colors}
        />

        {/* Charge */}
        <FormLabel label={t.serviceChargeOptional} colors={colors} />
        <InputField
          placeholder={t.serviceChargePlaceholder}
          value={charge}
          onChangeText={setCharge}
          colors={colors}
        />

        {/* Profile Photo */}
        <FormLabel label={t.profilePhoto} colors={colors} />
        <View style={styles.photoSection}>
          <TouchableOpacity
            style={[styles.photoCircle, { borderColor: pickedImageUri ? colors.primary : colors.border, backgroundColor: colors.card }]}
            onPress={handlePhotoPress}
            activeOpacity={0.8}
            disabled={uploadingPhoto}
          >
            {pickedImageUri ? (
              <Image source={{ uri: pickedImageUri }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={30} color={colors.mutedForeground} />
                <Text style={[styles.photoPlaceholderText, { color: colors.mutedForeground }]}>
                  {t.addPhoto}
                </Text>
              </View>
            )}
            {uploadingPhoto && (
              <View style={[StyleSheet.absoluteFillObject, styles.photoUploadOverlay]}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            )}
            {!uploadingPhoto && (
              <View style={[styles.photoBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={13} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.photoHintWrap}>
            <Text style={styles.photoHintTitle}>
              {uploadingPhoto ? t.uploadingPhoto : pickedImageUri ? t.photoAdded : t.addProfilePhoto}
            </Text>
            <Text style={styles.photoHintSub}>
              {pickedImageUri ? t.photoHintEdit : t.photoHintNew}
            </Text>
            {pickedImageUri && (
              <TouchableOpacity onPress={() => setPickedImageUri(null)} style={styles.photoRemoveBtn}>
                <Text style={styles.photoRemoveText}>{t.removePhoto}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: loading ? colors.muted : colors.primary }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={[styles.submitText, { color: "#FFFFFF" }]}>
                {isEditMode ? t.saveChanges : t.submitRegistration}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function FormLabel({
  label,
  required,
  colors,
}: {
  label: string;
  required?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Text style={[styles.label, { color: colors.mutedForeground }]}>
      {label}
      {required && <Text style={{ color: colors.destructive }}> *</Text>}
    </Text>
  );
}

function InputField({
  placeholder,
  value,
  onChangeText,
  keyboardType,
  colors,
  hasError,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "numeric";
  colors: ReturnType<typeof useColors>;
  hasError?: boolean;
}) {
  return (
    <View style={[styles.inputWrap, { borderColor: hasError ? colors.destructive : colors.border, backgroundColor: colors.card }]}>
      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
      />
    </View>
  );
}

function FieldError({ msg, colors }: { msg: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.fieldErrorRow}>
      <Ionicons name="alert-circle" size={13} color={colors.destructive} />
      <Text style={[styles.fieldErrorText, { color: colors.destructive }]}>{msg}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 8 },

  heroBanner: {
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 5,
  },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  heroSub: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },

  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    paddingHorizontal: 16,
    marginBottom: 6,
    marginTop: 3,
  },

  // Dropdown trigger
  dropdownTrigger: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownSelected: { flexDirection: "row", alignItems: "center", gap: 10 },
  dropdownIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownSelectedText: { fontFamily: "Inter_500Medium", fontSize: 15 },
  dropdownPlaceholder: { fontFamily: "Inter_400Regular", fontSize: 14 },

  // Modal sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 14,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    position: "relative",
    alignItems: "center",
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  modalCloseBtn: { position: "absolute", right: 16, top: 0 },

  // Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },

  // Category row in list
  separator: { height: StyleSheet.hairlineWidth },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    gap: 14,
  },
  catIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: { flex: 1, fontSize: 15 },

  emptySearch: { alignItems: "center", paddingTop: 32, gap: 10 },
  emptySearchText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  fieldErrorText: { fontFamily: "Inter_400Regular", fontSize: 12 },

  // Form fields
  inputWrap: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 7,
  },
  input: { fontFamily: "Inter_400Regular", fontSize: 14 },
  locationFieldRow: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  locationFieldInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  locationGpsBtn: {
    padding: 4,
    marginLeft: 6,
  },
  locationHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  textAreaWrap: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    marginBottom: 7,
    minHeight: 120,
  },
  textArea: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22, minHeight: 80 },
  charCount: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", marginTop: 4 },

  colorRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotInnerRing: {
    position: "absolute",
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  radiusHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  radiusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  radiusGridBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: "28%",
  },
  radiusGridText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  radiusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  radiusBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  radiusBtnText: { fontFamily: "Inter_500Medium", fontSize: 13 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 24,
    gap: 8,
  },
  submitText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },

  // Photo upload
  photoSection: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 17,
    gap: 16,
  },
  photoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoUploadOverlay: {
    borderRadius: 45,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoImage: { width: 90, height: 90, borderRadius: 45 },
  photoPlaceholder: { alignItems: "center", gap: 4 },
  photoPlaceholderText: { fontFamily: "Inter_400Regular", fontSize: 11 },
  photoBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  photoHintWrap: { flex: 1, gap: 4, justifyContent: "center" },
  photoHintTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#0F172A" },
  photoHintSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#64748B", lineHeight: 18 },
  photoRemoveBtn: { marginTop: 4 },
  photoRemoveText: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#DC2626" },
});
