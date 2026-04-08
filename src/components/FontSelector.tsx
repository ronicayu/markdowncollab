"use client";

import { useState, useRef, useEffect } from "react";

export type FontOption = "default" | "sans" | "mono" | "serif";

export const FONT_OPTIONS: { value: FontOption; label: string; family: string }[] = [
  { value: "default", label: "Default", family: "Georgia, serif" },
  { value: "sans", label: "Sans-serif", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { value: "mono", label: "Monospace", family: "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, monospace" },
  { value: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif" },
];

export function getFontFamily(value: string | null | undefined): string {
  const option = FONT_OPTIONS.find((o) => o.value === value);
  return option?.family ?? FONT_OPTIONS[0].family;
}

interface FontSelectorProps {
  value: FontOption;
  onChange: (value: FontOption) => void;
}

export default function FontSelector({ value, onChange }: FontSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const currentLabel = FONT_OPTIONS.find((o) => o.value === value)?.label ?? "Default";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-[#3E3A36]/70 hover:text-[#3E3A36] hover:bg-[#3E3A36]/5 rounded transition-colors"
        title="Change font"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
        </svg>
        <span>{currentLabel}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[160px]">
          {FONT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                value === opt.value ? "font-medium text-[#B8692A]" : "text-gray-700"
              }`}
              style={{ fontFamily: opt.family }}
            >
              <span>{opt.label}</span>
              {value === opt.value && (
                <svg className="h-3.5 w-3.5 text-[#B8692A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
