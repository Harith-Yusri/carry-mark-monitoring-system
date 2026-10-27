import Constants from "expo-constants";
import { useFocusEffect } from "expo-router";
import {
  BellRing, Building2, CalendarDays, GraduationCap, Hash,
  LogOut, Moon, Smartphone,
} from "lucide-react-native";
import { useCallback, type ReactNode } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Card, Heading, Screen, typography } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsScreen() {
  const { colors, mode, toggle } = useTheme();
  const { student, notifications_enabled, actionLoading, setNotificationAlertsEnabled, logout, refresh } = useStudent();

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const confirmLogout = () => Alert.alert("Sign out?", "You will need to sign in again to access your carry marks.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: () => void logout() },
  ]);

  const updateNotificationAlerts = async (enabled: boolean) => {
    const updated = await setNotificationAlertsEnabled(enabled);
    if (!updated) {
      Alert.alert("Push notifications", "Unable to update your notification preference. Please try again.");
    }
  };

  return <Screen>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>YOUR SPACE</Text>
        <Heading>Settings</Heading>
      </View>

      <Card style={styles.profileCard}>
        <View style={styles.identityRow}>
          <View style={[styles.avatarRing, { borderColor: `${colors.accent}55` }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.avatarText, { color: colors.accent }]}>{student?.name?.charAt(0).toUpperCase() ?? "S"}</Text>
            </View>
          </View>
          <View style={styles.identityCopy}>
            <Text style={[styles.name, { color: colors.text }]}>{student?.name ?? "Student"}</Text>
            <View style={styles.idRow}><Hash size={13} color={colors.muted} /><Text style={[styles.studentId, { color: colors.textSecondary }]}>{student?.matrix_number ?? "Not recorded"}</Text></View>
          </View>
        </View>

        <View style={[styles.programmeBlock, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.detailIcon, { backgroundColor: `${colors.accent}1F` }]}><GraduationCap size={20} color={colors.accent} /></View>
          <View style={styles.detailCopy}>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>PROGRAMME</Text>
            <Text style={[styles.programmeValue, { color: colors.text }]}>{student?.programme ?? "Not recorded"}</Text>
          </View>
        </View>

        <View style={styles.profileDetails}>
          <ProfileDetail icon={<Building2 size={18} color={colors.accent} />} label="Faculty" value={student?.faculty ?? "Not recorded"} />
          <ProfileDetail icon={<CalendarDays size={18} color={colors.accent} />} label="Semester" value={student?.semester ?? "Not recorded"} />
          <ProfileDetail icon={<Hash size={18} color={colors.accent} />} label="Semester Code" value={student?.semester_code ?? "Not recorded"} />
        </View>
      </Card>

      <SettingsSection title="Push Notifications" subtitle="Choose whether to receive continuous assessment alerts">
        <InfoRow
          icon={<BellRing size={20} color={notifications_enabled === false ? colors.muted : colors.success} />}
          title="Notification alerts"
          detail={notifications_enabled === false
            ? "Alerts are off. Your finalised marks remain available in the app."
            : "Receive an alert when a lecturer finalises your carry marks."}
          trailing={<Switch
            accessibilityLabel="Push notification alerts"
            value={notifications_enabled !== false}
            onValueChange={value => void updateNotificationAlerts(value)}
            disabled={actionLoading}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />}
        />
      </SettingsSection>

      <SettingsSection title="App" subtitle="Appearance and app information">
        <InfoRow
          icon={<Moon size={20} color={colors.accent} />}
          title="Dark appearance"
          detail="Use the darker student app theme"
          trailing={<Switch value={mode === "dark"} onValueChange={toggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />}
        />
        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
        <InfoRow
          icon={<Smartphone size={20} color={colors.accent} />}
          title="App information"
          detail={`UiTM CAMS · Version ${Constants.expoConfig?.version ?? "1.0.0"} · Android & iOS`}
        />
      </SettingsSection>

      <Pressable onPress={confirmLogout} style={({ pressed }) => [styles.logout, { backgroundColor: `${colors.danger}10`, borderColor: `${colors.danger}55`, opacity: pressed ? .78 : 1 }]}>
        <LogOut size={19} color={colors.danger} />
        <Text style={[typography.bodyStrong, { color: colors.danger }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  </Screen>;
}

function SettingsSection({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={styles.section}>
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{subtitle}</Text>
    </View>
    <Card style={styles.sectionCard}>{children}</Card>
  </View>;
}

function ProfileDetail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const { colors } = useTheme();
  return <View style={styles.profileDetail}>
    <View style={[styles.smallIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
    <View style={styles.detailCopy}>
      <Text style={[styles.detailLabel, { color: colors.muted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{value}</Text>
    </View>
  </View>;
}

function InfoRow({ icon, title, detail, trailing }: { icon: ReactNode; title: string; detail: string; trailing?: ReactNode }) {
  const { colors } = useTheme();
  return <View style={styles.infoRow}>
    <View style={[styles.infoIcon, { backgroundColor: colors.elevated }]}>{icon}</View>
    <View style={styles.infoCopy}>
      <Text style={[styles.infoTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.infoDetail, { color: colors.muted }]}>{detail}</Text>
    </View>
    {trailing}
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 22 },
  header: { gap: 2 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: "800", letterSpacing: 1.5 },
  profileCard: { gap: 16 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarRing: { width: 66, height: 66, borderRadius: 23, borderWidth: 1, padding: 4 },
  avatar: { flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 26, lineHeight: 32, fontWeight: "800" },
  identityCopy: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  idRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  studentId: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  programmeBlock: { minHeight: 66, borderRadius: 15, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 13, paddingVertical: 11 },
  detailIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  detailCopy: { flex: 1, minWidth: 0, gap: 2 },
  detailLabel: { fontSize: 9, lineHeight: 13, fontWeight: "800", letterSpacing: 1 },
  programmeValue: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
  profileDetails: { gap: 13 },
  profileDetail: { flexDirection: "row", alignItems: "center", gap: 11 },
  smallIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  detailValue: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  section: { gap: 10 },
  sectionHeading: { gap: 2, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: "800" },
  sectionSubtitle: { fontSize: 12, lineHeight: 17, fontWeight: "500" },
  sectionCard: { paddingVertical: 14, gap: 14 },
  infoRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 11 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  infoCopy: { flex: 1, minWidth: 0, gap: 2 },
  infoTitle: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  infoDetail: { fontSize: 11, lineHeight: 16, fontWeight: "500" },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 51 },
  logout: { minHeight: 52, borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
});
