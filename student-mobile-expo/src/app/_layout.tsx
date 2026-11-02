import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { OpeningScreen } from "@/components/OpeningScreen";
import { ButtonText, ErrorBanner, Heading, PrimaryButton, Screen, typography } from "@/components/ui";
import { StudentProvider, useStudent } from "@/context/StudentContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { startupError, startupLog } from "@/lib/startupLog";

startupLog("Root layout module evaluated");

export default function RootLayout() {
  useEffect(() => {
    startupLog("Root layout mounted; first React route can render");
  }, []);

  return <ThemeProvider><StudentProvider><PushCoordinator /><Navigation /></StudentProvider></ThemeProvider>;
}

function PushCoordinator() {
  const { student, notifications_enabled, refresh } = useStudent();
  const studentId = student?.matrix_number;

  useEffect(() => {
    void import("expo-notifications").then(notifications => {
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: notifications_enabled === true,
          shouldSetBadge: false,
          shouldShowBanner: Boolean(studentId) && notifications_enabled === true,
          shouldShowList: Boolean(studentId) && notifications_enabled === true,
        }),
      });
    }).catch(reason => startupError("Push foreground handler failed", reason));
    if (!studentId) return;
    let active = true;
    let tokenSubscription: { remove: () => void } | null = null;
    let responseSubscription: { remove: () => void } | null = null;
    void import("@/lib/pushNotifications").then(push => {
      if (!active) return;
      responseSubscription = push.listenForNotificationResponses(refresh);
      if (notifications_enabled !== false) tokenSubscription = push.listenForPushTokenChanges(reason => {
        startupError("Push-token refresh registration failed", reason);
      });
    }).catch(reason => startupError("Push response listeners failed to initialize", reason));
    return () => {
      active = false;
      tokenSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [studentId, notifications_enabled, refresh]);

  useEffect(() => {
    if (!studentId || notifications_enabled !== true) return;
    void import("@/lib/pushNotifications")
      .then(push => push.registerForStudentPushNotifications())
      .then(token => startupLog(token ? "Student push token registered" : "Student push permission unavailable"))
      .catch(reason => startupError("Student push registration failed", reason));
  }, [notifications_enabled, studentId]);

  return null;
}

function Navigation() {
  const { mode, colors } = useTheme();
  const { initializing, restoreFailed, student, onboarding, error, restoreSession, logout } = useStudent();
  // Keep the navigator mounted for OAuth/deep-link callbacks during restoration.
  // Push registration is independent and never controls this overlay.
  return <View style={{ flex: 1 }}>
    <StatusBar style={initializing || mode === "dark" ? "light" : "dark"} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="subject/[offeringId]" />
      <Stack.Screen name="dispute/[offeringId]" options={{ presentation: "modal" }} />
    </Stack>
    {initializing && <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} accessibilityViewIsModal>
      <OpeningScreen />
    </View>}
    {!initializing && restoreFailed && !student && !onboarding && <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} accessibilityViewIsModal>
      <Screen style={{ justifyContent: "center", padding: 24, gap: 18 }}>
        <Heading>Unable to open CAMS</Heading>
        <Text style={[typography.body, { color: colors.textSecondary }]}>Your saved sign-in has been kept. Check your connection and try again.</Text>
        <ErrorBanner message={error} />
        <PrimaryButton onPress={() => void restoreSession()}><ButtonText>Try again</ButtonText></PrimaryButton>
        <PrimaryButton onPress={() => void logout()}><ButtonText>Sign out</ButtonText></PrimaryButton>
      </Screen>
    </View>}
  </View>;
}
