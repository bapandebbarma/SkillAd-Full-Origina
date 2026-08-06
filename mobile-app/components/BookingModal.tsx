import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import type { BookingCard } from "@/lib/types";

interface BookingModalProps {
  visible: boolean;
  providerName: string;
  providerServices?: string[];
  onClose: () => void;
  onSend: (booking: BookingCard) => void;
}

interface DayLabels {
  today: string;
  tomorrow: string;
  dayNames: string[];
  monthNames: string[];
}

function buildDays(count: number, labels: DayLabels) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      label: i === 0 ? labels.today : i === 1 ? labels.tomorrow : labels.dayNames[d.getDay()],
      date: `${labels.dayNames[d.getDay()]}, ${d.getDate()} ${labels.monthNames[d.getMonth()]}`,
      key: d.toISOString(),
    });
  }
  return days;
}

export function BookingModal({
  visible,
  providerName,
  providerServices = [],
  onClose,
  onSend,
}: BookingModalProps) {
  const colors = useColors();
  const { t } = useLanguage();

  const timeSlots = useMemo(
    () => [
      t.time800am, t.time900am, t.time1000am, t.time1100am,
      t.time1200pm, t.time100pm, t.time200pm, t.time300pm,
      t.time400pm, t.time500pm, t.time600pm, t.time700pm,
    ],
    [t],
  );

  const days = useMemo(
    () =>
      buildDays(14, {
        today: t.today,
        tomorrow: t.tomorrow,
        dayNames: [
          t.weekdaySun, t.weekdayMon, t.weekdayTue, t.weekdayWed,
          t.weekdayThu, t.weekdayFri, t.weekdaySat,
        ],
        monthNames: [
          t.monthJan, t.monthFeb, t.monthMar, t.monthApr, t.monthMay, t.monthJun,
          t.monthJul, t.monthAug, t.monthSep, t.monthOct, t.monthNov, t.monthDec,
        ],
      }),
    [t],
  );

  const [selectedService, setSelectedService] = useState(providerServices.length > 0 ? providerServices[0] : "__custom__");
  const [customService, setCustomService] = useState("");
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"service" | "datetime" | "confirm">("service");

  const service = selectedService === "__custom__" ? customService.trim() : selectedService;
  const canProceedStep1 = service.length > 0;
  const canProceedStep2 = selectedTime !== null;
  const canSend = canProceedStep1 && canProceedStep2;

  function reset() {
    setSelectedService(providerServices.length > 0 ? providerServices[0] : "__custom__");
    setCustomService("");
    setSelectedDay(0);
    setSelectedTime(null);
    setAmount("");
    setNote("");
    setStep("service");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSend() {
    if (!canSend) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const booking: BookingCard = {
      service,
      date: days[selectedDay].date,
      time: selectedTime!,
      amount: amount.trim() ? (amount.startsWith("₹") ? amount.trim() : `₹${amount.trim()}`) : t.toBeConfirmed,
      amountValue: parseFloat(amount.replace(/[^\d.]/g, "")) || 0,
    };
    reset();
    onSend(booking);
  }

  async function goToStep(s: typeof step) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s);
  }

  const STEPS = ["service", "datetime", "confirm"];
  const stepIndex = STEPS.indexOf(step);
  const stepLabels = [t.service, t.dateAndTime, t.confirm];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.muted }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>{t.requestBooking}</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t.withName.replace("{name}", providerName)}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Step indicators */}
          <View style={styles.stepRow}>
            {stepLabels.map((label, i) => (
              <React.Fragment key={label}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: i <= stepIndex ? colors.primary : colors.muted,
                        borderColor: i === stepIndex ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {i < stepIndex ? (
                      <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.stepDotText}>{i + 1}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      { color: i <= stepIndex ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
                {i < 2 && (
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: i < stepIndex ? colors.primary : colors.border },
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* ── STEP 1: Service ── */}
          {step === "service" && (
            <View style={styles.stepContent}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                {t.whatServiceNeed}
              </Text>

              {providerServices.length > 0 && (
                <View style={styles.chipGrid}>
                  {providerServices.map((s) => {
                    const active = selectedService === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.serviceChip,
                          {
                            backgroundColor: active ? colors.primary : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={async () => {
                          setSelectedService(s);
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text
                          style={[
                            styles.serviceChipText,
                            { color: active ? "#FFFFFF" : colors.foreground },
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[
                      styles.serviceChip,
                      {
                        backgroundColor: selectedService === "__custom__" ? colors.primary : colors.card,
                        borderColor: selectedService === "__custom__" ? colors.primary : colors.border,
                        borderStyle: "dashed",
                      },
                    ]}
                    onPress={async () => {
                      setSelectedService("__custom__");
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons
                      name="add"
                      size={14}
                      color={selectedService === "__custom__" ? "#FFFFFF" : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.serviceChipText,
                        { color: selectedService === "__custom__" ? "#FFFFFF" : colors.mutedForeground },
                      ]}
                    >
                      {t.other}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {(selectedService === "__custom__" || providerServices.length === 0) && (
                <View
                  style={[
                    styles.inputWrap,
                    { borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                >
                  <Ionicons name="construct-outline" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder={t.describeServiceNeed}
                    placeholderTextColor={colors.mutedForeground}
                    value={customService}
                    onChangeText={setCustomService}
                    autoFocus={selectedService === "__custom__"}
                    maxLength={80}
                  />
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 16 }]}>
                {t.budgetOptional}
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Text style={[styles.rupeeSign, { color: colors.mutedForeground }]}>₹</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t.enterBudgetOrBlank}
                  placeholderTextColor={colors.mutedForeground}
                  value={amount}
                  onChangeText={(text) => setAmount(text.replace(/[^\d]/g, ""))}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>
          )}

          {/* ── STEP 2: Date & Time ── */}
          {step === "datetime" && (
            <View style={styles.stepContent}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{t.selectADate}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
                {days.map((d, i) => {
                  const active = selectedDay === i;
                  return (
                    <TouchableOpacity
                      key={d.key}
                      style={[
                        styles.dayCard,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={async () => {
                        setSelectedDay(i);
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[styles.dayLabel, { color: active ? "#FFFFFF" : colors.mutedForeground }]}
                      >
                        {d.label}
                      </Text>
                      <Text
                        style={[styles.dayNum, { color: active ? "#FFFFFF" : colors.foreground }]}
                      >
                        {d.date.split(", ")[1]?.split(" ")[0]}
                      </Text>
                      <Text
                        style={[styles.dayMonth, { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}
                      >
                        {d.date.split(" ").pop()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 16 }]}>
                {t.selectATime}
              </Text>
              <View style={styles.timeGrid}>
                {timeSlots.map((timeSlot) => {
                  const active = selectedTime === timeSlot;
                  return (
                    <TouchableOpacity
                      key={timeSlot}
                      style={[
                        styles.timeChip,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={async () => {
                        setSelectedTime(timeSlot);
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[
                          styles.timeChipText,
                          { color: active ? "#FFFFFF" : colors.foreground },
                        ]}
                      >
                        {timeSlot}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === "confirm" && (
            <View style={styles.stepContent}>
              <View
                style={[
                  styles.confirmCard,
                  { backgroundColor: colors.secondary, borderColor: colors.primary + "40" },
                ]}
              >
                <View style={styles.confirmHeader}>
                  <View style={[styles.confirmIcon, { backgroundColor: colors.primary + "20" }]}>
                    <Ionicons name="calendar" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.confirmTitle, { color: colors.foreground }]}>
                      {t.bookingSummary}
                    </Text>
                    <Text style={[styles.confirmSub, { color: colors.mutedForeground }]}>
                      {t.reviewBeforeSending}
                    </Text>
                  </View>
                </View>

                <View style={[styles.confirmDivider, { backgroundColor: colors.border }]} />

                {[
                  { icon: "construct-outline", label: t.service, value: service },
                  { icon: "calendar-outline", label: t.date, value: days[selectedDay].date },
                  { icon: "time-outline", label: t.time, value: selectedTime! },
                  {
                    icon: "cash-outline",
                    label: t.budget,
                    value: amount ? `₹${amount}` : t.toBeConfirmed,
                    highlight: !!amount,
                  },
                ].map((row) => (
                  <View key={row.label} style={styles.confirmRow}>
                    <Ionicons name={row.icon as any} size={16} color={colors.mutedForeground} />
                    <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>
                      {row.label}
                    </Text>
                    <Text
                      style={[
                        styles.confirmValue,
                        { color: row.highlight ? colors.primary : colors.foreground },
                      ]}
                    >
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={[styles.noteWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name="chatbubble-outline" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.noteInput, { color: colors.foreground }]}
                  placeholder={t.addNoteOptional}
                  placeholderTextColor={colors.mutedForeground}
                  value={note}
                  onChangeText={setNote}
                  maxLength={200}
                  multiline
                />
              </View>

              <Text style={[styles.confirmNote, { color: colors.mutedForeground }]}>
                {t.bookingRequestNote}
              </Text>
            </View>
          )}

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {step !== "service" && (
              <TouchableOpacity
                style={[styles.backBtn, { borderColor: colors.border }]}
                onPress={() => goToStep(step === "confirm" ? "datetime" : "service")}
              >
                <Ionicons name="arrow-back" size={16} color={colors.mutedForeground} />
                <Text style={[styles.backBtnText, { color: colors.mutedForeground }]}>{t.back}</Text>
              </TouchableOpacity>
            )}

            {step === "service" && (
              <TouchableOpacity
                style={[
                  styles.nextBtn,
                  { backgroundColor: canProceedStep1 ? colors.primary : colors.muted },
                ]}
                onPress={() => canProceedStep1 && goToStep("datetime")}
                disabled={!canProceedStep1}
              >
                <Text
                  style={[
                    styles.nextBtnText,
                    { color: canProceedStep1 ? "#FFFFFF" : colors.mutedForeground },
                  ]}
                >
                  {t.nextDateTime}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={canProceedStep1 ? "#FFFFFF" : colors.mutedForeground}
                />
              </TouchableOpacity>
            )}

            {step === "datetime" && (
              <TouchableOpacity
                style={[
                  styles.nextBtn,
                  { backgroundColor: canProceedStep2 ? colors.primary : colors.muted },
                ]}
                onPress={() => canProceedStep2 && goToStep("confirm")}
                disabled={!canProceedStep2}
              >
                <Text
                  style={[
                    styles.nextBtnText,
                    { color: canProceedStep2 ? "#FFFFFF" : colors.mutedForeground },
                  ]}
                >
                  {t.reviewBooking}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={canProceedStep2 ? "#FFFFFF" : colors.mutedForeground}
                />
              </TouchableOpacity>
            )}

            {step === "confirm" && (
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: colors.primary }]}
                onPress={handleSend}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={[styles.nextBtnText, { color: "#FFFFFF" }]}>{t.sendBookingRequest}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 19 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  stepItem: { alignItems: "center", gap: 5 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  stepDotText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#FFFFFF" },
  stepLabel: { fontFamily: "Inter_500Medium", fontSize: 10 },
  stepLine: { flex: 1, height: 2, marginBottom: 14, marginHorizontal: 4 },
  stepContent: { paddingHorizontal: 20, marginBottom: 16 },
  sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 10 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  serviceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  serviceChipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  rupeeSign: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  daysRow: { gap: 8, paddingVertical: 4 },
  dayCard: {
    width: 62,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
  },
  dayLabel: { fontFamily: "Inter_500Medium", fontSize: 10 },
  dayNum: { fontFamily: "Inter_700Bold", fontSize: 20 },
  dayMonth: { fontFamily: "Inter_400Regular", fontSize: 10 },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: "22%",
    alignItems: "center",
  },
  timeChipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  confirmCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 10,
    marginBottom: 14,
  },
  confirmHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  confirmIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  confirmSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  confirmDivider: { height: 1, marginVertical: 4 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  confirmLabel: { fontFamily: "Inter_400Regular", fontSize: 13, width: 56 },
  confirmValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 },
  noteWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    minHeight: 70,
  },
  noteInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  confirmNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  navRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  backBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  nextBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 14,
    gap: 8,
  },
  nextBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
