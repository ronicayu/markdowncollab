"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import React from "react";

// Supported locales
export type Locale = "en" | "es" | "fr" | "ja";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Espanol",
  fr: "Francais",
  ja: "Japanese",
};

// Static locale imports so the bundler can resolve them
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import ja from "@/locales/ja.json";

const allTranslations: Record<Locale, Record<string, string>> = { en, es, fr, ja };

function loadTranslations(locale: Locale): Record<string, string> {
  return allTranslations[locale] ?? allTranslations.en;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
  ready: boolean;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: string, fallback?: string) => fallback ?? key,
  ready: false,
});

export function useTranslation() {
  return useContext(I18nContext);
}

const STORAGE_KEY = "markdown-collab-locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [translations, setTranslations] = useState<Record<string, string>>(loadTranslations("en"));
  const [ready, setReady] = useState(true);

  // Load stored preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && stored in LOCALE_LABELS) {
      setLocaleState(stored);
      setTranslations(loadTranslations(stored));
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setTranslations(loadTranslations(newLocale));
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return translations[key] ?? fallback ?? key;
    },
    [translations]
  );

  return React.createElement(
    I18nContext.Provider,
    { value: { locale, setLocale, t, ready } },
    children
  );
}
