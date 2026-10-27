import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ButtonText, ErrorBanner, Field, LoadingView, PrimaryButton, Screen, typography } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";
import { completeEmailVerification, resendSignupConfirmation } from "@/services/studentApi";
import { fonts } from "@/theme/fonts";

export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const { refresh } = useStudent();
  const linkingUrl = Linking.useLinkingURL();
  const handled = useRef(false);
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (handled.current) return;
    const handle = async () => {
      const url = linkingUrl ?? await Linking.getInitialURL();
      if (!url || !url.startsWith("cmms://auth/callback")) {
        setStatus("error");
        setMessage("The verification link is incomplete. Request a fresh email below.");
        return;
      }
      handled.current = true;
      try {
        await completeEmailVerification(url);
        await refresh();
        router.replace("/(tabs)");
      } catch (reason) {
        if (__DEV__) console.error("[Email verification callback]", reason);
        setStatus("error");
        setMessage(reason instanceof Error ? reason.message : "Unable to verify this email link.");
      }
    };
    void handle();
  }, [linkingUrl, refresh]);

  const resend = async () => {
    setSending(true);
    setResendMessage(null);
    setMessage(null);
    try {
      const result = await resendSignupConfirmation(email);
      setResendMessage(result.message);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to send a new verification email.");
    } finally {
      setSending(false);
    }
  };

  if (status === "loading") return <LoadingView />;

  return <Screen>
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Verification link unavailable</Text>
      <ErrorBanner message={message} />
      <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>Enter the same UiTM email used during registration to receive a fresh confirmation link.</Text>
      <View style={styles.form}>
        <Field label="UiTM Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="name@student.uitm.edu.my" />
        {resendMessage && <Text style={[typography.bodyStrong, styles.center, { color: colors.success }]}>{resendMessage}</Text>}
        <PrimaryButton disabled={sending || !email.trim()} onPress={() => void resend()}><ButtonText>{sending ? "Sending…" : "Send fresh verification email"}</ButtonText></PrimaryButton>
      </View>
      <Pressable onPress={() => router.replace("/login")} style={styles.linkButton}><Text style={[styles.linkText, { color: colors.primary }]}>Back to sign in</Text></Pressable>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingHorizontal: 28, maxWidth: 520, width: "100%", alignSelf: "center" },
  icon: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tick: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 31 },
  title: { fontFamily: fonts.display, fontWeight: "700", fontSize: 28, lineHeight: 35, textAlign: "center" },
  center: { textAlign: "center" },
  form: { width: "100%", gap: 14, marginTop: 4 },
  linkButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  linkText: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 15 },
});
