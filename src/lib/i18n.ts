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

// Translation dictionaries loaded lazily
const translationCache: Partial<Record<Locale, Record<string, string>>> = {};

async function loadTranslations(locale: Locale): Promise<Record<string, string>> {
  if (translationCache[locale]) return translationCache[locale]!;
  try {
    const mod = await import(`@/locales/${locale}.json`);
    const data = mod.default ?? mod;
    translationCache[locale] = data;
    return data;
  } catch {
    return {};
  }
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
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  // Load stored preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && stored in LOCALE_LABELS) {
      setLocaleState(stored);
    } else {
      setReady(true);
    }
  }, []);

  // Load translations whenever locale changes
  useEffect(() => {
    let cancelled = false;
    loadTranslations(locale).then((data) => {
      if (!cancelled) {
        setTranslations(data);
        setReady(true);
      }
    });
    return () => { cancelled = true; };
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
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
