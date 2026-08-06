import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

interface AvatarProps {
  initials: string;
  color: string;
  size?: number;
  fontSize?: number;
  imageUri?: string | null;
}

export function Avatar({
  initials,
  color,
  size = 48,
  fontSize = 16,
  imageUri,
}: AvatarProps) {
  const radius = size / 2;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: radius },
        ]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: radius, backgroundColor: color },
      ]}
    >
      <Text style={[styles.text, { fontSize, color: "#FFFFFF" }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    backgroundColor: "#E5E7EB",
  },
  text: {
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
