import { ChevronRight, CheckCircle2, Clock3, LockKeyhole, UserRound, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, typography } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { SubjectResult } from "@/types/portal";
import { fonts } from "@/theme/fonts";

export function SubjectCard({ subject, onPress }: { subject: SubjectResult; onPress: () => void }) {
  const { colors } = useTheme();
  const released = subject.is_finalised && subject.carry_mark !== null;
  const statusColor = released ? colors.success : colors.warning;

  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${subject.code} assessment details`}>
    {({ pressed }) => <Card style={[styles.card, { opacity: pressed ? .86 : 1 }]}>
      <View style={styles.topRow}>
        <View style={[styles.codeBadge, { backgroundColor: colors.primarySoft, borderColor: `${colors.accent}55` }]}>
          <Text style={[styles.code, { color: colors.accent }]}>{subject.code}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: `${statusColor}16`, borderColor: `${statusColor}55` }]}>
          {released ? <CheckCircle2 size={13} color={statusColor} /> : <Clock3 size={13} color={statusColor} />}
          <Text style={[styles.statusText, { color: statusColor }]}>{released ? "RELEASED" : "PENDING"}</Text>
        </View>
      </View>

      <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>{subject.name}</Text>

      <View style={styles.metaStack}>
        <View style={styles.metaItem}><UsersRound size={15} color={colors.muted} /><Text numberOfLines={1} style={[typography.body, styles.metaText, { color: colors.textSecondary }]}>{subject.group}</Text></View>
        <View style={styles.metaItem}><UserRound size={15} color={colors.muted} /><Text numberOfLines={1} style={[typography.body, styles.metaText, { color: colors.textSecondary }]}>{subject.lecturer}</Text></View>
      </View>

      <View style={[styles.resultBand, { backgroundColor: released ? `${colors.success}10` : colors.elevated }]}>
        <View style={styles.resultCopy}>
          {released ? <CheckCircle2 size={17} color={colors.success} /> : <LockKeyhole size={17} color={colors.muted} />}
          <View>
            <Text style={[styles.resultLabel, { color: colors.muted }]}>CARRY MARK</Text>
            <Text style={[typography.bodyStrong, { color: released ? colors.success : colors.textSecondary }]}>{released ? "Finalised and released" : "Not released yet"}</Text>
          </View>
        </View>
        {released && <Text style={[styles.mark, { color: colors.success }]}>{subject.carry_mark!.toFixed(0)}<Text style={[styles.markMaximum, { color: colors.textSecondary }]}>/{subject.carry_maximum.toFixed(0)}</Text></Text>}
      </View>

      <View style={styles.actionRow}>
        <Text style={[typography.bodyStrong, { color: colors.accent }]}>View assessment details</Text>
        <ChevronRight size={18} color={colors.accent} />
      </View>
    </Card>}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { gap: 13, padding: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  codeBadge: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  code: { fontFamily: fonts.mono, fontWeight: "700", fontSize: 14, letterSpacing: .5 },
  name: { fontFamily: fonts.display, fontWeight: "700", fontSize: 20, lineHeight: 25, letterSpacing: -.25 },
  status: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontFamily: fonts.mono, fontWeight: "700", fontSize: 10, letterSpacing: .5 },
  metaStack: { gap: 7 },
  metaItem: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { flex: 1, fontSize: 14, lineHeight: 19 },
  resultBand: { minHeight: 58, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  resultCopy: { flexDirection: "row", alignItems: "center", gap: 10 },
  resultLabel: { fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: .8 },
  mark: { fontFamily: fonts.mono, fontWeight: "700", fontSize: 21 },
  markMaximum: { fontSize: 13, fontWeight: "500" },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 1 },
});
