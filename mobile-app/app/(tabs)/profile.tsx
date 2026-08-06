import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  Pressable,
  ActionSheetIOS,
  Switch,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, type AppLanguage } from "@/context/LanguageContext";
import { useLocation } from "@/context/LocationContext";
import { Avatar } from "@/components/Avatar";
import { CmsModal } from "@/components/CmsModal";
import { fetchProviderProfile, updateProviderAvailability, API_BASE } from "@/lib/db";
import { supabase } from "@/lib/supabase";


function MenuItem({
  icon,
  label,
  value,
  onPress,
  destructive,
  colors,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  void colors;
  const isDeleteAction = destructive && label.toLowerCase().includes("delete");
  const destructiveBg = isDeleteAction ? "#FFF1F2" : "#FEF2F2";
  const destructiveIcon = isDeleteAction ? "#EF4444" : "#DC2626";
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: destructive ? destructiveBg : "#EFF6FF" },
        ]}
      >
        <Ionicons
          name={icon as any}
          size={22}
          color={destructive ? destructiveIcon : "#2563EB"}
        />
      </View>
      <Text
        style={[
          styles.menuLabel,
          { color: destructive ? destructiveIcon : "#0F172A" },
        ]}
      >
        {label}
      </Text>
      {value ? (
        <Text style={[styles.menuValue, { color: "#64748B" }]}>
          {value}
        </Text>
      ) : (
        <Ionicons
          name="chevron-forward"
          size={18}
          color="#94A3B8"
        />
      )}
    </TouchableOpacity>
  );
}

function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHandle, { backgroundColor: colors.muted }]} />
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>
          {title}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.modalOption,
                { borderBottomColor: colors.border },
                opt === selected && { backgroundColor: colors.secondary },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(opt);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  {
                    color:
                      opt === selected ? colors.primary : colors.foreground,
                  },
                ]}
              >
                {opt}
              </Text>
              {opt === selected && (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={colors.primary}
                />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, supabaseUserId, updateAvatarUrl, refreshUserProfile } = useAuth();
  const { language, setLanguage, t, enabledLanguages } = useLanguage();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { location: gpsLocation, loading: locationLoading, refreshLocation, requestPermission, permissionGranted } = useLocation();
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [available, setAvailable] = useState(true);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [cmsModal, setCmsModal] = useState<{ title: string; icon: string; body?: string; faqs?: any[] } | null>(null);

  const { data: cmsContent } = useQuery({
    queryKey: ["cmsContent"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/content`);
      if (!res.ok) return null;
      const d = await res.json() as { content: any };
      return d.content ?? null;
    },
    staleTime: 5 * 60_000,
  });

  // Fetch provider profile to seed availability
  const { data: providerProfile } = useQuery({
    queryKey: ["providerProfile", supabaseUserId],
    queryFn: () => (supabaseUserId ? fetchProviderProfile(supabaseUserId) : Promise.resolve(null)),
    enabled: !!user?.isProvider,
  });

  // Fetch subscription status for providers
  const { data: subInfo } = useQuery({
    queryKey: ["subscription", supabaseUserId],
    queryFn: async () => {
      if (!supabaseUserId) return null;
      const res = await fetch(`${API_BASE}/subscriptions/${supabaseUserId}`);
      if (!res.ok) return null;
      return (await res.json()) as {
        subscription: { providerId: string; plan: string; endDate: string } | null;
        active: boolean;
        daysLeft: number;
        expired: boolean;
      };
    },
    enabled: !!user?.isProvider && !!supabaseUserId,
    staleTime: 5 * 60_000,
  });

  // Fetch platform settings to check paymentGatewayEnabled
  const { data: platformSettings } = useQuery({
    queryKey: ["platformSettings"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings`);
      if (!res.ok) return null;
      return (await res.json()) as {
        paymentGatewayEnabled?: boolean;
        supportPhone?: string;
        supportEmail?: string;
        appName?: string;
      };
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (providerProfile?.available !== undefined) {
      setAvailable(providerProfile.available);
    }
  }, [providerProfile?.available]);

  async function handleAvailabilityToggle(val: boolean) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAvailable(val);
    if (supabaseUserId) {
      await updateProviderAvailability(supabaseUserId, val);
      queryClient.invalidateQueries({ queryKey: ["providerProfile"] });
    }
  }

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Keep pickedImageUri in sync whenever user.avatarUrl changes (e.g. after profile load or update).
  useEffect(() => {
    if (user?.avatarUrl !== undefined) {
      setPickedImageUri(user.avatarUrl ?? null);
    }
  }, [user?.avatarUrl]);

  // On every screen focus: refresh profile from DB to overwrite stale AsyncStorage values.
  // This ensures avatar and role are always showing the DB truth, not a cached startup value.
  useFocusEffect(
    useCallback(() => {
      console.log(
        "[profile:focus] id=" + (user?.id?.slice(0, 8) ?? "null") +
        " isProvider(local)=" + (user?.isProvider ?? "null") +
        " avatarUrl(local)=" + (user?.avatarUrl?.slice(0, 40) ?? "null"),
      );
      refreshUserProfile().catch(() => {});
    }, [user?.id]),
  );

  async function uploadPhoto(uri: string): Promise<string | null> {
    const uploadUrl = `${API_BASE}/upload/profile`;
    console.log("[upload:profile] start", { uri, API_BASE, uploadUrl });
    try {
      setUploadingPhoto(true);
      const rawName = uri.split("/").pop()?.split("?")[0] ?? "avatar.jpg";
      const ext = rawName.split(".").pop()?.toLowerCase().replace(/[^a-z]/g, "") ?? "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      console.log("[upload:profile] uploading", { ext, mime });

      // uploadAsync handles both content:// and file:// URIs reliably on Android.
      // fetch + FormData { uri, name, type } fails on Android — OkHttp cannot stream
      // local file URIs through the RN JS bridge ("Network request failed").
      //
      // userId is sent so the server can update profiles.avatar_url via the
      // service-role key — this survives an expired client-side Supabase JWT.
      const uploadResult = await uploadAsync(uploadUrl, uri, {
        fieldName: "image",
        httpMethod: "POST",
        uploadType: FileSystemUploadType.MULTIPART,
        mimeType: mime,
        parameters: { userId: supabaseUserId ?? "" },
      });

      console.log("[upload:profile] response", { status: uploadResult.status, body: uploadResult.body });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const data = JSON.parse(uploadResult.body) as { fileUrl?: string; error?: string };
        if (data.fileUrl) {
          await updateAvatarUrl(data.fileUrl);
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          queryClient.invalidateQueries({ queryKey: ["providers"] });
          queryClient.invalidateQueries({ queryKey: ["providerProfile"] });
          console.log("[upload:profile] success + caches invalidated →", data.fileUrl);
          return data.fileUrl;
        }
        console.warn("[upload:profile] no fileUrl in response", data);
      }

      throw new Error(`Server returned ${uploadResult.status}: ${uploadResult.body}`);
    } catch (err: any) {
      console.error("[upload:profile] error", err?.message ?? err);
      Alert.alert(t.uploadFailed, err?.message ?? t.couldNotUploadPhotoRetry);
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleChangePhoto() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    async function pickAndUpload(fromCamera: boolean) {
      if (fromCamera) {
        const current = await ImagePicker.getCameraPermissionsAsync();
        if (current.status !== "granted") {
          if (!current.canAskAgain) {
            Alert.alert(
              t.cameraPermissionRequired,
              t.cameraAccessDenied,
              [
                { text: t.cancel, style: "cancel" },
                { text: t.openSettings, onPress: () => Linking.openSettings() },
              ]
            );
            return;
          }
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(t.permissionNeeded, t.allowCameraProfilePhoto);
            return;
          }
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(t.permissionNeeded, t.allowPhotoLibraryProfile);
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setPickedImageUri(uri); // show immediately (optimistic)
        const uploaded = await uploadPhoto(uri);
        if (!uploaded) {
          // Revert optimistic update on failure
          setPickedImageUri(user?.avatarUrl ?? null);
        }
      }
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t.cancel, t.takePhoto, t.chooseFromLibrary, ...(pickedImageUri ? [t.removePhoto] : [])],
          cancelButtonIndex: 0,
          destructiveButtonIndex: pickedImageUri ? 3 : undefined,
        },
        (idx) => {
          if (idx === 1) pickAndUpload(true);
          else if (idx === 2) pickAndUpload(false);
          else if (idx === 3 && pickedImageUri) { setPickedImageUri(null); updateAvatarUrl(""); }
        },
      );
    } else {
      Alert.alert(
        t.changeProfilePhoto,
        t.chooseASource,
        [
          { text: t.takePhoto, onPress: () => pickAndUpload(true) },
          { text: t.chooseFromLibrary, onPress: () => pickAndUpload(false) },
          ...(pickedImageUri ? [{ text: t.removePhoto, style: "destructive" as const, onPress: () => { setPickedImageUri(null); updateAvatarUrl(""); } }] : []),
          { text: t.cancel, style: "cancel" },
        ],
      );
    }
  }

  async function handleDeleteAccount() {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    const doDelete = async () => {
      try {
        if (supabaseUserId) {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          await fetch(`${API_BASE}/users/${encodeURIComponent(supabaseUserId)}/delete`, {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
        }
        await signOut();
        router.replace("/(auth)/login");
      } catch {
        Alert.alert(t.error, t.couldNotDeleteAccount);
      }
    };

    const title = t.deleteAccount;
    const message = t.deleteAccountConfirm;

    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) {
        await doDelete();
      }
    } else {
      Alert.alert(title, message, [
        { text: t.cancel, style: "cancel" },
        { text: t.deleteAccount, style: "destructive", onPress: doDelete },
      ]);
    }
  }

  async function handleSignOut() {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    const doSignOut = async () => {
      await signOut();
      router.replace("/(auth)/login");
    };

    if (Platform.OS === "web") {
      // Alert.alert on web uses window.confirm which has limited callback support
      if (window.confirm(`${t.signOutTitle}\n${t.signOutMessage}`)) {
        await doSignOut();
      }
    } else {
      Alert.alert(t.signOutTitle, t.signOutMessage, [
        { text: t.cancel, style: "cancel" },
        { text: t.signOutConfirm, style: "destructive", onPress: doSignOut },
      ]);
    }
  }

  function handleAboutUs() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCmsModal({
      title: t.aboutUs,
      icon: "ℹ️",
      body: cmsContent?.aboutUs || t.aboutUsBody,
    });
  }

  function handleHelp() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCmsModal({
      title: t.helpCentre,
      icon: "🆘",
      body: cmsContent?.helpCentre || t.helpCentreBody,
    });
  }

  function handleTerms() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCmsModal({
      title: t.termsOfService,
      icon: "📋",
      body: cmsContent?.termsOfService || t.termsOfServiceBody,
    });
  }

  function handlePrivacy() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCmsModal({
      title: t.privacyPolicy,
      icon: "🔒",
      body: cmsContent?.privacyPolicy || t.privacyPolicyBody,
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 84 : 90,
        }}
      >
        <LinearGradient
          colors={["#1E40AF", "#2563EB"]}
          style={[styles.headerGrad, { paddingTop: topPad + 20 }]}
        >
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handleChangePhoto}
            activeOpacity={0.85}
            disabled={uploadingPhoto}
          >
            <Avatar
              initials={initials}
              color="rgba(255,255,255,0.3)"
              size={88}
              fontSize={32}
              imageUri={pickedImageUri}
            />
            {uploadingPhoto ? (
              <View style={styles.cameraLoadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <View style={styles.cameraBtn}>
                <Ionicons name="camera" size={16} color="#2563EB" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.name ?? t.user}</Text>
          <Text style={styles.userPhone}>{user?.phone ?? ""}</Text>
          {user?.isProvider && (
            <View style={styles.providerBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
              <Text style={styles.providerBadgeText}>{t.verifiedProvider}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Online / Offline toggle — providers only */}
        {user?.isProvider && (
          <View
            style={[
              styles.availRow,
              {
                backgroundColor: available ? "#F0FDF4" : colors.card,
                borderColor: available ? "#10B981" : colors.border,
              },
            ]}
          >
            <Ionicons name="ellipse" size={12} color="#10B981" style={styles.availIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.availTitle}>
                {available ? t.availableForWork : t.unavailable}
              </Text>
              <Text style={styles.availSub}>
                {available
                  ? t.customersCanDiscover
                  : t.profileTemporarilyHidden}
              </Text>
            </View>
            <Switch
              style={styles.availSwitch}
              value={available}
              onValueChange={handleAvailabilityToggle}
              trackColor={{ false: "#CBD5E1", true: "#10B981" }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}

        {/* Subscription section — providers only, hidden when subscription disabled */}
        {user?.isProvider && platformSettings?.paymentGatewayEnabled === true && (() => {
          const expired  = subInfo?.expired ?? false;
          const daysLeft = subInfo?.daysLeft ?? 0;
          const noSub    = !subInfo?.subscription;
          const planKey  = subInfo?.subscription?.plan ?? "";
          const planLabel =
            planKey === "trial"      ? t.freeTrial  :
            planKey === "monthly"    ? t.monthly     :
            planKey === "quarterly"  ? t.quarterly   :
            planKey === "halfYearly" ? t.halfYearly :
            planKey === "yearly"     ? t.yearly      :
            planKey ? planKey.charAt(0).toUpperCase() + planKey.slice(1) : "—";
          const endDateStr = subInfo?.subscription?.endDate;
          const endDateFmt = endDateStr
            ? new Date(endDateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "—";

          let statusColor = "#10B981";
          let iconName: React.ComponentProps<typeof Ionicons>["name"] = "checkmark-circle";
          let statusLabel = daysLeft === 1
            ? t.activeDayLeft.replace("{n}", String(daysLeft))
            : t.activeDaysLeft.replace("{n}", String(daysLeft));

          if (noSub) {
            statusLabel = t.noActiveSubscription;
            statusColor = "#94A3B8";
            iconName = "time-outline";
          } else if (expired) {
            statusLabel = t.expiredRenewToGoLive;
            statusColor = "#EF4444";
            iconName = "alert-circle";
          } else if (daysLeft <= 7) {
            statusLabel = daysLeft === 1
              ? t.expiringInDay.replace("{n}", String(daysLeft))
              : t.expiringInDays.replace("{n}", String(daysLeft));
            statusColor = "#F59E0B";
            iconName = "warning";
          }

          const supportPhone = platformSettings?.supportPhone ?? "";

          return (
            <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: expired ? "#FCA5A5" : daysLeft <= 7 && !noSub ? "#FDE68A" : colors.border }]}>
              {/* Header row */}
              <View style={styles.subCardHeader}>
                <View style={[styles.subIconWrap, { backgroundColor: statusColor + "18" }]}>
                  <Ionicons name={iconName} size={20} color={statusColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subTitle, { color: colors.foreground }]}>{t.subscription}</Text>
                  <Text style={[styles.subStatus, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>

              {/* Details grid */}
              {!noSub && (
                <View style={[styles.subDetails, { borderTopColor: colors.border }]}>
                  <View style={styles.subDetailRow}>
                    <Text style={[styles.subDetailLabel, { color: colors.mutedForeground }]}>{t.plan}</Text>
                    <Text style={[styles.subDetailValue, { color: colors.foreground }]}>{planLabel}</Text>
                  </View>
                  <View style={styles.subDetailRow}>
                    <Text style={[styles.subDetailLabel, { color: colors.mutedForeground }]}>{t.expires}</Text>
                    <Text style={[styles.subDetailValue, { color: colors.foreground }]}>{endDateFmt}</Text>
                  </View>
                  <View style={styles.subDetailRow}>
                    <Text style={[styles.subDetailLabel, { color: colors.mutedForeground }]}>{t.daysRemainingLabel}</Text>
                    <Text style={[styles.subDetailValue, { color: expired ? "#EF4444" : daysLeft <= 7 ? "#F59E0B" : "#10B981", fontFamily: "Inter_700Bold" }]}>
                      {expired ? "0" : daysLeft}
                    </Text>
                  </View>
                </View>
              )}

              {/* Action buttons */}
              <View style={[styles.subActions, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.subRenewBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push({ pathname: "/subscription", params: { providerId: subInfo?.subscription?.providerId ?? "" } });
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={14} color="#fff" />
                  <Text style={styles.subRenewText}>{noSub ? t.subscribe : t.renew}</Text>
                </TouchableOpacity>
                {!!supportPhone && (
                  <TouchableOpacity
                    style={[styles.subCareBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const tel = supportPhone.replace(/[^+\d]/g, "");
                      Linking.openURL(`tel:${tel}`).catch(() => {
                        Alert.alert(t.customerCare, t.callUsAt.replace("{phone}", supportPhone));
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="call-outline" size={14} color={colors.foreground} />
                    <Text style={[styles.subCareText, { color: colors.foreground }]}>{t.contactCare}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })()}

        <View
          style={styles.card}
        >
          <Text
            style={styles.sectionLabel}
          >
            {t.account}
          </Text>
          {/* Edit Profile — providers go to full provider form; customers go to basic form */}
          <MenuItem
            icon="person-outline"
            label={user?.isProvider ? t.editProviderProfile : t.editProfile}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (user?.isProvider) {
                router.push({ pathname: "/register-provider", params: { mode: "edit" } });
              } else {
                router.push("/edit-profile");
              }
            }}
            colors={colors}
          />
          {/* Account Details — providers only: name + phone basic info */}
          {user?.isProvider && (
            <MenuItem
              icon="person-circle-outline"
              label={t.accountDetails}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/edit-profile");
              }}
              colors={colors}
            />
          )}
          <MenuItem
            icon="language-outline"
            label={t.language}
            value={language}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowLanguagePicker(true);
            }}
            colors={colors}
          />
          {user?.isProvider && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/dashboard");
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="analytics-outline" size={22} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{t.myDashboard}</Text>
                <Text style={styles.menuSub}>
                  {t.earningsBookingsPerformance}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
          {/* Location Refresh — customers only */}
          {!user?.isProvider && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (!permissionGranted) {
                  await requestPermission();
                } else {
                  await refreshLocation();
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="location-outline" size={22} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{t.myLocation}</Text>
                <Text style={styles.menuSub} numberOfLines={1}>
                  {locationLoading
                    ? t.detecting
                    : gpsLocation?.address ?? (permissionGranted ? t.detecting : t.tapToEnableGps)}
                </Text>
              </View>
              {locationLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="refresh-outline" size={18} color="#94A3B8" />
              )}
            </TouchableOpacity>
          )}
        </View>
        {!user?.isProvider && (
          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/register-provider")}
            activeOpacity={0.9}
          >
            <View style={styles.registerIconWrap}>
              <Ionicons name="briefcase-outline" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.registerBtnTitle}>{t.registerAsProvider}</Text>
              <Text style={styles.registerBtnSub}>{t.earnMoneyWithSkills}</Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#FFFFFF" style={styles.registerArrow} />
          </TouchableOpacity>
        )}

        {/* Refer a Friend banner */}
        <TouchableOpacity
          style={styles.referBanner}
          onPress={() => router.push("/referral")}
          activeOpacity={0.8}
        >
          <View style={styles.referIconWrap}>
            <Ionicons name="people-outline" size={22} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.referTitle}>{t.inviteFriends}</Text>
            <Text style={styles.referSub}>{t.shareWithFriendsFamily}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <View
          style={styles.card}
        >
          <Text
            style={styles.sectionLabel}
          >
            {t.about}
          </Text>
          <MenuItem
            icon="information-circle-outline"
            label={t.aboutUs}
            onPress={handleAboutUs}
            colors={colors}
          />
          <MenuItem
            icon="star-outline"
            label="Rate SkillAd"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/rate-skillad" as never);
            }}
            colors={colors}
          />
          <Text
            style={[styles.sectionLabel, styles.sectionLabelAfterBlock]}
          >
            {t.support}
          </Text>
          <MenuItem
            icon="help-circle-outline"
            label={t.helpCenter}
            onPress={handleHelp}
            colors={colors}
          />
          <MenuItem
            icon="document-text-outline"
            label={t.termsOfService}
            onPress={handleTerms}
            colors={colors}
          />
          <MenuItem
            icon="shield-outline"
            label={t.privacyPolicy}
            onPress={handlePrivacy}
            colors={colors}
          />
        </View>

        <View
          style={styles.card}
        >
          <MenuItem
            icon="log-out-outline"
            label={t.signOut}
            onPress={handleSignOut}
            destructive
            colors={colors}
          />
          <MenuItem
            icon="trash-outline"
            label={t.deleteAccount}
            onPress={handleDeleteAccount}
            destructive
            colors={colors}
          />
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          {t.appVersion}
        </Text>
      </ScrollView>

      {cmsModal && (
        <CmsModal
          visible={!!cmsModal}
          onClose={() => setCmsModal(null)}
          title={cmsModal.title}
          icon={cmsModal.icon}
          body={cmsModal.body}
          faqs={cmsModal.faqs}
        />
      )}

      <PickerModal
        visible={showLanguagePicker}
        title={t.selectLanguage}
        options={enabledLanguages as unknown as string[]}
        selected={language}
        onSelect={(val) => setLanguage(val as AppLanguage)}
        onClose={() => setShowLanguagePicker(false)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerGrad: {
    alignItems: "center",
    paddingBottom: 32,
    gap: 4,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 2,
    padding: 4,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 52,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  subCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  subCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  subIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  subTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginBottom: 2,
  },
  subStatus: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  subDetails: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  subDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subDetailLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  subDetailValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  subActions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  subRenewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  subRenewText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
  },
  subCareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  subCareText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D1FAE5",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 14,
  },
  availIcon: {
    marginTop: 1,
  },
  availTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#0F172A",
    marginBottom: 4,
  },
  availSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
  availSwitch: {
    marginLeft: 10,
  },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#2563EB",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraLoadingOverlay: {
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 88,
    height: 88,
    borderRadius: 44,
    bottom: 4,
    right: 4,
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontFamily: "Inter_700Bold",
    fontSize: 34,
    color: "#FFFFFF",
    letterSpacing: 0.2,
    marginTop: 14,
    marginBottom: 6,
  },
  userPhone: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: "rgba(255,255,255,0.92)",
    letterSpacing: 0.3,
    marginBottom: 18,
  },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  providerBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#166534",
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8EDF5",
    backgroundColor: "#FFFFFF",
    padding: 18,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    overflow: "hidden",
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#64748B",
    marginLeft: 6,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  /** Extra space between consecutive section headers in the same card (e.g. About → Support). */
  sectionLabelAfterBlock: {
    marginTop: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    paddingHorizontal: 0,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
    borderBottomColor: "#F1F5F9",
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#0F172A",
    flex: 1,
  },
  menuValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#64748B",
  },
  menuSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#64748B",
    marginTop: 2,
  },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 22,
    gap: 12,
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  registerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  registerBtnTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 19,
    color: "#FFFFFF",
  },
  registerBtnSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.92)",
    marginTop: 2,
  },
  registerArrow: {
    marginRight: 2,
  },
  version: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 8,
  },
  referBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8EDF5",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 12,
    minHeight: 64,
  },
  referIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  referTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 2,
  },
  referSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  referBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  referBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
