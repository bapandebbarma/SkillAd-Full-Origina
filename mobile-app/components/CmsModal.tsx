import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";

interface Faq {
  id: string;
  question: string;
  answer: string;
}

interface CmsModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  /** Plain text body — used for About Us, Terms, Privacy, Help */
  body?: string;
  /** FAQ list — used for FAQ modal */
  faqs?: Faq[];
}

function FaqItem({ faq, colors }: { faq: Faq; colors: ReturnType<typeof useColors> }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setOpen((v) => !v)}
      style={[styles.faqItem, { borderColor: colors.border, backgroundColor: colors.card }]}
    >
      <View style={styles.faqRow}>
        <Text style={[styles.faqQ, { color: colors.foreground, flex: 1 }]}>{faq.question}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </View>
      {open && (
        <Text style={[styles.faqA, { color: colors.mutedForeground }]}>{faq.answer}</Text>
      )}
    </TouchableOpacity>
  );
}

export function CmsModal({ visible, onClose, title, icon, body, faqs }: CmsModalProps) {
  const colors = useColors();
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.muted }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
            <Text style={styles.iconText}>{icon}</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
            <Ionicons name="close" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {faqs && faqs.length > 0 ? (
            <View style={styles.faqList}>
              {faqs.map((faq) => (
                <FaqItem key={faq.id} faq={faq} colors={colors} />
              ))}
            </View>
          ) : (
            <Text style={[styles.bodyText, { color: colors.foreground }]}>
              {body ?? t.contentNotAvailable}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 20,
  },
  title: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 48,
  },
  bodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
  },
  faqList: {
    gap: 10,
  },
  faqItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  faqRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  faqQ: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
  faqA: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
});
