import { BarChart3 } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { Card, typography } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { SubjectResult } from "@/types/portal";

const CHART_HEIGHT = 246;
const PLOT_BOTTOM = 188;
const PLOT_HEIGHT = 140;

export function SubjectBarChart({ subjects }: { subjects: SubjectResult[] }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(width - 68, subjects.length * 78 + 48);

  if (!subjects.length) return <Card><Text style={[typography.body, { color: colors.muted }]}>No subject progress is available.</Text></Card>;

  return <Card style={styles.card}>
    <View style={styles.chartHeader}>
      <View style={[styles.chartIcon, { backgroundColor: colors.primarySoft }]}>
        <BarChart3 size={21} color={colors.accent} />
      </View>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { color: colors.text }]}>Carry mark by subject</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Carry achieved (%) · scale 0–100</Text>
      </View>
    </View>

    <View style={[styles.plot, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Svg width={chartWidth} height={CHART_HEIGHT} accessibilityLabel="Carry mark percentage by subject">
          {[0, 25, 50, 75, 100].map(value => {
            const y = PLOT_BOTTOM - value / 100 * PLOT_HEIGHT;
            return <G key={value}>
              <Line x1={36} y1={y} x2={chartWidth - 8} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray={value === 0 ? undefined : "3 5"} />
              <SvgText x={29} y={y + 4} textAnchor="end" fill={colors.muted} fontSize={10} fontWeight="600">{value}</SvgText>
            </G>;
          })}
          {subjects.map((subject, index) => {
            const released = subject.is_finalised && subject.carry_mark !== null;
            const percentage = released && subject.carry_maximum > 0
              ? Math.max(0, Math.min(100, subject.carry_mark! / subject.carry_maximum * 100))
              : 0;
            const x = 49 + index * 78;
            const height = percentage === 0 ? 4 : percentage / 100 * PLOT_HEIGHT;

            return <G key={subject.offering_id}>
              <Rect x={x} y={PLOT_BOTTOM - height} width={34} height={height} rx={7} fill={released ? colors.accent : colors.border} />
              <SvgText x={x + 17} y={Math.max(22, PLOT_BOTTOM - height - 8)} textAnchor="middle" fill={released ? colors.text : colors.muted} fontSize={11} fontWeight="700">
                {released ? `${percentage.toFixed(0)}%` : "—"}
              </SvgText>
              <SvgText x={x + 17} y={215} textAnchor="middle" fill={colors.textSecondary} fontSize={11} fontWeight="700">{subject.code}</SvgText>
            </G>;
          })}
        </Svg>
      </ScrollView>
    </View>

    <View style={styles.legend}>
      <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.accent }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>Released</Text></View>
      <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.border }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>Not released</Text></View>
      <Text style={[styles.zeroNote, { color: colors.muted }]}>0% is shown as a visible baseline</Text>
    </View>
  </Card>;
}

const styles = StyleSheet.create({
  card: { padding: 15, gap: 14 },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  chartIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, gap: 1 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "800" },
  subtitle: { fontSize: 12, lineHeight: 17, fontWeight: "500" },
  plot: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  scrollContent: { paddingRight: 3 },
  legend: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  zeroNote: { flexGrow: 1, fontSize: 10, lineHeight: 14, fontWeight: "500", textAlign: "right" },
});
