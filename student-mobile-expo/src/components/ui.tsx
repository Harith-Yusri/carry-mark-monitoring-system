import { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator, KeyboardTypeOptions, Pressable, StyleProp, StyleSheet, Text,
  TextInput, TextInputProps, View, ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { fonts } from "@/theme/fonts";

export function Screen({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  return <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: colors.background }, style]}>{children}</SafeAreaView>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.background }, style]}>{children}</View>;
}

export function Heading({ children, size = 28 }: PropsWithChildren<{ size?: number }>) {
  const { colors } = useTheme();
  return <Text style={[styles.heading, { color: colors.text, fontSize: size }]}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.muted }]}>{children}</Text>;
}

export function Field({ label, keyboardType, rightAccessory, ...props }: TextInputProps & { label: string; keyboardType?: KeyboardTypeOptions; rightAccessory?: ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ gap: 7 }}>
    <Label>{label}</Label>
    <View>
      <TextInput
        {...props}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        style={[styles.field, rightAccessory ? styles.fieldWithAccessory : undefined, { backgroundColor: colors.elevated, borderColor: colors.border, color: colors.text }, props.style]}
      />
      {rightAccessory && <View style={styles.fieldAccessory}>{rightAccessory}</View>}
    </View>
  </View>;
}

export function PrimaryButton({ children, onPress, disabled, compact = false }: {
  children: ReactNode; onPress: () => void; disabled?: boolean; compact?: boolean;
}) {
  const { colors } = useTheme();
  return <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      compact && styles.compactButton,
      { backgroundColor: colors.primary, opacity: disabled ? .5 : pressed ? .82 : 1 },
    ]}
  >
    {children}
  </Pressable>;
}

export function ButtonText({ children }: PropsWithChildren) {
  return <Text style={styles.buttonText}>{children}</Text>;
}

export function ErrorBanner({ message }: { message: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;
  return <View accessibilityRole="alert" style={[styles.error, { borderColor: colors.danger, backgroundColor: `${colors.danger}18` }]}>
    <Text style={{ color: colors.danger, fontFamily: fonts.sansMedium, fontWeight: "600", lineHeight: 20 }}>{message}</Text>
  </View>;
}

export function LoadingView() {
  const { colors } = useTheme();
  return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export const typography = StyleSheet.create({
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 15, lineHeight: 22 },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 17, shadowOffset: { width: 0, height: 8 }, shadowOpacity: .2, shadowRadius: 18, elevation: 3 },
  heading: { fontFamily: fonts.display, fontWeight: "700", lineHeight: 35, letterSpacing: -.4 },
  label: { fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 12, lineHeight: 17, letterSpacing: .7, textTransform: "uppercase" },
  field: { minHeight: 52, borderWidth: 1, borderRadius: 13, paddingHorizontal: 15, fontFamily: fonts.sans, fontSize: 16 },
  fieldWithAccessory: { paddingRight: 66 },
  fieldAccessory: { position: "absolute", right: 4, top: 0, bottom: 0, justifyContent: "center" },
  button: { minHeight: 50, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, flexDirection: "row", gap: 8 },
  compactButton: { minHeight: 42, paddingHorizontal: 14 },
  buttonText: { color: "#FFFFFF", fontFamily: fonts.sansMedium, fontWeight: "600", fontSize: 15 },
  error: { borderWidth: 1, borderRadius: 12, padding: 12 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
