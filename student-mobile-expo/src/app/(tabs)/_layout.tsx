import { Redirect, Tabs } from "expo-router";
import { BarChart3, BookOpen, Settings, type LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { LoadingView } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";
import { fonts } from "@/theme/fonts";

const icons: Record<string, LucideIcon> = { index: BookOpen, progress: BarChart3, settings: Settings };

export default function TabsLayout() {
  const { initializing, student } = useStudent();
  const { colors } = useTheme();
  if (initializing) return <LoadingView />;
  if (!student) return <Redirect href="/login" />;
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      height: 76,
      paddingBottom: 9,
      paddingTop: 7,
    },
    tabBarItemStyle: { gap: 2 },
    tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontWeight: "700", fontSize: 11 },
    tabBarIcon: ({ color, focused }) => {
      const Icon = icons[route.name] ?? BookOpen;
      return <View style={[styles.iconShell, focused && { backgroundColor: colors.primarySoft }]}>
        <Icon color={color} size={21} strokeWidth={focused ? 2.6 : 2} />
      </View>;
    },
  })}>
    <Tabs.Screen name="index" options={{ title: "Subjects" }} />
    <Tabs.Screen name="progress" options={{ title: "Progress" }} />
    <Tabs.Screen name="settings" options={{ title: "Settings" }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  iconShell: { width: 42, height: 30, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
