import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ButtonText, Card, ErrorBanner, Field, Heading, LoadingView, PrimaryButton, Screen, typography } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassStyle } from "@/theme/glass";
import { loadMyMarkIssues, markIssueError, markIssueStatus, type MarkIssueWorkspace } from "@/services/markIssues";

export default function DisputeScreen() {
  const { offeringId } = useLocalSearchParams<{ offeringId: string }>();
  return <MarkIssueForm key={offeringId} offeringId={offeringId} />;
}

function MarkIssueForm({ offeringId }: { offeringId: string }) {
  const { initializing, student, subjects, dispute, actionLoading, error, clearError } = useStudent();
  const { colors } = useTheme();
  const subject = subjects.find(item => item.offering_id === offeringId);
  const [selection, setSelection] = useState("");
  const [explanation, setExplanation] = useState("");
  const [workspace, setWorkspace] = useState<MarkIssueWorkspace | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loadingIssues, setLoadingIssues] = useState(true);
  const inFlight = useRef(false);
  useEffect(() => {
    let current = true;
    loadMyMarkIssues(offeringId).then(data => { if (current) { setWorkspace(data); setLocalError(null); } })
      .catch(reason => { if (current) setLocalError(markIssueError(reason)); })
      .finally(() => { if (current) setLoadingIssues(false); });
    return () => { current = false; };
  }, [offeringId]);
  if (initializing) return <LoadingView />;
  if (!student) return <Redirect href="/login" />;
  if (!subject) return <Screen style={styles.center}><Text style={[typography.body, { color: colors.muted }]}>Subject not found.</Text></Screen>;
  const selected = workspace?.options.find(option => `${option.enrolment_id}:${option.assessment_id}` === selection);
  const refreshIssues = async () => {
    if (inFlight.current) return;
    setLoadingIssues(true);
    try { setWorkspace(await loadMyMarkIssues(offeringId)); setLocalError(null); }
    catch (reason) { setLocalError(markIssueError(reason)); }
    finally { setLoadingIssues(false); }
  };
  const submit = async () => {
    if (inFlight.current || !selected || !workspace || !explanation.trim()) return;
    inFlight.current = true; setLocalError(null); setNotice("");
    try {
      if (await dispute(selected.enrolment_id, selected.assessment_id, explanation, workspace.request_key)) {
        setNotice("Your report has been submitted to the assigned lecturer."); setExplanation(""); setSelection("");
        try { setWorkspace(await loadMyMarkIssues(offeringId)); }
        catch { setLocalError("Report submitted, but its latest status could not be loaded. Select Refresh reports."); setWorkspace(null); }
      }
    } finally { inFlight.current = false; }
  };
  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.back()}><Text style={[typography.bodyStrong, { color: colors.accent }]}>‹ Back to subject</Text></Pressable>
    <View><Heading>Report a mark issue</Heading><Text style={[typography.body, { color: colors.textSecondary }]}>{subject.code} · {subject.name}</Text></View>
    <Text style={[typography.body, { color: colors.muted }]}>Select the assessment and explain the issue. Your assigned lecturer will review it. A Released mark can only be corrected after Admin approval.</Text>
    {loadingIssues && <Text accessibilityRole="progressbar" style={[typography.body, { color: colors.muted }]}>Loading reports…</Text>}
    {notice !== "" && <Text accessibilityRole="alert" style={[typography.bodyStrong, { color: colors.success }]}>{notice}</Text>}
    <View style={styles.options}><Text style={[typography.bodyStrong, { color: colors.text }]}>Assessment</Text>
      {workspace?.options.map(option => {
        const key = `${option.enrolment_id}:${option.assessment_id}`;
        return <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: key === selection }} disabled={actionLoading} onPress={() => { setSelection(key); clearError(); }} style={[getGlassStyle(colors, "secondary", key === selection ? "brand" : "neutral"), styles.option]}><Text style={[typography.body, { color: colors.text }]}>{option.name} · {option.class_label}</Text></Pressable>;
      })}
      {workspace && !workspace.options.length && <Text style={[typography.body, { color: colors.muted }]}>No current assessment is available to report.</Text>}
    </View>
    <Field label="Explanation" value={explanation} onChangeText={value => { setExplanation(value); clearError(); }} maxLength={2000} editable={!actionLoading} multiline numberOfLines={6} textAlignVertical="top" placeholder="Describe the issue clearly" style={styles.explanation} />
    <ErrorBanner message={localError ?? error} />
    <PrimaryButton onPress={() => void submit()} disabled={!selected || !explanation.trim() || actionLoading || loadingIssues}><ButtonText>{actionLoading ? "Submitting…" : "Submit Report"}</ButtonText></PrimaryButton>
    <View style={styles.historyHeader}><Heading size={22}>My reports</Heading><Pressable accessibilityRole="button" disabled={loadingIssues || actionLoading} style={styles.refresh} onPress={() => void refreshIssues()}><Text style={[typography.bodyStrong, { color: colors.accent }]}>Refresh reports</Text></Pressable></View>
    {workspace?.issues.map(issue => {
      const label = markIssueStatus(issue);
      const tone = label.includes("Rejected") ? "danger" : label === "Resolved" || label === "Correction Approved" ? "success" : "warning";
      return <Card key={issue.id} style={styles.issueCard}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{issue.assessment_name}{issue.class_label ? ` · ${issue.class_label}` : ""}</Text>
        <View style={[getGlassStyle(colors, "secondary", tone), styles.status]}><Text style={[typography.bodyStrong, { color: colors[tone] }]}>{label}</Text></View>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{issue.explanation}</Text>
        <Text style={[typography.body, { color: colors.muted }]}>{new Date(issue.created_at).toLocaleString()}</Text>
        {issue.response && <Text style={[typography.body, { color: colors.textSecondary }]}>Lecturer response: {issue.response}</Text>}
      </Card>;
    })}
    {workspace && !workspace.issues.length && <Text style={[typography.body, { color: colors.muted }]}>No reports for this subject yet.</Text>}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 40, gap: 20 },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  back: { minHeight: 44, justifyContent: "center" },
  options: { gap: 8 },
  option: { minHeight: 46, justifyContent: "center", paddingHorizontal: 13, paddingVertical: 10 },
  explanation: { minHeight: 130, paddingTop: 14 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  refresh: { minHeight: 44, justifyContent: "center" },
  issueCard: { gap: 10 },
  status: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 7 },
});
