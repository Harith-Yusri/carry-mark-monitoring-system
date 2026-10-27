 import { BarChart3, CheckCircle2, Clock3, LockKeyhole } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SubjectBarChart } from "@/components/charts";
import { Card, Heading, Screen, typography } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";

export default function ProgressScreen() {
  const { subjects, student } = useStudent();
  const { colors } = useTheme();
  const released = subjects.filter(subject => subject.is_finalised && subject.carry_mark !== null).length;
  const pending = subjects.length - released;

  return <Screen>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>STUDY SNAPSHOT</Text>
          <Heading>My Progress</Heading>
        </View>
        <View style={[styles.semesterChip, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
          <Text style={[typography.bodyStrong, { color: colors.accent }]} numberOfLines={1}>{student?.semester ?? "Current semester"}</Text>
        </View>
      </View>

      <View style={[styles.releaseSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SummaryItem icon={<CheckCircle2 size={18} color={colors.success} />} value={released} label="Released" />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <SummaryItem icon={<Clock3 size={18} color={colors.warning} />} value={pending} label="Pending" />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <SummaryItem icon={<BarChart3 size={18} color={colors.accent} />} value={subjects.length} label="Subjects" />
      </View>

      <SubjectBarChart subjects={subjects} />

      <View style={styles.sectionHeading}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Subject summary</Text>
          <Text style={[typography.body, { color: colors.muted }]}>Your carry-mark release status at a glance</Text>
        </View>
      </View>

      {subjects.length === 0 ? <Card>
        <Text style={[typography.body, { color: colors.muted }]}>No subject progress is available yet.</Text>
      </Card> : <Card style={styles.subjectList}>
        {subjects.map((subject, index) => {
          const isReleased = subject.is_finalised && subject.carry_mark !== null;
          const percentage = isReleased && subject.carry_maximum > 0
            ? Math.max(0, Math.min(100, subject.carry_mark! / subject.carry_maximum * 100))
            : null;

          return <View key={subject.offering_id} style={[
            styles.subjectRow,
            index < subjects.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
          ]}>
            <View style={[styles.subjectIcon, { backgroundColor: isReleased ? `${colors.success}18` : `${colors.warning}18` }]}>
              {isReleased
                ? <CheckCircle2 size={20} color={colors.success} />
                : <LockKeyhole size={19} color={colors.warning} />}
            </View>
            <View style={styles.subjectCopy}>
              <View style={styles.subjectHeadingRow}>
                <Text style={[styles.subjectCode, { color: colors.accent }]}>{subject.code}</Text>
                <View style={[styles.statusChip, { backgroundColor: isReleased ? `${colors.success}18` : `${colors.warning}18` }]}>
                  <Text style={[styles.statusText, { color: isReleased ? colors.success : colors.warning }]}>{isReleased ? "RELEASED" : "PENDING"}</Text>
                </View>
              </View>
              <Text style={[styles.subjectName, { color: colors.textSecondary }]} numberOfLines={2}>{subject.name}</Text>
            </View>
            <View style={styles.markColumn}>
              <Text style={[styles.markValue, { color: isReleased ? colors.text : colors.muted }]}>
                {percentage === null ? "—" : `${percentage.toFixed(0)}%`}
              </Text>
              <Text style={[styles.markCaption, { color: colors.muted }]}>
                {isReleased ? `${subject.carry_mark}/${subject.carry_maximum}` : "Not released"}
              </Text>
            </View>
          </View>;
        })}
      </Card>}
    </ScrollView>
  </Screen>;
}

function SummaryItem({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  const { colors } = useTheme();
  return <View style={styles.summaryItem}>
    {icon}
    <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
    <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 42, gap: 18 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: "800", letterSpacing: 1.5 },
  semesterChip: { maxWidth: "48%", minHeight: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  releaseSummary: { minHeight: 78, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  summaryItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  summaryValue: { fontSize: 18, lineHeight: 23, fontWeight: "800" },
  summaryLabel: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 42 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { fontSize: 19, lineHeight: 25, fontWeight: "800" },
  subjectList: { paddingVertical: 2, paddingHorizontal: 16, gap: 0 },
  subjectRow: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  subjectIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  subjectCopy: { flex: 1, minWidth: 0, gap: 4 },
  subjectHeadingRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  subjectCode: { fontSize: 15, lineHeight: 20, fontWeight: "800", letterSpacing: .3 },
  subjectName: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  statusChip: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: .7 },
  markColumn: { minWidth: 66, alignItems: "flex-end", gap: 1 },
  markValue: { fontSize: 18, lineHeight: 23, fontWeight: "800" },
  markCaption: { maxWidth: 80, fontSize: 10, lineHeight: 14, fontWeight: "600", textAlign: "right" },
});
