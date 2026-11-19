import { createInstance } from "i18next";
import en from "../locales/en.json";
import ms from "../locales/ms.json";
import zh from "../locales/zh.json";
import ta from "../locales/ta.json";

export type Language = "en" | "ms" | "zh" | "ta";
export type LanguagePreference = Language | "auto";
export const LANGUAGE_KEY = "cams.language.v1";
export const languages: { value: LanguagePreference; label: string }[] = [
  { value: "auto", label: "Auto" }, { value: "en", label: "English" },
  { value: "ms", label: "Bahasa Melayu" }, { value: "zh", label: "中文（简体）" }, { value: "ta", label: "தமிழ்" },
];
export function validPreference(value: unknown): LanguagePreference {
  return languages.some(item => item.value === value) ? value as LanguagePreference : "auto";
}
export function detectLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const base = tag.trim().toLowerCase().replaceAll("_", "-").split("-")[0];
    if (["en", "ms", "zh", "ta"].includes(base)) return base as Language;
  }
  return "en";
}
export function deviceLanguages(): string[] {
  try { return [Intl.DateTimeFormat().resolvedOptions().locale]; } catch { return ["en"]; }
}
export type PreferenceStorage = { read: () => string | null | Promise<string | null>; write: (value: string) => void | Promise<void> };
const resources = { en: { translation: en }, ms: { translation: ms }, zh: { translation: zh }, ta: { translation: ta } };
/** Bundled resources only. This module has no network, auth or academic API. */
export function createLocalization(getLanguages: () => readonly string[] = deviceLanguages) {
  const instance = createInstance();
  let preference: LanguagePreference = "auto", locale = detectLanguage(getLanguages()), revision = 0, selection = 0;
  let persistenceError = false, writes = Promise.resolve();
  const listeners = new Set<() => void>();
  void instance.init({ resources, lng: locale, fallbackLng: "en", supportedLngs: ["en", "ms", "zh", "ta"],
    initAsync: false, keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false, skipOnVariables: true } });
  const notify = () => { revision++; listeners.forEach(listener => listener()); };
  const apply = (value: LanguagePreference) => {
    preference = value; locale = value === "auto" ? detectLanguage(getLanguages()) : value;
    void instance.changeLanguage(locale); notify();
  };
  const canonical = new Map(Object.keys(en).map(key => [key.trim().toLowerCase(), key]));
  const t = (key: string, values?: Record<string, unknown>): string => String(instance.t(Object.prototype.hasOwnProperty.call(en, key) ? key : canonical.get(key.trim().toLowerCase()) ?? key, values ?? {}));
  // Used ONLY at controlled error/status/notification presentation boundaries.
  // Dynamic names, subject/assessment/class names, responses and reasons never
  // pass through this function. Interpolated values are copied unchanged.
  const patterns = Object.keys(en).filter(key => key.includes("{{")).map(key => {
    const names: string[] = [];
    const regex = key.split(/(\{\{[^}]+\}\})/g).map(part => {
      if (part.startsWith("{{")) { names.push(part.slice(2, -2).trim()); return "([\\s\\S]*?)"; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
    return { key, names, regex: new RegExp(`^${regex}$`) };
  });
  const notificationText = (text: string): string => {
    if (Object.prototype.hasOwnProperty.call(en, text)) return t(text);
    for (const pattern of patterns) {
      const match = pattern.regex.exec(text);
      if (match) return t(pattern.key, Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]])));
    }
    return text;
  };
  const tx = (text: string | null | undefined): string => {
    if (!text) return text ?? "";
    const clean = text.startsWith("CAMS: ") ? text.slice(6) : text;
    if (Object.prototype.hasOwnProperty.call(en, clean)) return t(clean);
    const rules: [RegExp, string][] = [
      [/score.*(?:maximum|decimal|negative)|Enter a score from|corrected score is no longer valid/i, "Enter a score from zero to the assessment maximum with at most two decimal places."],
      [/corrected score must differ/i, "The corrected score must differ from the original score."],
      [/correction reason/i, "Enter a correction reason between 1 and 2000 characters."],
      [/Reject requires|response.*2000/i, "Enter a response between 1 and 2000 characters."],
      [/explanation.*2000/i, "Enter an explanation between 1 and 2000 characters."],
      [/open report already exists/i, "An open report already exists for this assessment. Check its status below."],
      [/active correction|already awaiting release/i, "An active correction already exists for this mark. Continue its existing correction."],
      [/already closed/i, "This report is already closed."],
      [/archiv|Previous-semester|read-only/i, "Archived academic records are read-only."],
      [/has changed|have changed|no longer assigned|assigned lecturer has changed/i, "This data has changed. Refresh before continuing."],
      [/Only the assigned|not available to your account|not authorized|not authorised|active lecturer|administrator access/i, "You do not have permission to perform this action."],
      [/student and assessment|enrolment and assessment|not enrolled|belong.*class|legacy report.*ambiguous/i, "Check the selected class, student and assessment before continuing."],
      [/Only.*Released mark|No Released mark/i, "Only an existing Released mark can be corrected."],
    ];
    for (const [pattern, key] of rules) if (pattern.test(clean)) return t(key);
    text = clean;
    if (Object.prototype.hasOwnProperty.call(en, text)) return t(text);
    for (const pattern of patterns) {
      const match = pattern.regex.exec(text);
      if (match) return t(pattern.key, Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]])));
    }
    return text;
  };
  return {
    t, tx, notificationText, instance, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot: () => revision, preference: () => preference, locale: () => locale, persistenceError: () => persistenceError,
    async restore(storage: PreferenceStorage) {
      const generation = selection;
      try { const stored = await storage.read(); if (generation === selection) apply(validPreference(stored)); }
      catch { /* Detection remains usable when preference storage is unavailable. */ }
    },
    setPreference(value: LanguagePreference, storage: PreferenceStorage) {
      selection++; persistenceError = false;
      const safe = validPreference(value); apply(safe);
      writes = writes.catch(() => undefined).then(() => storage.write(safe)).then(() => { if (persistenceError) { persistenceError = false; notify(); } }, () => { persistenceError = true; notify(); });
      return writes;
    },
    detect() { if (preference === "auto") apply("auto"); },
  };
}
