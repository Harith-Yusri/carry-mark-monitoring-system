import { router, Redirect } from "expo-router";
import { useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ErrorBanner, LoadingView, Screen } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { darkPalette } from "@/theme/colors";
import { configurationError } from "@/lib/supabase";
import { demoModeEnabled } from "@/services/studentApi";
import { fonts } from "@/theme/fonts";

export default function StudentLanding() {
  const colors = darkPalette;
  const { initializing, student, onboarding, loginWithGoogle, loginAsDemo, loading, error, clearError } = useStudent();
  const [demoRevealed, setDemoRevealed] = useState(false);
  const logoTaps = useRef<number[]>([]);

  if (initializing) return <LoadingView />;
  if (student) return <Redirect href="/(tabs)" />;
  if (onboarding) return <Redirect href="/onboarding" />;

  const submit = async () => {
    clearError();
    const destination = await loginWithGoogle();
    if (destination === "portal") router.replace("/(tabs)");
    if (destination === "onboarding") router.replace("/onboarding");
  };

  const activateDemo = () => {
    if (!demoModeEnabled || demoRevealed) return;
    const now = Date.now();
    logoTaps.current = [...logoTaps.current.filter(timestamp => now - timestamp <= 2500), now];
    if (logoTaps.current.length >= 5) {
      logoTaps.current = [];
      setDemoRevealed(true);
      clearError();
    }
  };

  const submitDemo = async () => {
    clearError();
    if (await loginAsDemo()) router.replace("/(tabs)");
  };

  return <Screen style={{ backgroundColor: colors.background }}>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Pressable disabled={!demoModeEnabled} onPress={activateDemo} style={styles.logoStage}>
          <View pointerEvents="none" style={[styles.glowOuter, { backgroundColor: `${colors.primary}0D` }]} />
          <View pointerEvents="none" style={[styles.glowInner, { backgroundColor: `${colors.accent}12` }]} />
          <Image source={require("../../assets/cmms-logo-mark.png")} resizeMode="contain" style={styles.logo} accessibilityLabel="Continuous Assessment Monitoring System" />
        </Pressable>
        <Text style={[styles.brandLine, { color: colors.accent }]}>YOUR ACADEMIC COMPANION</Text>
        <Text style={[styles.title, { color: colors.text }]}>CAMS</Text>
        <Text style={[styles.systemName, { color: colors.text }]}>Continuous Assessment{"\n"}Monitoring System</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Monitor your continuous assessment, marks and academic progress.</Text>
      </View>

      <View style={styles.actionArea}>
        <ErrorBanner message={configurationError ?? error} />
        <View style={[styles.googleButtonDepth, { shadowColor: colors.primary }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with UiTM Google Account"
            accessibilityState={{ disabled: loading || Boolean(configurationError), busy: loading }}
            disabled={loading || Boolean(configurationError)}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.googleButton,
              { backgroundColor: colors.primary },
              (loading || Boolean(configurationError)) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.googleMark}><Text style={styles.googleLetter}>G</Text></View>
            <Text style={[styles.googleLabel, { color: colors.white }]}>{loading ? "Connecting to Google…" : "Continue with UiTM Google"}</Text>
          </Pressable>
        </View>
        <Text style={[styles.accountHint, { color: colors.muted }]}>Use your official @student.uitm.edu.my Google account.</Text>
        {demoRevealed && <View style={[styles.demoArea, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.demoStatus, { color: colors.muted }]}>Demo mode enabled</Text>
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void submitDemo()}
            style={({ pressed }) => [styles.demoButton, { borderColor: colors.accent }, pressed && styles.pressed, loading && styles.disabled]}
          >
            <Text style={[styles.demoButtonText, { color: colors.accent }]}>{loading ? "Opening demo…" : "Continue as Demo Student"}</Text>
          </Pressable>
        </View>}
      </View>

      <View style={styles.footer}>
        <View style={[styles.footerRule, { backgroundColor: colors.border }]} />
        <Text style={[styles.footerText, { color: colors.muted }]}>UiTM Student Portal</Text>
      </View>
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 34, maxWidth: 460, width: "100%", alignSelf: "center" },
  hero: { alignItems: "center", marginBottom: 34 },
  logoStage: { width: 160, height: 142, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  glowOuter: { position: "absolute", width: 216, height: 216, borderRadius: 108 },
  glowInner: { position: "absolute", width: 156, height: 156, borderRadius: 78 },
  logo: { width: 102, height: 102 },
  brandLine: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 9, lineHeight: 14, letterSpacing: 2.1, marginBottom: 8, textAlign: "center" },
  title: { fontFamily: fonts.display, fontWeight: "700", fontSize: 48, lineHeight: 58, letterSpacing: -1.3, textAlign: "center" },
  systemName: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 18, lineHeight: 26, textAlign: "center", marginTop: 6 },
  subtitle: { maxWidth: 300, marginTop: 16, fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, textAlign: "center", opacity: .88 },
  actionArea: { gap: 13 },
  googleButtonDepth: { borderRadius: 14, shadowOpacity: .3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  googleButton: { minHeight: 54, borderRadius: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11 },
  googleMark: { width: 27, height: 27, borderRadius: 8, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  googleLetter: { color: "#4285F4", fontFamily: fonts.sansMedium, fontWeight: "800", fontSize: 16, lineHeight: 21 },
  googleLabel: { flexShrink: 1, fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 15, lineHeight: 21, textAlign: "center" },
  disabled: { opacity: .52 },
  pressed: { opacity: .88, transform: [{ translateY: 1 }] },
  accountHint: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 10 },
  demoArea: { marginTop: 4, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, alignItems: "center", gap: 7 },
  demoStatus: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16 },
  demoButton: { minHeight: 38, width: "100%", borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  demoButtonText: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 13, lineHeight: 18 },
  footer: { alignItems: "center", marginTop: 30, gap: 14 },
  footerRule: { width: 30, height: 1 },
  footerText: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, textAlign: "center" },
});
