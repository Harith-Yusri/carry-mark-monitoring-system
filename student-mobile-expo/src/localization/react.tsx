import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createLocalization, deviceLanguages, LANGUAGE_KEY, type LanguagePreference } from "./core";
export { languages } from "./core";
export const localization = createLocalization(() => typeof navigator !== "undefined" && Platform.OS === "web" ? navigator.languages : deviceLanguages());
const storage = {
  read: () => Platform.OS === "web" ? Promise.resolve(globalThis.localStorage?.getItem(LANGUAGE_KEY) ?? null) : SecureStore.getItemAsync(LANGUAGE_KEY),
  write: (value: string) => Platform.OS === "web" ? globalThis.localStorage?.setItem(LANGUAGE_KEY, value) : SecureStore.setItemAsync(LANGUAGE_KEY, value),
};
export const t = localization.t;
export const tx = localization.tx;
export const notificationText = localization.notificationText;
export function useLocale() { useSyncExternalStore(localization.subscribe, localization.snapshot); return localization.locale(); }
export const setLanguage = (preference: LanguagePreference) => localization.setPreference(preference, storage);
void localization.restore(storage);
AppState.addEventListener("change", state => { if (state === "active") localization.detect(); });
