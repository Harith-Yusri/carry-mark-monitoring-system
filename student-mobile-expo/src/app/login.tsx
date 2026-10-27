import { router, Redirect } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from "react-native";
import { ErrorBanner, Field, Screen } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";
import { configurationError } from "@/lib/supabase";
import { fonts } from "@/theme/fonts";

export default function LoginScreen() {
  const { colors } = useTheme();
  const { student, login, loading, error, clearError } = useStudent();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<"studentId" | "password" | null>(null);
  if (student) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    clearError();
    if (!studentId.trim() || !password) {
      setLocalError("Enter your Student ID and password.");
      return;
    }
    setLocalError(null);
    if (await login(studentId, password, keepSignedIn)) router.replace("/(tabs)");
  };

  return <Screen>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logoStage}>
            <View pointerEvents="none" style={[styles.glowOuter, { backgroundColor: `${colors.primary}0D` }]} />
            <View pointerEvents="none" style={[styles.glowInner, { backgroundColor: `${colors.accent}12` }]} />
            <Image source={require("../../assets/cmms-logo-mark.png")} resizeMode="contain" style={styles.logo} accessibilityLabel="Continuous Assessment Monitoring System" />
          </View>
          <Text style={[styles.brandLine, { color: colors.accent }]}>CAMS</Text>
          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.text }]}>Student Portal</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in with your UiTM student account</Text>
          </View>
        </View>
        <View style={styles.form}>
          <Field
            label="Student ID"
            value={studentId}
            onChangeText={value => { setStudentId(value); clearError(); }}
            onFocus={() => setFocusedField("studentId")}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="20221123003"
            style={[styles.input, {
              backgroundColor: colors.surface,
              borderColor: focusedField === "studentId" ? colors.accent : colors.border,
            }]}
            returnKeyType="next"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={value => { setPassword(value); clearError(); }}
            secureTextEntry={!showPassword}
            textContentType="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            style={[styles.input, {
              backgroundColor: colors.surface,
              borderColor: focusedField === "password" ? colors.accent : colors.border,
            }]}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            rightAccessory={<Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              onPress={() => setShowPassword(value => !value)}
              hitSlop={10}
              style={styles.passwordToggle}
            >{showPassword
                ? <EyeOff color={colors.textSecondary} size={20} strokeWidth={2} />
                : <Eye color={colors.textSecondary} size={20} strokeWidth={2} />}
            </Pressable>}
          />
          <View style={styles.optionsRow}>
            <Pressable onPress={() => setKeepSignedIn(value => !value)} style={styles.switchRow} accessibilityRole="checkbox" accessibilityState={{ checked: keepSignedIn }}>
              <Switch
                value={keepSignedIn}
                onValueChange={setKeepSignedIn}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
                style={styles.switch}
              />
              <Text style={[styles.optionText, { color: colors.textSecondary }]}>Keep me signed in</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => Alert.alert("Forgot password?", "Contact your faculty administrator to reset your password.")}
            >
              <Text style={[styles.forgotLink, { color: colors.accent }]}>Forgot password?</Text>
            </Pressable>
          </View>
          <ErrorBanner message={configurationError ?? localError ?? error} />
          <View style={[styles.signInDepth, { shadowColor: colors.primary }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: loading || Boolean(configurationError), busy: loading }}
              disabled={loading || Boolean(configurationError)}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.signInButton,
                { backgroundColor: colors.primary },
                (loading || Boolean(configurationError)) && styles.signInDisabled,
                pressed && styles.signInPressed,
              ]}
            >
              <View pointerEvents="none" style={styles.signInHighlight} />
              <Text style={[styles.signInText, { color: colors.white }]}>{loading ? "Signing in…" : "Sign in"}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => router.push("/register")} style={styles.createAction} accessibilityRole="button">
            <Text style={[styles.createPrompt, { color: colors.muted }]}>New to CAMS?</Text>
            <Text style={[styles.createButtonText, { color: colors.accent }]}>Create Account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 30, maxWidth: 460, width: "100%", alignSelf: "center" },
  hero: { alignItems: "center", marginBottom: 29 },
  logoStage: { width: 132, height: 108, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  glowOuter: { position: "absolute", width: 132, height: 132, borderRadius: 66 },
  glowInner: { position: "absolute", width: 102, height: 102, borderRadius: 51 },
  logo: { width: 86, height: 86 },
  brandLine: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 10, lineHeight: 14, letterSpacing: 2.4, marginBottom: 5 },
  intro: { alignItems: "center", gap: 4 },
  title: { fontFamily: fonts.display, fontWeight: "700", fontSize: 32, lineHeight: 39, letterSpacing: -.6, textAlign: "center" },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, textAlign: "center", opacity: .88 },
  form: { gap: 14 },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1.2, fontSize: 15 },
  optionsRow: { minHeight: 34, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 14, rowGap: 7 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: -5 },
  switch: { transform: [{ scaleX: .76 }, { scaleY: .76 }] },
  optionText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  forgotLink: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 13, lineHeight: 18 },
  passwordToggle: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  signInDepth: { marginTop: 2, borderRadius: 14, shadowOpacity: .3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  signInButton: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  signInHighlight: { position: "absolute", top: 0, left: 16, right: 16, height: 1, backgroundColor: "rgba(255,255,255,.28)" },
  signInText: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 16, lineHeight: 22, letterSpacing: .15 },
  signInDisabled: { opacity: .52 },
  signInPressed: { opacity: .88, transform: [{ translateY: 1 }] },
  createAction: { minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  createPrompt: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  createButtonText: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 14, lineHeight: 20 },
});
