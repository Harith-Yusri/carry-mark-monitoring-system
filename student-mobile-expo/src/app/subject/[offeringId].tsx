import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { ButtonText, Card, ErrorBanner, Heading, LoadingView, PrimaryButton, Screen, typography } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";
import { consultationMessage, normalizeMalaysianPhone, openWhatsApp, WHATSAPP_OPEN_ERROR } from "@/lib/whatsapp";
import { loadAssignedLecturerWhatsApp } from "@/services/studentApi";
import { fonts } from "@/theme/fonts";

export default function SubjectDetailScreen() {
  const { offeringId } = useLocalSearchParams<{ offeringId: string }>();
  const { initializing, student, subjects } = useStudent();
  const { colors } = useTheme();
  const [consulting, setConsulting] = useState(false);
  const [consultError, setConsultError] = useState<string | null>(null);
  if (initializing) return <LoadingView />;
  if (!student) return <Redirect href="/login" />;
  const subject = subjects.find(item => item.offering_id === offeringId);
  if (!subject) return <Screen style={styles.center}><Text style={[typography.body, { color: colors.muted }]}>This subject is not available in the current semester.</Text><PrimaryButton onPress={() => router.back()}><ButtonText>Go back</ButtonText></PrimaryButton></Screen>;
  const isIneligible = subject.is_finalised && subject.eligible === false;

  const consultLecturer = async () => {
    setConsulting(true);
    setConsultError(null);
    try {
      const storedPhone = await loadAssignedLecturerWhatsApp(subject.offering_id);
      const phone = storedPhone ? normalizeMalaysianPhone(storedPhone) : null;
      if (!phone) throw new Error("A WhatsApp contact is not available for this lecturer. Please use Report Mark Issue instead.");
      const message = consultationMessage(student.name, student.matrix_number, subject.group, subject.code, subject.name);
      await openWhatsApp(phone, message);
    } catch (reason) {
      setConsultError(reason instanceof Error ? reason.message : WHATSAPP_OPEN_ERROR);
    } finally {
      setConsulting(false);
    }
  };

  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={[typography.bodyStrong, { color: colors.primary }]}>‹ Back to subjects</Text></Pressable>
    <View style={{ gap: 5 }}><Text style={[styles.code, { color: colors.primary }]}>{subject.code}</Text><Heading>{subject.name}</Heading><Text style={[typography.body, { color: colors.textSecondary }]}>{subject.group} · {subject.lecturer}</Text></View>
    <Card style={{ gap: 12 }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Assessments</Text>
      {subject.assessments.map((assessment, index) => <View key={`${assessment.name}-${index}`} style={[styles.assessment, index < subject.assessments.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={{ flex: 1, gap: 3 }}><Text style={[typography.bodyStrong, { color: colors.text }]}>{assessment.name}</Text><Text style={[typography.body, { color: colors.muted }]}>{assessment.assessment_type} · Weight {assessment.weight}%</Text></View>
        <View style={{ alignItems: "flex-end" }}><Text style={[typography.bodyStrong, { color: subject.is_finalised ? colors.text : colors.muted }]}>{subject.is_finalised && assessment.score !== null ? `${assessment.score} / ${assessment.maximum}` : "Not released yet"}</Text></View>
      </View>)}
      {!subject.assessments.length && <Text style={[typography.body, { color: colors.muted }]}>No assessments have been created yet.</Text>}
    </Card>
    <Card style={{ gap: 12 }}>
      <View style={styles.summary}><Text style={[styles.sectionTitle, { color: colors.text }]}>Carry total</Text><Text style={[styles.total, { color: isIneligible ? colors.danger : subject.is_finalised ? colors.success : colors.muted }]}>{subject.is_finalised && subject.carry_mark !== null ? `${subject.carry_mark.toFixed(0)} / ${subject.carry_maximum.toFixed(0)}` : "Not released yet"}</Text></View>
      <Text style={[typography.body, { color: colors.muted }]}>{subject.is_finalised ? `Eligibility threshold: ${subject.eligible_threshold}%` : "Your lecturer can sync draft marks without publishing them. Results appear only after finalisation."}</Text>
      {subject.is_finalised && <Text style={[typography.bodyStrong, { color: subject.eligible ? colors.success : colors.danger }]}>{subject.eligible ? "Eligible for examination" : "Not currently eligible for examination"}</Text>}
      {isIneligible && <View style={[styles.consult, { borderTopColor: colors.border }]}>
        <Text style={[typography.body, { color: colors.muted }]}>Contact the lecturer assigned to your class to discuss your continuous assessment status. WhatsApp will open with a message for you to review and send.</Text>
        <Pressable accessibilityRole="button" disabled={consulting} onPress={() => void consultLecturer()}
          style={({ pressed }) => [styles.consultButton, { opacity: consulting ? .5 : pressed ? .82 : 1 }]}>
          <MessageCircle size={19} color="#FFFFFF" />
          <ButtonText>{consulting ? "Opening WhatsApp…" : "Consult Lecturer"}</ButtonText>
        </Pressable>
        <ErrorBanner message={consultError} />
      </View>}
    </Card>
    <PrimaryButton onPress={() => router.push({ pathname: "/dispute/[offeringId]", params: { offeringId: subject.offering_id } })}><ButtonText>Report a mark issue</ButtonText></PrimaryButton>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 40, gap: 20 },
  center: { alignItems: "center", justifyContent: "center", padding: 24, gap: 18 },
  code: { fontFamily: fonts.mono, fontSize: 17 },
  sectionTitle: { fontFamily: fonts.display, fontWeight: "700", fontSize: 19 },
  assessment: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  total: { fontFamily: fonts.mono, fontSize: 18 },
  consult: { gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  consultButton: { minHeight: 50, borderRadius: 13, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#128C4A" },
});
