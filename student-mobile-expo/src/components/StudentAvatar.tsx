import { memo, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

export const StudentAvatar = memo(function StudentAvatar({ name }: { name?: string }) {
  const { colors } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const source = useMemo(() => uri ? { uri } : undefined, [uri]);

  useEffect(() => {
    // INITIAL_SESSION supplies the restored user; later auth events update the
    // photo without fetching the user/profile again or blocking startup.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      const googleIdentity = user?.identities?.find(identity => identity.provider === "google");
      const isGoogle = user?.app_metadata?.provider === "google" || !!googleIdentity;
      const candidates = isGoogle ? [
        user?.user_metadata?.avatar_url, user?.user_metadata?.picture,
        googleIdentity?.identity_data?.avatar_url, googleIdentity?.identity_data?.picture,
      ] : [];
      const photo = candidates.find(value => typeof value === "string" && /^https:\/\//i.test(value));
      setUri(typeof photo === "string" ? photo : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <View style={[styles.ring, { borderColor: `${colors.accent}55` }]}>
    <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
      <Text style={[styles.initial, { color: colors.accent }]}>{name?.charAt(0).toUpperCase() || "S"}</Text>
      {source && uri !== failedUri && <Image
        source={source}
        resizeMode="cover"
        accessibilityLabel="Your Google profile photo"
        style={styles.photo}
        onError={() => setFailedUri(uri)}
      />}
    </View>
  </View>;
});

const styles = StyleSheet.create({
  ring: { width: 66, height: 66, borderRadius: 33, borderWidth: 1, padding: 4 },
  avatar: { flex: 1, borderRadius: 28, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 26, lineHeight: 32, fontWeight: "800" },
  photo: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 28 },
});
