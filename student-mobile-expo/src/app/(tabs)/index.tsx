import { router } from "expo-router";
import { Bell, BellRing, BookOpen, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ButtonText, Card, ErrorBanner, Field, Heading, PrimaryButton, Screen, typography } from "@/components/ui";
import { SubjectCard } from "@/components/SubjectCard";
import { useStudent } from "@/context/StudentContext";
import { useTheme } from "@/context/ThemeContext";
import { fonts } from "@/theme/fonts";

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { student, subjects, notifications, loading, actionLoading, error, refresh, joinClass, clearError } = useStudent();
  const [joinOpen, setJoinOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [code, setCode] = useState("");
  const submitJoin = async () => {
    if (await joinClass(code)) { setCode(""); setJoinOpen(false); }
  };

  return <Screen>
    <FlatList
      data={subjects}
      keyExtractor={item => item.offering_id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.accent} />}
      ListHeaderComponent={<View style={styles.listHeader}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>STUDENT PORTAL</Text>
            <Heading>My Subjects</Heading>
            <View style={[styles.semesterChip, { backgroundColor: colors.elevated, borderColor: colors.border }]}><Text numberOfLines={1} style={[styles.semesterText, { color: colors.textSecondary }]}>{student?.semester ?? "Current semester"}</Text></View>
          </View>
          <Pressable onPress={() => setNotificationsOpen(true)} style={({ pressed }) => [styles.bell, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? .75 : 1 }]} accessibilityLabel="Notifications">
            <Bell size={22} color={colors.text} />
            {notifications.length > 0 && <View style={[styles.dot, { backgroundColor: colors.warning }]}><Text style={styles.dotText}>{Math.min(notifications.length, 9)}</Text></View>}
          </Pressable>
        </View>
        <View style={styles.actionRow}>
          <PrimaryButton compact onPress={() => { clearError(); setJoinOpen(true); }}><Plus size={17} color={colors.white} /><ButtonText>Join Class</ButtonText></PrimaryButton>
          <Text style={[typography.body, styles.subjectCount, { color: colors.muted }]}>{subjects.length} current subject{subjects.length === 1 ? "" : "s"}</Text>
        </View>
        <ErrorBanner message={error} />
      </View>}
      renderItem={({ item }) => <SubjectCard subject={item} onPress={() => router.push({ pathname: "/subject/[offeringId]", params: { offeringId: item.offering_id } })} />}
      ListEmptyComponent={<Card style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}><BookOpen size={26} color={colors.accent} /></View><Text style={[styles.emptyTitle, { color: colors.text }]}>Your subjects will appear here</Text><Text style={[typography.body, { color: colors.muted, textAlign: "center" }]}>Use Join Class when your lecturer shares an invitation code for the current semester.</Text></Card>}
    />

    <Modal visible={joinOpen} transparent animationType="slide" onRequestClose={() => setJoinOpen(false)}>
      <Pressable style={styles.overlay} onPress={() => setJoinOpen(false)}><Pressable style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => undefined}>
        <View style={styles.modalHeader}><View style={{ flex: 1, gap: 4 }}><Heading size={24}>Join a class</Heading><Text style={[typography.body, { color: colors.textSecondary }]}>Enter the invitation code provided by your lecturer.</Text></View><Pressable onPress={() => setJoinOpen(false)} accessibilityLabel="Close join class"><X size={22} color={colors.muted} /></Pressable></View>
        <Field label="Class code" value={code} onChangeText={value => { setCode(value.toUpperCase()); clearError(); }} autoCapitalize="characters" placeholder="ABC123" />
        <ErrorBanner message={error} />
        <PrimaryButton onPress={() => void submitJoin()} disabled={!code.trim() || actionLoading}><Plus size={18} color={colors.white} /><ButtonText>{actionLoading ? "Joining…" : "Join Class"}</ButtonText></PrimaryButton>
      </Pressable></Pressable>
    </Modal>

    <Modal visible={notificationsOpen} transparent animationType="slide" onRequestClose={() => setNotificationsOpen(false)}>
      <Pressable style={styles.overlay} onPress={() => setNotificationsOpen(false)}><Pressable style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => undefined}>
        <View style={styles.modalHeader}><View><Heading size={24}>Notifications</Heading><Text style={[typography.body, { color: colors.muted }]}>Latest continuous assessment updates</Text></View><Pressable onPress={() => setNotificationsOpen(false)} accessibilityLabel="Close notifications"><X size={22} color={colors.muted} /></Pressable></View>
        {notifications.length ? notifications.slice(0, 5).map(item => <View key={item.id} style={[styles.notification, { backgroundColor: colors.elevated }]}><View style={[styles.notificationIcon, { backgroundColor: colors.primarySoft }]}><BellRing size={17} color={colors.accent} /></View><View style={{ flex: 1, gap: 3 }}><Text style={[typography.bodyStrong, { color: colors.text }]}>{item.title}</Text><Text style={[typography.body, { color: colors.muted }]}>{item.body}</Text></View></View>) : <View style={styles.emptyNotification}><Bell size={24} color={colors.muted} /><Text style={[typography.body, { color: colors.muted }]}>You’re all caught up.</Text></View>}
      </Pressable></Pressable>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34 },
  listHeader: { gap: 16, marginBottom: 16 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  eyebrow: { fontFamily: fonts.mono, fontWeight: "700", fontSize: 10, letterSpacing: 1.2 },
  semesterChip: { alignSelf: "flex-start", maxWidth: "100%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 2 },
  semesterText: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 12 },
  bell: { width: 46, height: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", right: -3, top: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  dotText: { color: "#17120A", fontSize: 10, fontWeight: "800" },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  subjectCount: { flex: 1, textAlign: "right", fontSize: 13 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 28 },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fonts.display, fontWeight: "700", fontSize: 18 },
  overlay: { flex: 1, backgroundColor: "#050711B8", justifyContent: "flex-end" },
  modal: { width: "100%", maxWidth: 560, alignSelf: "center", borderWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 30, gap: 18 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 },
  notification: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 13, borderRadius: 14 },
  notificationIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emptyNotification: { alignItems: "center", gap: 9, paddingVertical: 24 },
});
