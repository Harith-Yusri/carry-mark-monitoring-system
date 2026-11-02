import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ErrorBanner, LoadingView, Screen } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";
import { fonts } from "@/theme/fonts";
import { logOAuthError } from "@/lib/oauthDiagnostics";

export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const { completeOAuth, error } = useStudent();
  const linkingUrl = Linking.useLinkingURL();
  const handled = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (handled.current) return;
    const handle = async () => {
      const url = linkingUrl ?? await Linking.getInitialURL();
      if (!url || !url.includes("auth/callback")) {
        logOAuthError("Callback route", new Error("Callback route opened without an auth callback URL"));
        setFailed(true);
        return;
      }
      handled.current = true;
      console.info("[CAMS OAuth] callback route handling URL once");
      const destination = await completeOAuth(url);
      if (destination === "portal") router.replace("/(tabs)");
      else if (destination === "onboarding") router.replace("/onboarding");
      else setFailed(true);
    };
    void handle();
  }, [completeOAuth, linkingUrl]);

  if (!failed) return <LoadingView />;

  return <Screen>
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Google sign-in wasn’t completed</Text>
      <ErrorBanner message={error ?? "Return to the login screen and try again with your UiTM student Google account."} />
      <Pressable onPress={() => router.replace("/login")} style={styles.linkButton} accessibilityRole="button">
        <Text style={[styles.linkText, { color: colors.accent }]}>Back to sign in</Text>
      </Pressable>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 15, paddingHorizontal: 28, maxWidth: 520, width: "100%", alignSelf: "center" },
  title: { fontFamily: fonts.display, fontWeight: "700", fontSize: 27, lineHeight: 34, textAlign: "center" },
  linkButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  linkText: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 15 },
});
