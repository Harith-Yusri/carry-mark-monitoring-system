import * as SecureStore from "expo-secure-store";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { darkPalette, lightPalette, Palette } from "@/theme/colors";

const THEME_KEY = "cmms-theme";
type ThemeMode = "light" | "dark";

type ThemeValue = {
  mode: ThemeMode;
  colors: Palette;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(system === "light" ? "light" : "dark");

  useEffect(() => {
    void SecureStore.getItemAsync(THEME_KEY).then(value => {
      if (value === "light" || value === "dark") setMode(value);
    }).catch(reason => {
      if (__DEV__) console.warn("[Theme] Unable to restore the saved theme; using the system theme.", reason);
    });
  }, []);

  const value = useMemo<ThemeValue>(() => ({
    mode,
    colors: mode === "dark" ? darkPalette : lightPalette,
    toggle: () => setMode(current => {
      const next = current === "dark" ? "light" : "dark";
      void SecureStore.setItemAsync(THEME_KEY, next).catch(reason => {
        if (__DEV__) console.warn("[Theme] Unable to save the selected theme.", reason);
      });
      return next;
    }),
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
