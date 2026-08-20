import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  ActionSheetIOS,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/db";

export default function EditProfileScreen() {
  const colors = useColors();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateAvatarUrl, supabaseUserId } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (user?.avatarUrl) setPickedImageUri(user.avatarUrl);
  }, [user?.name, user?.avatarUrl]);

  const initials = (name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function uploadPhoto(uri: string): Promise<string | null> {
    const uploadUrl = `${API_BASE}/upload/profile`;
    console.log("[upload:edit-profile] start", { uri, API_BASE, uploadUrl });
    try {
      setUploadingPhoto(true);
      const rawName = uri.split("/").pop()?.split("?")[0] ?? "avatar.jpg";
      const ext = rawName.split(".").pop()?.toLowerCase().replace(/[^a-z]/g, "") ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      console.log("[upload:edit-profile] uploading", { ext, mimeType });

      // uploadAsync handles both content:// and file:// URIs reliably on Android.
      // fetch(localUri).blob() and fetch+FormData { uri,name,type } both fail on Android
      // because OkHttp cannot stream those URI schemes through RN's JS bridge.
      const result = await uploadAsync(uploadUrl, uri, {
        fieldName: "image",
        httpMethod: "POST",
        uploadType: FileSystemUploadType.MULTIPART,
        mimeType,
        parameters: { userId: supabaseUserId ?? "" },
      });

      console.log("[upload:edit-profile] response", { status: result.status, body: result.body });

      if (result.status >= 200 && result.status < 300) {
        const data = JSON.parse(result.body) as { fileUrl?: string; error?: string };
        if (data.fileUrl) {
          await updateAvatarUrl(data.fileUrl);
          console.log("[upload:edit-profile] success →", data.fileUrl);
          return data.fileUrl;
        }
        console.warn("[upload:edit-profile] no fileUrl in response", data);
      }
      throw new Error(`Server returned ${result.status}: ${result.body}`);
    } catch (err: any) {
      console.error("[upload:edit-profile] error", err?.message ?? err);
      Alert.alert(t.uploadFailed, err?.message ?? t.couldNotUploadPhoto);
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleChangePhoto() {
  console.log("===== HANDLE CHANGE PHOTO CALLED =====");
  Alert.alert("Debug", "handleChangePhoto called");
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    async function pickAndUpload(fromCamera: boolean) {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(t.permissionNeeded, t.allowCameraTakePhoto);
          return;
        }
      } else if (Platform.OS === "ios") {
        // Android Photo Picker does not need broad READ_MEDIA_* access.
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(t.permissionNeeded, t.allowPhotoLibrary);
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
console.log("[IMAGE PICKER RESULT]", result);
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setPickedImageUri(uri);
        console.log("[SELECTED URI]", uri);

const uploaded = await uploadPhoto(uri);

console.log("[UPLOAD RESULT]", uploaded);
        if (!uploaded) setPickedImageUri(user?.avatarUrl ?? null);
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
      Alert.alert(t.changeProfilePhoto, t.chooseASource, [
        { text: t.takePhoto, onPress: () => pickAndUpload(true) },
        { text: t.chooseFromLibrary, onPress: () => pickAndUpload(false) },
        ...(pickedImageUri ? [{ text: t.removePhoto, style: "destructive" as const, onPress: () => { setPickedImageUri(null); updateAvatarUrl(""); } }] : []),
        { text: t.cancel, style: "cancel" },
      ]);
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t.nameRequired, t.pleaseEnterName);
      return;
    }
    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (supabaseUserId) {
        await supabase
          .from("profiles")
          .update({ name: trimmed })
          .eq("id", supabaseUserId);
      } else {
        await fetch(`${API_BASE}/auth/update-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
      }

      Alert.alert(t.saved, t.profileUpdated, [
        { text: t.ok, onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(t.error, err?.message ?? t.couldNotSave);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t.editProfile}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn} activeOpacity={0.8}>
          {saving
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={[styles.saveBtnText, { color: colors.primary }]}>{t.save}</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.avatarSection} onPress={handleChangePhoto} activeOpacity={0.85} disabled={uploadingPhoto}>
          <View style={styles.avatarWrap}>
            <Avatar
              initials={initials}
              color={colors.primary}
              size={96}
              fontSize={34}
              imageUri={pickedImageUri}
            />
            {uploadingPhoto
              ? (
                <View style={[styles.cameraOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )
              : (
                <View style={[styles.cameraBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              )
            }
          </View>
          <Text style={[styles.changePhotoText, { color: colors.primary }]}>{t.changeProfilePhoto}</Text>
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t.fullName}</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={name}
            onChangeText={setName}
            placeholder={t.enterFullName}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>{t.phoneNumber}</Text>
          <View style={[styles.phoneRow, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
            <Ionicons name="call-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
            <Text style={[styles.phoneText, { color: colors.mutedForeground }]}>{user?.phone ?? "—"}</Text>
            <View style={[styles.lockedBadge, { backgroundColor: colors.muted }]}>
              <Ionicons name="lock-closed" size={11} color={colors.mutedForeground} />
              <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>{t.locked}</Text>
            </View>
          </View>
          <Text style={[styles.phoneHint, { color: colors.mutedForeground }]}>
            {t.phoneLockedHint}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveFullBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveFullBtnText}>{t.saveChanges}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold" },
  saveBtn: { padding: 4 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  body: { padding: 20, gap: 20 },
  avatarSection: { alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  cameraOverlay: {
    position: "absolute", bottom: 0, right: 0,
    width: 96, height: 96, borderRadius: 48,
    justifyContent: "center", alignItems: "center",
  },
  cameraBtn: {
    position: "absolute", bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  changePhotoText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
  },
  phoneText: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  lockedText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  phoneHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8, lineHeight: 17 },
  saveFullBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveFullBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
