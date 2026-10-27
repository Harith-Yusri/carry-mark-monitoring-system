import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ButtonText, ErrorBanner, Field, Heading, LoadingView, PrimaryButton, Screen, typography } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";

export default function DisputeScreen() {
  const { offeringId } = useLocalSearchParams<{ offeringId: string }>();
  const { initializing, student, subjects, dispute, actionLoading, error, clearError } = useStudent();
  const { colors } = useTheme();
  const subject = subjects.find(item => item.offering_id === offeringId);
  const [assessment, setAssessment] = useState("");
  const [explanation, setExplanation] = useState("");
  if (initializing) return <LoadingView />;
  if (!student) return <Redirect href="/login" />;
  if (!subject) return <Screen style={styles.center}><Text style={[typography.body, { color: colors.muted }]}>Subject not found.</Text></Screen>;

  const submit = async () => {
    if (await dispute(subject, assessment, explanation)) {
      router.back();
    }
  };
  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={[typography.bodyStrong, { color: colors.primary }]}>‹ Cancel</Text></Pressable>
    <View><Heading>Report a mark issue</Heading><Text style={[typography.body, { color: colors.textSecondary }]}>{subject.code} · {subject.name}</Text></View>
    <Text style={[typography.body, { color: colors.muted }]}>Select the assessment and explain what appears incorrect. Your lecturer and administrator will receive the report.</Text>
    <View style={{ gap: 9 }}><Text style={[typography.bodyStrong, { color: colors.text }]}>Assessment</Text>
      <View style={styles.options}>{subject.assessments.map(item => <Pressable key={item.name} onPress={() => { setAssessment(item.name); clearError(); }} style={[styles.option, { borderColor: assessment === item.name ? colors.primary : colors.border, backgroundColor: assessment === item.name ? `${colors.primary}18` : colors.surface }]}><Text style={[typography.body, { color: colors.text }]}>{item.name}</Text></Pressable>)}</View>
    </View>
    <Field label="Explanation" value={explanation} onChangeText={value => { setExplanation(value); clearError(); }} multiline numberOfLines={6} textAlignVertical="top" placeholder="Describe the issue clearly" style={{ minHeight: 130, paddingTop: 14 }} />
    <ErrorBanner message={error} />
    <PrimaryButton onPress={() => void submit()} disabled={!assessment || !explanation.trim() || actionLoading}><ButtonText>{actionLoading ? "Submitting…" : "Submit Report"}</ButtonText></PrimaryButton>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 40, gap: 20 },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  options: { gap: 8 },
  option: { minHeight: 46, justifyContent: "center", borderRadius: 7, borderWidth: 1, paddingHorizontal: 13 },
});
