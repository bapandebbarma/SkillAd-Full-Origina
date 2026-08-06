import React, { useRef, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "@/context/LanguageContext";
import type { AdBanner } from "@/lib/types";

const { width } = Dimensions.get("window");
const BANNER_WIDTH = width - 32;

interface AdBannerSliderProps {
  banners: AdBanner[];
  isLoading?: boolean;
  onPress?: (banner: AdBanner) => void;
}

export function AdBannerSlider({ banners, isLoading, onPress }: AdBannerSliderProps) {
  const { t } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * (BANNER_WIDTH + 12), animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (isLoading) {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.banner, styles.skeleton]}>
          <ActivityIndicator color="#94A3B8" size="small" />
        </View>
      </View>
    );
  }

  if (banners.length === 0) {
    return (
      <View style={styles.wrapper}>
        <LinearGradient
          colors={["#FF6B35", "#E55A2B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <Text style={styles.defaultTitle}>{t.findSkilledWorkersNearYou}</Text>
          <Text style={styles.defaultSubtitle}>{t.uploadFirstAd}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={BANNER_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / (BANNER_WIDTH + 12));
          setActiveIndex(index);
        }}
      >
        {banners.map((banner) =>
          banner.imageUri ? (
            <TouchableOpacity
              key={banner.id}
              onPress={() => onPress?.(banner)}
              activeOpacity={0.92}
              style={[styles.banner, styles.imageBanner]}
            >
              <Image
                source={{ uri: banner.imageUri }}
                style={styles.bannerImage}
                contentFit="cover"
              />
              {(banner.title || banner.subtitle) && (
                <View style={styles.imageOverlay}>
                  {banner.title ? (
                    <Text style={[styles.bannerTitle, { color: banner.textColor ?? "#FFFFFF" }]}>
                      {banner.title}
                    </Text>
                  ) : null}
                  {banner.subtitle ? (
                    <Text style={[styles.bannerSubtitle, { color: (banner.textColor ?? "#FFFFFF") + "CC" }]}>
                      {banner.subtitle}
                    </Text>
                  ) : null}
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              key={banner.id}
              onPress={() => onPress?.(banner)}
              activeOpacity={0.92}
            >
              <LinearGradient
                colors={[banner.bgColor ?? "#2563EB", shiftColor(banner.bgColor ?? "#2563EB")]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.banner}
              >
                <Text style={[styles.bannerTitle, { color: banner.textColor ?? "#FFFFFF" }]}>
                  {banner.title}
                </Text>
                {banner.subtitle ? (
                  <Text style={[styles.bannerSubtitle, { color: (banner.textColor ?? "#FFFFFF") + "CC" }]}>
                    {banner.subtitle}
                  </Text>
                ) : null}
              </LinearGradient>
            </TouchableOpacity>
          )
        )}
      </ScrollView>
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function shiftColor(hex: string): string {
  const map: Record<string, string> = {
    "#FF6B35": "#E55A2B",
    "#2563EB": "#1E40AF",
    "#0F172A": "#1E293B",
    "#10B981": "#059669",
    "#3B82F6": "#2563EB",
    "#8B5CF6": "#7C3AED",
  };
  return map[hex] ?? hex + "CC";
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  banner: {
    width: BANNER_WIDTH,
    height: 140,
    borderRadius: 14,
    padding: 20,
    justifyContent: "center",
    marginHorizontal: 16,
  },
  imageBanner: {
    padding: 0,
    overflow: "hidden",
    marginHorizontal: 0,
  },
  bannerImage: {
    width: BANNER_WIDTH,
    height: 140,
    borderRadius: 14,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  bannerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  defaultTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  defaultSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  skeleton: {
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    backgroundColor: "#2563EB",
  },
  dotInactive: {
    width: 6,
    backgroundColor: "#CBD5E1",
  },
});
