import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StudentProvider } from "@/context/StudentContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { startupError, startupLog } from "@/lib/startupLog";

startupLog("Root layout module evaluated");

export default function RootLayout() {
  useEffect(() => {
    startupLog("Root layout mounted; first React route can render");
    let active = true;
    void import("expo-notifications").then(Notifications => {
      if (!active) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      startupLog("Notification handler configured");
    }).catch(reason => {
      startupError("Notification initialization failed; continuing without foreground alerts", reason);
    });
    return () => { active = false; };
  }, []);

  return <ThemeProvider><StudentProvider><Navigation /></StudentProvider></ThemeProvider>;
}

function Navigation() {
  const { mode, colors } = useTheme();
  return <>
    <StatusBar style={mode === "dark" ? "light" : "dark"} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="subject/[offeringId]" />
      <Stack.Screen name="dispute/[offeringId]" options={{ presentation: "modal" }} />
    </Stack>
  </>;
}
