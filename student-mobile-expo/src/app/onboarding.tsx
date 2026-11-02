import { router, Redirect } from "expo-router";
import { Check, ChevronDown, LogOut, Mail, UserRound } from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ButtonText, Card, ErrorBanner, Heading, PrimaryButton, Screen, typography } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";
import { loadRegistrationProgrammes, RegistrationProgramme } from "@/services/studentApi";
import { fonts } from "@/theme/fonts";

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { student, onboarding, actionLoading, error, clearError, completeProfile, logout } = useStudent();
  const [programmes, setProgrammes] = useState<RegistrationProgramme[]>([]);
  const [programmeId, setProgrammeId] = useState("");
  const [semester, setSemester] = useState<number | null>(onboarding?.current_semester ?? null);
  const [showProgrammes, setShowProgrammes] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadRegistrationProgrammes()
      .then(items => {
        if (!active) return;
        setProgrammes(items);
        if (onboarding?.programme_id && items.some(item => item.id === onboarding.programme_id)) {
          setProgrammeId(onboarding.programme_id);
        }
      })
      .catch(reason => {
        if (__DEV__) console.error("[Student onboarding programmes]", reason);
        if (active) setLoadError("Unable to load programmes. Please try again.");
      });
    return () => { active = false; };
  }, [onboarding?.programme_id]);

  if (student) return <Redirect href="/(tabs)" />;
  if (!onboarding) return <Redirect href="/login" />;

  const selectedProgramme = programmes.find(item => item.id === programmeId);
  const submit = async () => {
    clearError();
    if (!programmeId || semester === null) return;
    if (await completeProfile(programmeId, semester)) router.replace("/(tabs)");
  };

  return <Screen>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.stepBadge, { backgroundColor: colors.primarySoft }]}><Check size={17} color={colors.accent} /></View>
        <Heading>Complete Your Profile</Heading>
        <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>Google provided your verified identity. Add the academic details CAMS needs to personalise your student portal.</Text>
      </View>

      <Card style={styles.identityCard}>
        <IdentityRow icon={<UserRound size={18} color={colors.accent} />} label="Full Name" value={onboarding.full_name} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <IdentityRow icon={<Mail size={18} color={colors.accent} />} label="UiTM Email" value={onboarding.email} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <IdentityRow icon={<Text style={[styles.hash, { color: colors.accent }]}>#</Text>} label="Student ID" value={onboarding.student_id} />
        <Text style={[styles.readOnlyNote, { color: colors.muted }]}>Verified from your UiTM Google account and cannot be edited.</Text>
      </Card>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.muted }]}>PROGRAMME</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showProgrammes }}
            onPress={() => setShowProgrammes(value => !value)}
            style={[styles.selector, { backgroundColor: colors.surface, borderColor: showProgrammes ? colors.accent : colors.border }]}
          >
            <Text numberOfLines={2} style={[styles.selectorText, { color: selectedProgramme ? colors.text : colors.muted }]}>{selectedProgramme ? `${selectedProgramme.code} — ${selectedProgramme.name}` : "Select your programme"}</Text>
            <ChevronDown size={18} color={colors.muted} style={{ transform: [{ rotate: showProgrammes ? "180deg" : "0deg" }] }} />
          </Pressable>
          {showProgrammes && <View style={[styles.options, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {programmes.map(item => <Pressable
              key={item.id}
              onPress={() => { setProgrammeId(item.id); setShowProgrammes(false); clearError(); }}
              style={[styles.option, item.id === programmeId && { backgroundColor: colors.primarySoft }]}
            >
              <Text style={[styles.optionCode, { color: colors.accent }]}>{item.code}</Text>
              <Text style={[styles.optionName, { color: colors.textSecondary }]}>{item.name}</Text>
              {item.id === programmeId && <Check size={17} color={colors.accent} />}
            </Pressable>)}
          </View>}
          <Text style={[styles.helper, { color: colors.muted }]}>Your faculty is assigned automatically from your programme.</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.muted }]}>CURRENT SEMESTER</Text>
          <View style={styles.semesterGrid}>{Array.from({ length: 12 }, (_, index) => index + 1).map(value => <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: semester === value }}
            onPress={() => { setSemester(value); clearError(); }}
            style={[styles.semesterOption, {
              backgroundColor: semester === value ? colors.primary : colors.surface,
              borderColor: semester === value ? colors.primary : colors.border,
            }]}
          ><Text style={[styles.semesterText, { color: semester === value ? colors.white : colors.textSecondary }]}>{value}</Text></Pressable>)}</View>
        </View>

        <ErrorBanner message={loadError ?? error} />
        <PrimaryButton onPress={() => void submit()} disabled={actionLoading || !programmeId || semester === null || Boolean(loadError)}>
          <ButtonText>{actionLoading ? "Saving profile…" : "Continue to CAMS"}</ButtonText>
        </PrimaryButton>
        <Pressable onPress={() => void logout()} style={styles.changeAccount} accessibilityRole="button">
          <LogOut size={16} color={colors.muted} />
          <Text style={[styles.changeAccountText, { color: colors.muted }]}>Use a different Google account</Text>
        </Pressable>
      </View>
    </ScrollView>
  </Screen>;
}

function IdentityRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const { colors } = useTheme();
  return <View style={styles.identityRow}>
    <View style={[styles.identityIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
    <View style={styles.identityCopy}>
      <Text style={[styles.identityLabel, { color: colors.muted }]}>{label.toUpperCase()}</Text>
      <Text selectable style={[styles.identityValue, { color: colors.text }]}>{value}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 22, maxWidth: 560, width: "100%", alignSelf: "center" },
  header: { alignItems: "flex-start", gap: 7 },
  stepBadge: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  subtitle: { maxWidth: 500 },
  identityCard: { gap: 12 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  identityIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  identityCopy: { flex: 1, minWidth: 0, gap: 2 },
  identityLabel: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 9, lineHeight: 13, letterSpacing: 1 },
  identityValue: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 49 },
  hash: { fontFamily: fonts.mono, fontWeight: "700", fontSize: 18 },
  readOnlyNote: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, marginTop: 1 },
  form: { gap: 20 },
  fieldGroup: { gap: 7 },
  label: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 11, lineHeight: 16, letterSpacing: .8 },
  selector: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 10 },
  selectorText: { flex: 1, fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 14, lineHeight: 20 },
  options: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  option: { minHeight: 56, paddingHorizontal: 13, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 9 },
  optionCode: { width: 48, fontFamily: fonts.mono, fontWeight: "700", fontSize: 13 },
  optionName: { flex: 1, fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  helper: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16 },
  semesterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  semesterOption: { width: 44, height: 42, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  semesterText: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 14 },
  changeAccount: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  changeAccountText: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 13 },
});
