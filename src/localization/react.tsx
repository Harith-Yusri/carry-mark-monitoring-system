import { useSyncExternalStore } from "react";
import { createLocalization, LANGUAGE_KEY, type LanguagePreference } from "../../student-mobile-expo/src/localization/core";
export { languages } from "../../student-mobile-expo/src/localization/core";
const browserLanguages = () => typeof navigator === "undefined" ? ["en"] : navigator.languages?.length ? navigator.languages : [navigator.language];
export const localization = createLocalization(browserLanguages);
const storage = { read: () => window.localStorage.getItem(LANGUAGE_KEY), write: (value: string) => window.localStorage.setItem(LANGUAGE_KEY, value) };
export const t = localization.t;
export const tx = localization.tx;
export function useLocale() { useSyncExternalStore(localization.subscribe, localization.snapshot); return localization.locale(); }
export const setLanguage = (preference: LanguagePreference) => localization.setPreference(preference, storage);
if (typeof window !== "undefined") {
  void localization.restore(storage);
  window.addEventListener("languagechange", () => localization.detect());
  localization.subscribe(() => { document.documentElement.lang = localization.locale() === "zh" ? "zh-Hans" : localization.locale(); });
  document.documentElement.lang = localization.locale();
}
