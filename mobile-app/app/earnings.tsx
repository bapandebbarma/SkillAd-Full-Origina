import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from "react-native";
import Svg, { Rect, Line, Text as SvgText, Path, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { API_BASE } from "@/lib/db";
import type { EarningEntry, EarningBar } from "@/lib/types";

// ── Period helpers ────────────────────────────────────────────────────────────

type Period = "week" | "month" | "all";

function filterByPeriod(entries: EarningEntry[], period: Period): EarningEntry[] {
  const now = Date.now();
  if (period === "week")  return entries.filter(e => now - new Date(e.completedAt).getTime() <= 7  * 86400000);
  if (period === "month") return entries.filter(e => now - new Date(e.completedAt).getTime() <= 30 * 86400000);
  return entries;
}

function buildBars(
  entries: EarningEntry[],
  period: Period,
  dayLabels: string[],
  weekLabels: string[],
  monthLabels: string[],
): EarningBar[] {
  if (period === "week") {
    // One bar per day of the week (last 7 days)
    const bars: EarningBar[] = dayLabels.map(label => ({ label, amount: 0, jobCount: 0 }));
    entries.forEach(e => {
      const dayIdx = new Date(e.completedAt).getDay();
      bars[dayIdx].amount += e.amount;
      bars[dayIdx].jobCount += 1;
    });
    // Rotate so today is last
    const today = new Date().getDay();
    return [...bars.slice(today + 1), ...bars.slice(0, today + 1)];
  }
  if (period === "month") {
    // One bar per week (4 weeks)
    const bars: EarningBar[] = weekLabels.map(label => ({
      label, amount: 0, jobCount: 0,
    }));
    entries.forEach(e => {
      const daysAgo = Math.floor((Date.now() - new Date(e.completedAt).getTime()) / 86400000);
      const wk = Math.min(3, Math.floor(daysAgo / 7));
      bars[3 - wk].amount += e.amount;
      bars[3 - wk].jobCount += 1;
    });
    return bars;
  }
  // All time — group by month (last 6 months)
  const bars: EarningBar[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    bars.push({ label: monthLabels[d.getMonth()], amount: 0, jobCount: 0 });
  }
  entries.forEach(e => {
    const d = new Date(e.completedAt);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsDiff >= 0 && monthsDiff <= 5) {
      bars[5 - monthsDiff].amount += e.amount;
      bars[5 - monthsDiff].jobCount += 1;
    }
  });
  return bars;
}

function fmt(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000)   return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function fmtFull(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedCounter({ value, style }: { value: number; style: any }) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    animValue.setValue(0);
    const listener = animValue.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(animValue, {
      toValue: value,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animValue.removeListener(listener);
  }, [value]);

  return <Text style={style}>₹{display.toLocaleString("en-IN")}</Text>;
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

const CHART_W = 340;
const CHART_H = 160;
const BAR_RADIUS = 6;
const Y_LABELS = 4;

function BarChart({
  bars,
  accent,
  bg,
  textColor,
}: {
  bars: EarningBar[];
  accent: string;
  bg: string;
  textColor: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: false,
    }).start();
  }, [bars]);

  const maxAmount = Math.max(...bars.map(b => b.amount), 1);
  const n = bars.length;
  const barW = (CHART_W - 40) / n - 6;
  const chartTop = 10;
  const chartH = CHART_H - 40;

  // Y grid lines
  const yLines = Array.from({ length: Y_LABELS + 1 }, (_, i) =>
    Math.round((maxAmount / Y_LABELS) * i)
  );

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity="1" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.5" />
        </SvgGradient>
      </Defs>

      {/* Y grid lines */}
      {yLines.map((v, i) => {
        const y = chartTop + chartH - (v / maxAmount) * chartH;
        return (
          <React.Fragment key={i}>
            <Line x1={32} y1={y} x2={CHART_W} y2={y} stroke={bg} strokeWidth={1} />
            <SvgText
              x={28} y={y + 4}
              fontSize={8} fill={textColor} textAnchor="end" opacity={0.5}
            >
              {v >= 1000 ? `${v / 1000}k` : v}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Bars */}
      {bars.map((b, i) => {
        const barH = Math.max(4, (b.amount / maxAmount) * chartH);
        const x = 36 + i * ((CHART_W - 40) / n);
        const y = chartTop + chartH - barH;
        return (
          <React.Fragment key={b.label}>
            <Rect
              x={x} y={y}
              width={barW} height={barH}
              rx={BAR_RADIUS} ry={BAR_RADIUS}
              fill={b.amount > 0 ? "url(#barGrad)" : bg}
            />
            <SvgText
              x={x + barW / 2} y={CHART_H - 8}
              fontSize={9} fill={textColor} textAnchor="middle" opacity={0.6}
            >
              {b.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ bars, accent }: { bars: EarningBar[]; accent: string }) {
  const W = 80, H = 28;
  const max = Math.max(...bars.map(b => b.amount), 1);
  const points = bars.map((b, i) => {
    const x = (i / Math.max(bars.length - 1, 1)) * W;
    const y = H - (b.amount / max) * H * 0.85 - 2;
    return `${x},${y}`;
  });
  const d = `M ${points.join(" L ")}`;
  return (
    <Svg width={W} height={H}>
      <Path d={d} stroke={accent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Job row ───────────────────────────────────────────────────────────────────

function JobRow({
  entry,
  colors,
}: {
  entry: EarningEntry;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.jobRow, { borderBottomColor: colors.border }]}>
      <Avatar
        initials={entry.customerInitials}
        color={entry.customerAvatarColor}
        size={40}
        fontSize={13}
        imageUri={entry.customerAvatarUrl ?? undefined}
      />
      <View style={styles.jobInfo}>
        <Text style={[styles.jobName, { color: colors.foreground }]} numberOfLines={1}>
          {entry.customerName}
        </Text>
        <Text style={[styles.jobService, { color: colors.mutedForeground }]} numberOfLines={1}>
          {entry.service}
        </Text>
      </View>
      <View style={styles.jobRight}>
        <Text style={[styles.jobAmount, { color: colors.primary }]}>
          {fmtFull(entry.amount)}
        </Text>
        <Text style={[styles.jobDate, { color: colors.mutedForeground }]}>
          {entry.date}
        </Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function EarningsScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { t }    = useLanguage();
  const topPad   = Platform.OS === "web" ? 67 : insets.top;
  const botPad   = Platform.OS === "web" ? 32 : insets.bottom;
  const { user, supabaseUserId } = useAuth();

  const PERIODS: { key: Period; label: string }[] = [
    { key: "week",  label: t.thisWeek  },
    { key: "month", label: t.thisMonth },
    { key: "all",   label: t.allTime   },
  ];

  const dayLabels = [t.weekdaySun, t.weekdayMon, t.weekdayTue, t.weekdayWed, t.weekdayThu, t.weekdayFri, t.weekdaySat];
  const weekLabels = [t.week1, t.week2, t.week3, t.week4];
  const monthLabels = [
    t.monthJan, t.monthFeb, t.monthMar, t.monthApr, t.monthMay, t.monthJun,
    t.monthJul, t.monthAug, t.monthSep, t.monthOct, t.monthNov, t.monthDec,
  ];

  const [period, setPeriod] = useState<Period>("month");
  const [allEarnings, setAllEarnings] = useState<EarningEntry[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(true);

  useEffect(() => {
    const pid = user?.providerId ?? supabaseUserId;
    if (!pid) { setEarningsLoading(false); return; }
    fetch(`${API_BASE}/providers/${encodeURIComponent(pid)}/earnings`)
      .then((r) => (r.ok ? r.json() : { earnings: [] }))
      .then((data: any) => {
        const entries: EarningEntry[] = ((data.earnings ?? []) as any[]).map((e: any) => ({
          id:                  String(e.id ?? ""),
          customerName:        String(e.customerName        ?? t.customer),
          customerInitials:    String(e.customerInitials    ?? "C"),
          customerAvatarColor: String(e.customerAvatarColor ?? "#64748B"),
          customerAvatarUrl:   e.customerAvatarUrl ?? null,
          service:             String(e.service             ?? t.service),
          amount:              typeof e.amount === "number" ? e.amount : parseFloat(e.amount) || 0,
          date:                new Date(e.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          completedAt:         String(e.createdAt ?? new Date().toISOString()),
        }));
        setAllEarnings(entries);
      })
      .catch(() => {})
      .finally(() => setEarningsLoading(false));
  }, [user?.providerId, supabaseUserId, t.customer, t.service]);

  const filtered = useMemo(() => filterByPeriod(allEarnings, period), [allEarnings, period]);
  const bars     = useMemo(
    () => buildBars(filtered, period, dayLabels, weekLabels, monthLabels),
    [filtered, period, dayLabels, weekLabels, monthLabels],
  );

  const totalEarned = filtered.reduce((s, e) => s + e.amount, 0);
  const jobCount    = filtered.length;
  const avgPerJob   = jobCount > 0 ? Math.round(totalEarned / jobCount) : 0;
  const bestBar     = bars.reduce((b, cur) => (cur.amount > b.amount ? cur : b), bars[0] ?? { amount: 0, label: "" });
  const topService  = (() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.service] = (map[e.service] ?? 0) + e.amount; });
    const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : "—";
  })();

  // Growth vs previous period
  const prevFiltered = useMemo(() => {
    const now = Date.now();
    const ms = period === "week" ? 7 * 86400000 : period === "month" ? 30 * 86400000 : 999 * 86400000;
    return allEarnings.filter(e => {
      const age = now - new Date(e.completedAt).getTime();
      return age > ms && age <= 2 * ms;
    });
  }, [allEarnings, period]);
  const prevTotal = prevFiltered.reduce((s, e) => s + e.amount, 0);
  const growth = prevTotal > 0
    ? Math.round(((totalEarned - prevTotal) / prevTotal) * 100)
    : totalEarned > 0 ? 100 : 0;
  const growthUp = growth >= 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 24 }}
      >
        {/* ── Header gradient ── */}
        <LinearGradient
          colors={["#2563EB", "#1E40AF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGrad, { paddingTop: topPad + 12 }]}
        >
          {/* Back + title */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t.earnings}</Text>
            <View style={{ width: 34 }} />
          </View>

          {/* Big animated total */}
          <AnimatedCounter value={totalEarned} style={styles.heroAmount} />
          <View style={styles.heroSub}>
            <Text style={styles.heroPeriodLabel}>
              {period === "week" ? t.thisWeek : period === "month" ? t.thisMonth : t.allTime}
            </Text>
            <View style={[styles.growthChip, { backgroundColor: growthUp ? "rgba(74,222,128,0.25)" : "rgba(239,68,68,0.25)" }]}>
              <Ionicons
                name={growthUp ? "trending-up" : "trending-down"}
                size={12}
                color={growthUp ? "#4ADE80" : "#FCA5A5"}
              />
              <Text style={[styles.growthText, { color: growthUp ? "#4ADE80" : "#FCA5A5" }]}>
                {t.pctVsPrev.replace("{n}", `${growthUp ? "+" : ""}${growth}`)}
              </Text>
            </View>
          </View>

          {/* Period toggle */}
          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.periodBtn,
                  period === p.key && styles.periodBtnActive,
                ]}
                onPress={() => setPeriod(p.key)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.periodBtnText,
                  { color: period === p.key ? "#FFFFFF" : "rgba(255,255,255,0.65)" },
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* ── Chart card ── */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: colors.foreground }]}>{t.earningsChart}</Text>
              <Text style={[styles.chartSub, { color: colors.mutedForeground }]}>
                {(jobCount === 1 ? t.jobCompleted : t.jobsCompleted).replace("{n}", String(jobCount))}
              </Text>
            </View>
            <Sparkline bars={bars} accent={colors.primary} />
          </View>

          {bars.every(b => b.amount === 0) ? (
            <View style={styles.emptyChart}>
              <Ionicons name="bar-chart-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyChartText, { color: colors.mutedForeground }]}>
                {t.noEarningsInPeriod}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                bars={bars}
                accent={colors.primary}
                bg={colors.border}
                textColor={colors.mutedForeground}
              />
            </ScrollView>
          )}
        </View>

        {/* ── Metric cards ── */}
        <View style={styles.metricsGrid}>
          {[
            {
              icon: "cash-outline",
              label: t.avgPerJob,
              value: fmtFull(avgPerJob),
              accent: "#10B981",
              sub: t.fromNJobs.replace("{n}", String(jobCount)),
            },
            {
              icon: "trophy-outline",
              label: t.bestPeriod,
              value: fmt(bestBar.amount),
              accent: "#F59E0B",
              sub: bestBar.label || "—",
            },
            {
              icon: "briefcase-outline",
              label: t.jobsDone,
              value: String(jobCount),
              accent: colors.primary,
              sub: period === "week" ? t.thisWeekLower : period === "month" ? t.thisMonthLower : t.allTimeLower,
            },
            {
              icon: "star-outline",
              label: t.topService,
              value: topService.split(" ").slice(0, 2).join(" "),
              accent: "#8B5CF6",
              sub: t.mostEarned,
            },
          ].map(m => (
            <View key={m.label} style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.metricIcon, { backgroundColor: m.accent + "18" }]}>
                <Ionicons name={m.icon as any} size={18} color={m.accent} />
              </View>
              <Text style={[styles.metricValue, { color: colors.foreground }]} numberOfLines={1}>
                {m.value}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
              <Text style={[styles.metricSub, { color: colors.mutedForeground }]}>{m.sub}</Text>
            </View>
          ))}
        </View>

        {/* ── Service breakdown ── */}
        {filtered.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.byService}</Text>
            </View>
            <ServiceBreakdown entries={filtered} colors={colors} />
          </>
        )}

        {/* ── Job history ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.completedJobs}</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.countBadgeText, { color: colors.mutedForeground }]}>
              {filtered.length}
            </Text>
          </View>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyJobs}>
            <Ionicons name="receipt-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyJobsTitle, { color: colors.foreground }]}>{t.noJobsYet}</Text>
            <Text style={[styles.emptyJobsSub, { color: colors.mutedForeground }]}>
              {t.completedJobsAppearHere}
            </Text>
          </View>
        ) : (
          <View style={[styles.jobsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {filtered.map((entry, i) => (
              <JobRow
                key={entry.id}
                entry={entry}
                colors={colors}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Service breakdown component ───────────────────────────────────────────────

function ServiceBreakdown({
  entries,
  colors,
}: {
  entries: EarningEntry[];
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useLanguage();
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const map: Record<string, { amount: number; count: number }> = {};
  entries.forEach(e => {
    if (!map[e.service]) map[e.service] = { amount: 0, count: 0 };
    map[e.service].amount += e.amount;
    map[e.service].count += 1;
  });
  const sorted = Object.entries(map)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5);

  const BAR_COLORS = [colors.primary, "#10B981", "#F59E0B", "#8B5CF6", "#3B82F6"];

  return (
    <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {sorted.map(([service, data], i) => {
        const pct = total > 0 ? data.amount / total : 0;
        const color = BAR_COLORS[i % BAR_COLORS.length];
        return (
          <View key={service} style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.breakdownDot, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.breakdownService, { color: colors.foreground }]} numberOfLines={1}>
                  {service}
                </Text>
                <Text style={[styles.breakdownCount, { color: colors.mutedForeground }]}>
                  {(data.count === 1 ? t.jobCompleted : t.jobsCompleted).replace("{n}", String(data.count))}
                </Text>
              </View>
            </View>
            <View style={styles.breakdownRight}>
              <Text style={[styles.breakdownAmount, { color: colors.foreground }]}>
                {fmtFull(data.amount)}
              </Text>
              <View style={[styles.breakdownBarBg, { backgroundColor: colors.secondary }]}>
                <View
                  style={[
                    styles.breakdownBarFill,
                    { width: `${Math.round(pct * 100)}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerGrad: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: "#FFFFFF" },
  heroAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 42,
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  heroSub: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  heroPeriodLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
  },
  growthChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  growthText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  periodRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    padding: 3,
    marginTop: 10,
  },
  periodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 10,
  },
  periodBtnActive: { backgroundColor: "#FFFFFF" },
  periodBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  // Chart
  chartCard: {
    margin: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  chartTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  chartSub:   { fontFamily: "Inter_400Regular",  fontSize: 12, marginTop: 2 },
  emptyChart: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  emptyChartText: { fontFamily: "Inter_400Regular", fontSize: 13 },

  // Metrics
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 4,
  },
  metricCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  metricLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  metricSub:   { fontFamily: "Inter_400Regular", fontSize: 10 },

  // Section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
    gap: 8,
  },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  countBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },

  // Service breakdown
  breakdownCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  breakdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownService: { fontFamily: "Inter_500Medium", fontSize: 13 },
  breakdownCount:   { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  breakdownRight: {
    alignItems: "flex-end",
    gap: 5,
    width: 100,
  },
  breakdownAmount: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  breakdownBarBg: {
    width: 100,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  breakdownBarFill: { height: 5, borderRadius: 3 },

  // Jobs
  emptyJobs: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 32,
    gap: 10,
  },
  emptyJobsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  emptyJobsSub:   { fontFamily: "Inter_400Regular",  fontSize: 13, textAlign: "center", lineHeight: 20 },
  jobsCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  jobInfo:    { flex: 1 },
  jobName:    { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  jobService: { fontFamily: "Inter_400Regular",  fontSize: 12, marginTop: 2 },
  jobRight:   { alignItems: "flex-end", gap: 3 },
  jobAmount:  { fontFamily: "Inter_700Bold",     fontSize: 14 },
  jobDate:    { fontFamily: "Inter_400Regular",  fontSize: 11 },
});
