import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/ui";
import { darkPalette as colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

// Display-only startup branding. The existing auth state controls its lifetime;
// no timers, navigation effects, or additional startup requests belong here.
export function OpeningScreen() {
  return <Screen style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.brand}>
        <View style={styles.logoStage}>
          <View pointerEvents="none" style={styles.outerGlow} />
          <View pointerEvents="none" style={styles.innerGlow} />
          <Image
            source={require("../../assets/cmms-logo-mark.png")}
            resizeMode="contain"
            style={styles.logo}
            accessibilityLabel="CAMS logo"
          />
        </View>
        <Text style={styles.title}>CAMS</Text>
        <View style={styles.accent} />
        <Text style={styles.systemName}>Continuous Assessment{"\n"}Monitoring System</Text>
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Starting CAMS" />
          <Text style={styles.progressText}>Getting things ready</Text>
        </View>
      </View>
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28, paddingVertical: 36 },
  brand: { width: "100%", maxWidth: 360, alignItems: "center" },
  logoStage: { width: 160, height: 150, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  outerGlow: { position: "absolute", width: 240, height: 240, borderRadius: 120, backgroundColor: `${colors.primary}08` },
  innerGlow: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: `${colors.primary}0F` },
  logo: { width: 104, height: 104 },
  title: { color: colors.text, fontFamily: fonts.display, fontWeight: "700", fontSize: 46, lineHeight: 58, letterSpacing: 2 },
  accent: { width: 28, height: 2, borderRadius: 1, backgroundColor: colors.accent, marginTop: 15, marginBottom: 18 },
  systemName: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 17, lineHeight: 25, textAlign: "center" },
  progress: { marginTop: 42, alignItems: "center", gap: 12 },
  progressText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, letterSpacing: .3 },
});
