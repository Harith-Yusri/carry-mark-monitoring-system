import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { Card, Heading, typography } from "@/components/ui";
import { languages, localization, setLanguage, t, useLocale } from "./react";
export function LanguageSetting() {
  useLocale();
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  const current = languages.find(item => item.value === localization.locale())!.label;
  return <View style={{ gap: 8 }}>
    <Heading size={18}>{t("Language")}</Heading>
    <Pressable accessibilityRole="button" accessibilityLabel={t("Language")} onPress={() => setShow(true)} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 }}>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>{localization.preference() === "auto" ? t("Auto ({{language}})", { language: current }) : current} ▾</Text>
    </Pressable>
    {localization.persistenceError() && <Text accessibilityRole="alert" style={[typography.body, { color: colors.danger }]}>{t("Language changed for this session, but the preference could not be saved.")}</Text>}
    <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#0008", padding: 24 }}>
        <Card><ScrollView contentContainerStyle={{ gap: 10 }}>
          <Heading size={22}>{t("Language")}</Heading>
          {languages.map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ selected: localization.preference() === item.value }} onPress={() => { void setLanguage(item.value); setShow(false); }} style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: localization.preference() === item.value ? colors.accent : colors.border, borderRadius: 10 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{item.value === "auto" ? t("Auto ({{language}})", { language: current }) : item.label}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => setShow(false)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[typography.bodyStrong, { color: colors.accent }]}>{t("Cancel")}</Text></Pressable>
        </ScrollView></Card>
      </View>
    </Modal>
  </View>;
}
