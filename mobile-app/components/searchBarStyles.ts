export const SEARCH_BAR_COLORS = {
  border: "#E2E8F0",
  icon: "#64748B",
  placeholder: "#94A3B8",
} as const;

export const SEARCH_BAR_SHARED = {
  borderRadius: 14,
  borderWidth: 1,
  paddingHorizontal: 16,
  height: 54,
  gap: 12,
  shadowColor: "#0F172A",
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0 as const, height: 2 as const },
  elevation: 2,
} as const;

export const SEARCH_BAR_TEXT = {
  fontFamily: "Inter_400Regular",
  fontSize: 15,
} as const;
