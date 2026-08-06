import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Category } from "@/lib/types";

interface CategoryGridProps {
  categories: Category[];
  selected?: string | null;
  onSelect: (category: Category | null) => void;
}

export function CategoryGrid({ categories, selected, onSelect }: CategoryGridProps) {
  const colors = useColors();

  return (
    <View style={styles.grid}>
      {categories.map((cat) => {
        const isSelected = selected === cat.id;
        const isSingleWord = !cat.name.trim().includes(" ");
        const isSeeAllCard = cat.id === "__seeall__";
        return (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.item,
              {
                backgroundColor: isSelected ? cat.color : colors.card,
                borderColor: isSelected ? cat.color : colors.border,
              },
            ]}
            onPress={() => onSelect(isSelected ? null : cat)}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : cat.color + "20" },
              ]}
            >
              <Ionicons
                name={cat.icon as any}
                size={isSeeAllCard ? 27 : 25}
                color={isSelected ? "#FFFFFF" : cat.color}
              />
            </View>
            <Text
              style={[
                styles.label,
                { color: isSelected ? "#FFFFFF" : colors.foreground },
              ]}
              numberOfLines={isSingleWord ? 1 : 2}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              ellipsizeMode="tail"
              textBreakStrategy="simple"
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 4,
  },
  item: {
    width: "22%",
    aspectRatio: 0.85,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 11.5,
    lineHeight: 13.8,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 2,
  },
});
