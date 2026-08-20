/**
 * Short branded startup screen shown immediately after the native Android/iOS splash.
 *
 * Why this exists:
 * Android 12+ system splash can only show a centered logo on a solid background.
 * Title ("SkillAd") and tagline ("Find Skills. Get Work.") are rendered here so the
 * handoff from native splash → app feels intentional (same white background, no awkward delay).
 */
import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LOGO = require("../assets/images/icon.png");

export function BrandedSplash() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}
      accessibilityLabel="SkillAd"
    >
      <View style={styles.center}>
        <Image
          source={LOGO}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.title}>SkillAd</Text>
        <Text style={styles.tagline}>Find Skills. Get Work.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    // Keep composition inside a comfortable visual safe band on tall phones.
    maxWidth: 360,
    width: "78%",
    paddingHorizontal: 16,
  },
  logo: {
    // ~42% of typical phone width at maxWidth 360 → balanced, not tiny, not edge-to-edge.
    width: 168,
    height: 168,
    marginBottom: 28,
  },
  title: {
    fontFamily: Platform.select({
      ios: "Inter_700Bold",
      android: "Inter_700Bold",
      default: "Inter_700Bold",
    }),
    fontSize: 36,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 10,
  },
  tagline: {
    fontFamily: Platform.select({
      ios: "Inter_500Medium",
      android: "Inter_500Medium",
      default: "Inter_500Medium",
    }),
    fontSize: 16,
    fontWeight: "500",
    color: "#64748B",
    letterSpacing: 0.2,
    textAlign: "center",
    lineHeight: 22,
  },
});
