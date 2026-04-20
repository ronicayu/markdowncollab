"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import React from "react";

type Theme = "light" | "dark" | "system";

export interface NamedTheme {
  id: string;
  label: string;
  base: "light" | "dark";
  variables: Record<string, string>;
}

export const PRESET_THEMES: NamedTheme[] = [
  {
    id: "default-light",
    label: "Default Light",
    base: "light",
    variables: {},
  },
  {
    id: "default-dark",
    label: "Default Dark",
    base: "dark",
    variables: {},
  },
  {
    id: "ocean",
    label: "Ocean",
    base: "dark",
    variables: {
      "--background": "#0d1b2a",
      "--foreground": "#e0e8f0",
      "--page-bg": "#0a1628",
      "--sidebar-bg": "#081420",
      "--toolbar-bg": "#122640",
      "--toolbar-border": "#1b3a5c",
      "--topbar-bg": "#081420",
      "--card-bg": "#122640",
      "--card-border": "rgba(100,180,255,0.1)",
      "--card-hover-bg": "#183050",
      "--input-bg": "rgba(100,180,255,0.08)",
      "--input-border": "rgba(100,180,255,0.15)",
      "--accent": "#3B82F6",
      "--accent-hover": "#0075de",
      "--text-primary": "#e0e8f0",
      "--text-secondary": "#8babc8",
      "--text-muted": "#5580a0",
      "--editor-bg": "#0d1b2a",
      "--code-bg": "#081420",
      "--code-border": "#1b3a5c",
      "--blockquote-border": "#1b3a5c",
      "--blockquote-text": "#7098b8",
      "--hr-color": "#1b3a5c",
      "--comment-bg": "#1a2a40",
      "--comment-border": "#3B82F6",
      "--link-color": "#62aef0",
      "--link-hover": "#93bbfd",
      "--dialog-bg": "#122640",
      "--dialog-overlay": "rgba(0,0,0,0.6)",
    },
  },
  {
    id: "forest",
    label: "Forest",
    base: "dark",
    variables: {
      "--background": "#1a2e1a",
      "--foreground": "#d8e8d0",
      "--page-bg": "#152814",
      "--sidebar-bg": "#0f1e0e",
      "--toolbar-bg": "#1e3a1e",
      "--toolbar-border": "#2d5a2d",
      "--topbar-bg": "#0f1e0e",
      "--card-bg": "#1e3a1e",
      "--card-border": "rgba(80,180,80,0.1)",
      "--card-hover-bg": "#254a25",
      "--input-bg": "rgba(80,180,80,0.08)",
      "--input-border": "rgba(80,180,80,0.15)",
      "--accent": "#22C55E",
      "--accent-hover": "#16A34A",
      "--text-primary": "#d8e8d0",
      "--text-secondary": "#90b888",
      "--text-muted": "#608858",
      "--editor-bg": "#1a2e1a",
      "--code-bg": "#0f1e0e",
      "--code-border": "#2d5a2d",
      "--blockquote-border": "#2d5a2d",
      "--blockquote-text": "#78a870",
      "--hr-color": "#2d5a2d",
      "--comment-bg": "#1a3020",
      "--comment-border": "#22C55E",
      "--link-color": "#4ade80",
      "--link-hover": "#86efac",
      "--dialog-bg": "#1e3a1e",
      "--dialog-overlay": "rgba(0,0,0,0.6)",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    base: "dark",
    variables: {
      "--background": "#2a1a14",
      "--foreground": "#f0d8c8",
      "--page-bg": "#241610",
      "--sidebar-bg": "#1a100a",
      "--toolbar-bg": "#3a2218",
      "--toolbar-border": "#5a3828",
      "--topbar-bg": "#1a100a",
      "--card-bg": "#3a2218",
      "--card-border": "rgba(240,140,60,0.12)",
      "--card-hover-bg": "#4a2c20",
      "--input-bg": "rgba(240,140,60,0.08)",
      "--input-border": "rgba(240,140,60,0.15)",
      "--accent": "#F97316",
      "--accent-hover": "#EA580C",
      "--text-primary": "#f0d8c8",
      "--text-secondary": "#c8a088",
      "--text-muted": "#907060",
      "--editor-bg": "#2a1a14",
      "--code-bg": "#1a100a",
      "--code-border": "#5a3828",
      "--blockquote-border": "#5a3828",
      "--blockquote-text": "#b89070",
      "--hr-color": "#5a3828",
      "--comment-bg": "#3a2010",
      "--comment-border": "#F97316",
      "--link-color": "#fb923c",
      "--link-hover": "#fdba74",
      "--dialog-bg": "#3a2218",
      "--dialog-overlay": "rgba(0,0,0,0.6)",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    base: "dark",
    variables: {
      "--background": "#1a1428",
      "--foreground": "#dcd0f0",
      "--page-bg": "#161024",
      "--sidebar-bg": "#100c1e",
      "--toolbar-bg": "#241e3a",
      "--toolbar-border": "#382e5a",
      "--topbar-bg": "#100c1e",
      "--card-bg": "#241e3a",
      "--card-border": "rgba(160,100,240,0.1)",
      "--card-hover-bg": "#2e284a",
      "--input-bg": "rgba(160,100,240,0.08)",
      "--input-border": "rgba(160,100,240,0.15)",
      "--accent": "#A855F7",
      "--accent-hover": "#9333EA",
      "--text-primary": "#dcd0f0",
      "--text-secondary": "#a898c8",
      "--text-muted": "#786898",
      "--editor-bg": "#1a1428",
      "--code-bg": "#100c1e",
      "--code-border": "#382e5a",
      "--blockquote-border": "#382e5a",
      "--blockquote-text": "#9080b8",
      "--hr-color": "#382e5a",
      "--comment-bg": "#281e40",
      "--comment-border": "#A855F7",
      "--link-color": "#c084fc",
      "--link-hover": "#d8b4fe",
      "--dialog-bg": "#241e3a",
      "--dialog-overlay": "rgba(0,0,0,0.6)",
    },
  },
];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: "light" | "dark";
  namedThemeId: string | null;
  setNamedTheme: (id: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
  namedThemeId: null,
  setNamedTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyNamedThemeVariables(themeId: string | null) {
  const root = document.documentElement;
  // Remove any previously applied theme variables
  const preset = PRESET_THEMES.find((t) => t.id === themeId);
  // Clear custom variables from all themes
  for (const t of PRESET_THEMES) {
    for (const key of Object.keys(t.variables)) {
      root.style.removeProperty(key);
    }
  }
  if (preset && Object.keys(preset.variables).length > 0) {
    for (const [key, value] of Object.entries(preset.variables)) {
      root.style.setProperty(key, value);
    }
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [namedThemeId, setNamedThemeIdState] = useState<string | null>(null);

  // Read initial value from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setThemeState(stored);
    }
    const storedNamed = localStorage.getItem("namedTheme");
    if (storedNamed) {
      setNamedThemeIdState(storedNamed);
    }
  }, []);

  // Resolve the actual theme and apply dark class
  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    if (resolved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Apply named theme variables
  useEffect(() => {
    applyNamedThemeVariables(namedThemeId);
  }, [namedThemeId]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      if (resolved === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
  }, []);

  const setNamedTheme = useCallback((id: string | null) => {
    setNamedThemeIdState(id);
    if (id) {
      localStorage.setItem("namedTheme", id);
      // Also set the base light/dark mode
      const preset = PRESET_THEMES.find((t) => t.id === id);
      if (preset) {
        setThemeState(preset.base);
        localStorage.setItem("theme", preset.base);
      }
    } else {
      localStorage.removeItem("namedTheme");
    }
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme, namedThemeId, setNamedTheme }),
    [theme, setTheme, resolvedTheme, namedThemeId, setNamedTheme]
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}
