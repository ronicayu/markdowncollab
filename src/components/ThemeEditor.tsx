"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme, PRESET_THEMES } from "@/lib/theme";

const SWATCH_COLORS: Record<string, string> = {
  "default-light": "#F2E8D5",
  "default-dark": "#1a1a2e",
  ocean: "#0d1b2a",
  forest: "#1a2e1a",
  sunset: "#2a1a14",
  midnight: "#1a1428",
};

const ACCENT_COLORS: Record<string, string> = {
  "default-light": "#B8692A",
  "default-dark": "#D4913E",
  ocean: "#3B82F6",
  forest: "#22C55E",
  sunset: "#F97316",
  midnight: "#A855F7",
};

export default function ThemeEditor() {
  const { namedThemeId, setNamedTheme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeId = namedThemeId || (resolvedTheme === "dark" ? "default-dark" : "default-light");

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function selectTheme(id: string) {
    if (id === "default-light") {
      setNamedTheme(null);
      setTheme("light");
    } else if (id === "default-dark") {
      setNamedTheme(null);
      setTheme("dark");
    } else {
      setNamedTheme(id);
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change theme"
        title="Change theme"
        aria-expanded={open}
        className="flex items-center justify-center h-8 w-8 rounded-md text-white/60 hover:text-white hover:bg-white/8 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125V4.5a1.5 1.5 0 001.5 1.5h1.5a1.5 1.5 0 001.5-1.5V4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v3a3 3 0 01-3 3h-1.5a3 3 0 00-3 3v.75" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[#1a1a19] border border-white/10 rounded-lg shadow-xl z-50 py-2 px-2">
          <p className="text-[10px] uppercase tracking-wider text-white/30 px-2 mb-1.5">Theme</p>
          {PRESET_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTheme(t.id)}
              className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${
                activeId === t.id
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <span
                className="inline-block h-5 w-5 rounded-full border-2 shrink-0"
                style={{
                  backgroundColor: SWATCH_COLORS[t.id] || "#111",
                  borderColor: ACCENT_COLORS[t.id] || "#B8692A",
                }}
              />
              <span className="truncate">{t.label}</span>
              {activeId === t.id && (
                <svg className="h-3.5 w-3.5 ml-auto shrink-0 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
