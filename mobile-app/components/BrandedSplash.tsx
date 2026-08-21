/**
 * Short branded startup screen shown immediately after the native Android/iOS splash.
 *
 * Why this exists:
 * Android 12+ system splash can only show a centered logo on a solid background.
 * Title ("SkillAd") and tagline ("Find Skills. Get Work.") are rendered here so the
 * handoff from native splash → app feels intentional (same white background, no awkward delay).
 *
 * Alignment (Stage 1 → Stage 2):
 * Uses the same splash-icon.png and 200×200 box as expo-splash-screen imageWidth so the
 * logo stays visually stationary; text is laid out below without shifting the icon.
 */
import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";

/** Same asset as app.json / expo-splash-screen native splash. */
const LOGO = require("../assets/images/splash-icon.png");

/** Matches expo-splash-screen plugin `imageWidth: 200`. */
const LOGO_SIZE = 200;
/** Gap between bottom of centered logo and title (previous marginBottom on logo). */
const LOGO_TO_TITLE_GAP = 28;

export function BrandedSplash() {
  return (
    <View style={styles.root} accessibilityLabel="SkillAd">
      {/* Icon at true viewport center — must not move when text appears. */}
      <View style={styles.iconLayer} pointerEvents="none">
        <Image
          source={LOGO}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      {/* Text below the centered icon; absolute so it does not affect icon position. */}
      <View style={styles.textLayer} pointerEvents="none">
        <View style={styles.textBlock}>
          <Text style={styles.title}>SkillAd</Text>
          <Text style={styles.tagline}>Find Skills. Get Work.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  textLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  textBlock: {
    position: "absolute",
    top: "50%",
    // Start just below the centered 200×200 logo (+ previous 28px gap).
    marginTop: LOGO_SIZE / 2 + LOGO_TO_TITLE_GAP,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
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
