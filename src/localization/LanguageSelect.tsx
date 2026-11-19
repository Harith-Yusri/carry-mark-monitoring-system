import React from "react";
import { languages, localization, setLanguage, t, useLocale } from "./react";
export function LanguageSelect() {
  useLocale();
  const languageName = languages.find(item => item.value === localization.locale())!.label;
  return <label className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-lg border border-current/30 bg-white px-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-50">
    <span aria-hidden="true">🌐</span><span className="sr-only">{t("Language")}</span>
    <select data-testid="language-select" aria-label={t("Language")} value={localization.preference()} onChange={event => void setLanguage(event.target.value as typeof languages[number]["value"])} className="min-h-11 min-w-0 max-w-48 bg-transparent text-sm">
      {languages.map(item => <option key={item.value} value={item.value}>{item.value === "auto" ? t("Auto ({{language}})", { language: languageName }) : item.label}</option>)}
    </select>
  </label>;
}
