"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/core";

interface AIAutoCompleteProps {
  editor: Editor | null;
  enabled: boolean;
}

const MAX_COMPLETIONS_PER_MINUTE = 5;
const PAUSE_DELAY_MS = 3000;

export default function AIAutoComplete({ editor, enabled }: AIAutoCompleteProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimestamps = useRef<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const lastTextRef = useRef<string>("");

  const dismiss = useCallback(() => {
    setSuggestion(null);
    setPosition(null);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Accept suggestion on Tab
  useEffect(() => {
    if (!editor || !suggestion) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab" && suggestion) {
        e.preventDefault();
        editor.chain().focus().insertContent(suggestion).run();
        dismiss();
      } else if (e.key === "Escape") {
        dismiss();
      }
    };
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [editor, suggestion, dismiss]);

  // Dismiss on any typing when suggestion is shown
  useEffect(() => {
    if (!editor || !suggestion) return;
    const handler = () => dismiss();
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [editor, suggestion, dismiss]);

  // Watch for typing pauses
  useEffect(() => {
    if (!editor || !enabled) return;

    const onUpdate = () => {
      // Clear previous timer
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      dismiss();

      pauseTimerRef.current = setTimeout(async () => {
        if (!editor) return;

        // Rate limit check
        const now = Date.now();
        completionTimestamps.current = completionTimestamps.current.filter(
          (ts) => now - ts < 60000
        );
        if (completionTimestamps.current.length >= MAX_COMPLETIONS_PER_MINUTE) return;

        // Get last paragraph text
        const { $from } = editor.state.selection;
        if ($from.parent.type.name !== "paragraph") return;
        const text = $from.parent.textContent;
        if (!text || text.trim().length < 10) return;
        if (text === lastTextRef.current) return;
        lastTextRef.current = text;

        // Get cursor position for popover
        const coords = editor.view.coordsAtPos($from.pos);
        const editorRect = editor.view.dom.getBoundingClientRect();

        try {
          const controller = new AbortController();
          abortRef.current = controller;

          const res = await fetch("/api/agent/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            signal: controller.signal,
          });

          if (!res.ok) return;
          const data = await res.json();
          if (data.completion && data.completion.trim()) {
            completionTimestamps.current.push(Date.now());
            setSuggestion(data.completion.trim());
            setPosition({
              top: coords.bottom - editorRect.top + 4,
              left: coords.left - editorRect.left,
            });
          }
        } catch {
          // Aborted or network error — ignore
        }
      }, PAUSE_DELAY_MS);
    };

    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, [editor, enabled, dismiss]);

  if (!suggestion || !position || !enabled) return null;

  return (
    <div
      className="absolute z-40 max-w-md bg-white border border-[rgba(0,0,0,0.1)] rounded-lg shadow-lg px-3 py-2 text-sm"
      style={{ top: position.top, left: Math.max(0, position.left) }}
    >
      <p className="text-[#a39e98] italic leading-relaxed">{suggestion}</p>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#a39e98]">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-[#f6f5f4] rounded text-[10px] font-mono">Tab</kbd>
          accept
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-[#f6f5f4] rounded text-[10px] font-mono">Esc</kbd>
          dismiss
        </span>
      </div>
    </div>
  );
}
