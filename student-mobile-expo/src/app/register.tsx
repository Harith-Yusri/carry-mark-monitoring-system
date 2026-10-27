import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { ButtonText, ErrorBanner, Field, PrimaryButton, Screen, typography } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { configurationError } from "@/lib/supabase";
import {
  isStudentEmail, loadRegistrationProgrammes, registerAccount, resendSignupConfirmation, RegistrationProgramme,
} from "@/services/studentApi";
import { fonts } from "@/theme/fonts";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [currentSemester, setCurrentSemester] = useState("1");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showProgrammes, setShowProgrammes] = useState(false);
  const [programmes, setProgrammes] = useState<RegistrationProgramme[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const studentEmail = isStudentEmail(email);

  useEffect(() => {
    let current = true;
    void loadRegistrationProgrammes()
      .then(items => {
        if (!current) return;
        setProgrammes(items);
        if (items.length) setProgrammeId(items[0].id);
      })
      .catch(reason => {
        if (current) setError(__DEV__ && reason instanceof Error ? reason.message : "Unable to load programmes. Please try again.");
      });
    return () => { current = false; };
  }, []);

  const selectedProgramme = programmes.find(item => item.id === programmeId);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await registerAccount({
        fullName, identifier, email, password, confirmPassword,
        programmeId,
        currentSemester: Number(currentSemester),
      });
      setComplete(true);
    } catch (reason) {
      if (__DEV__) console.error("[Account registration]", reason);
      setError(reason instanceof Error ? reason.message : "Unable to create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (complete) return <Screen>
    <View style={styles.successWrap}>
      <View style={[styles.successIcon, { backgroundColor: `${colors.success}22`, borderColor: colors.success }]}><Text style={[styles.successTick, { color: colors.success }]}>✓</Text></View>
      <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
      <Text style={[typography.body, styles.centerText, { color: colors.textSecondary }]}>We sent a verification link to {email.trim()}. Confirm your email before signing in.</Text>
      {resendMessage && <Text style={[typography.bodyStrong, styles.centerText, { color: colors.success }]}>{resendMessage}</Text>}
      <View style={{ width: "100%", marginTop: 10 }}><PrimaryButton onPress={() => router.replace("/login")}><ButtonText>Return to sign in</ButtonText></PrimaryButton></View>
      <Pressable disabled={resending} onPress={() => {
        setResending(true);
        setError(null);
        setResendMessage(null);
        void resendSignupConfirmation(email)
          .then(() => setResendMessage("A fresh verification email was requested. Check your inbox and spam folder."))
          .catch(reason => setError(reason instanceof Error ? reason.message : "Unable to resend the email."))
          .finally(() => setResending(false));
      }} accessibilityRole="button" style={styles.resendButton}><Text style={[styles.resendText, { color: colors.primary }]}>{resending ? "Sending…" : "Resend verification email"}</Text></Pressable>
      <ErrorBanner message={error} />
    </View>
  </Screen>;

  return <Screen>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}><Text style={[styles.back, { color: colors.primary }]}>‹ Back to sign in</Text></Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginBottom: 22 }]}>Create your UiTM CAMS student account using your official student email, then verify it before your first sign-in.</Text>

        <View style={styles.fields}>
          <Field label="UiTM Student Email" value={email} onChangeText={value => { setEmail(value); setError(null); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="name@student.uitm.edu.my" />
          <View style={[styles.roleStatus, { backgroundColor: studentEmail ? colors.primarySoft : colors.elevated, borderColor: studentEmail ? colors.primary : colors.border }]}>
            <Text style={[typography.bodyStrong, { color: studentEmail ? colors.accent : colors.muted }]}>{studentEmail ? "UiTM student email detected" : "Please use your UiTM student email."}</Text>
          </View>
          <Field label="Full Name" value={fullName} onChangeText={setFullName} autoComplete="name" placeholder="Your full name" />
          <Field label="Student ID" value={identifier} onChangeText={setIdentifier} autoCapitalize="characters" autoCorrect={false} placeholder="20221123003" />

          <>
            <View style={{ gap: 7 }}>
              <Text style={[styles.label, { color: colors.muted }]}>PROGRAMME</Text>
              <Pressable onPress={() => setShowProgrammes(value => !value)} style={[styles.selector, { backgroundColor: colors.elevated, borderColor: colors.border }]} accessibilityRole="button" accessibilityState={{ expanded: showProgrammes }}>
                <Text numberOfLines={2} style={[styles.selectorText, { color: selectedProgramme ? colors.text : colors.muted }]}>{selectedProgramme ? `${selectedProgramme.code} — ${selectedProgramme.name}` : "Select programme"}</Text>
                <Text style={{ color: colors.muted }}>{showProgrammes ? "▲" : "▼"}</Text>
              </Pressable>
              {showProgrammes && <View style={[styles.options, { backgroundColor: colors.surface, borderColor: colors.border }]}>{programmes.map(item => <Pressable key={item.id} onPress={() => { setProgrammeId(item.id); setShowProgrammes(false); }} style={[styles.option, item.id === programmeId && { backgroundColor: colors.primarySoft }]}><Text style={[typography.body, { color: colors.text }]}><Text style={{ fontFamily: fonts.sansMedium, fontWeight: "600" }}>{item.code}</Text> — {item.name}</Text></Pressable>)}</View>}
            </View>
            <Field label="Current Semester" value={currentSemester} onChangeText={setCurrentSemester} keyboardType="number-pad" placeholder="1" />
          </>

          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} textContentType="newPassword" autoComplete="new-password" placeholder="At least 8 characters" rightAccessory={<PasswordToggle visible={showPassword} onPress={() => setShowPassword(value => !value)} color={colors.primary} />} />
          <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} textContentType="newPassword" autoComplete="new-password" placeholder="Repeat your password" rightAccessory={<PasswordToggle visible={showConfirmPassword} onPress={() => setShowConfirmPassword(value => !value)} color={colors.primary} />} />
          <ErrorBanner message={configurationError ?? error} />
          <PrimaryButton onPress={() => void submit()} disabled={busy || Boolean(configurationError)}><ButtonText>{busy ? "Creating account…" : "Create account"}</ButtonText></PrimaryButton>
          {resendMessage && <Text style={[typography.bodyStrong, styles.centerText, { color: colors.success }]}>{resendMessage}</Text>}
          <Pressable disabled={resending} onPress={() => {
            setResending(true);
            setResendMessage(null);
            setError(null);
            void resendSignupConfirmation(email)
              .then(result => setResendMessage(result.message))
              .catch(reason => setError(reason instanceof Error ? reason.message : "Unable to resend the email."))
              .finally(() => setResending(false));
          }} accessibilityRole="button" style={styles.resendButton}><Text style={[styles.resendText, { color: colors.primary }]}>{resending ? "Sending…" : "Already registered? Resend verification email"}</Text></Pressable>
        </View>
        <Text style={[styles.adminNote, { color: colors.muted }]}>Administrator accounts cannot be registered publicly.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}

function PasswordToggle({ visible, onPress, color }: { visible: boolean; onPress: () => void; color: string }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} hitSlop={8} style={styles.passwordToggle}><Text style={[styles.passwordToggleText, { color }]}>{visible ? "Hide" : "Show"}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, maxWidth: 560, width: "100%", alignSelf: "center" },
  back: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 15, marginBottom: 22 },
  title: { fontFamily: fonts.display, fontWeight: "700", fontSize: 30, lineHeight: 37, marginBottom: 5 },
  fields: { gap: 17 },
  roleStatus: { minHeight: 48, borderWidth: 1, borderRadius: 13, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 8 },
  label: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 12, lineHeight: 17, letterSpacing: .7 },
  selector: { minHeight: 52, borderWidth: 1, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  selectorText: { flex: 1, fontFamily: fonts.sans, fontSize: 15, lineHeight: 20 },
  options: { borderWidth: 1, borderRadius: 13, overflow: "hidden" },
  option: { minHeight: 48, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 8 },
  passwordToggle: { minWidth: 54, minHeight: 42, alignItems: "center", justifyContent: "center" },
  passwordToggleText: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 14 },
  adminNote: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 22 },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, maxWidth: 500, width: "100%", alignSelf: "center", gap: 12 },
  successIcon: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 5 },
  successTick: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 30 },
  centerText: { textAlign: "center" },
  resendButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  resendText: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 15 },
});
