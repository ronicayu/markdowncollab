"use client";

import { useEffect, useState, useCallback } from "react";
import type { Editor } from "@tiptap/core";

interface FloatingCommentButtonProps {
  editor: Editor | null;
  onAddComment: () => void;
  commentFormOpen: boolean;
}

interface ButtonPosition {
  top: number;
  left: number;
}

export default function FloatingCommentButton({
  editor,
  onAddComment,
  commentFormOpen,
}: FloatingCommentButtonProps) {
  const [buttonPos, setButtonPos] = useState<ButtonPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!editor) {
      setButtonPos(null);
      return;
    }

    const { from, to } = editor.state.selection;
    const hasText = from !== to;

    if (!hasText || commentFormOpen) {
      setButtonPos(null);
      return;
    }

    // Don't show for whitespace-only selections
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) {
      setButtonPos(null);
      return;
    }

    // Check if the selection is inside a code block — skip if so
    const { $from } = editor.state.selection;
    const isInCode =
      $from.parent.type.name === "codeBlock" ||
      $from.parent.type.name === "code";
    if (isInCode) {
      setButtonPos(null);
      return;
    }

    // Use the native Selection API to get the bounding rect
    const nativeSel = window.getSelection();
    if (!nativeSel || nativeSel.rangeCount === 0) {
      setButtonPos(null);
      return;
    }

    const range = nativeSel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      setButtonPos(null);
      return;
    }

    // Place button 8px above the top of the selection, horizontally centered
    const BUTTON_WIDTH = 108; // approximate pill width
    const GAP = 8;

    const left = rect.left + rect.width / 2 - BUTTON_WIDTH / 2;
    const top = rect.top - GAP;

    setButtonPos({ top, left });
  }, [editor, commentFormOpen]);

  // Listen to Tiptap selection updates
  useEffect(() => {
    if (!editor) return;

    const handleBlur = () => setButtonPos(null);

    editor.on("selectionUpdate", updatePosition);
    editor.on("blur", handleBlur);

    return () => {
      editor.off("selectionUpdate", updatePosition);
      editor.off("blur", handleBlur);
    };
  }, [editor, updatePosition]);

  // Hide on scroll
  useEffect(() => {
    const handleScroll = () => setButtonPos(null);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

  // Hide when comment form opens
  useEffect(() => {
    if (commentFormOpen) {
      setButtonPos(null);
    }
  }, [commentFormOpen]);

  if (!buttonPos) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: buttonPos.top,
        left: buttonPos.left,
        zIndex: 50,
        transform: "translateY(-100%)",
        pointerEvents: "auto",
      }}
      className="animate-fade-in"
    >
      <button
        onMouseDown={(e) => {
          // Use onMouseDown + preventDefault so the editor selection is not
          // cleared before we save it in the parent's lastSelectionRef.
          e.preventDefault();
          onAddComment();
        }}
        className="flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-opacity duration-150 hover:bg-amber-700 active:bg-amber-800 select-none"
        aria-label="Add comment on selected text"
      >
        <svg
          className="h-3 w-3 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        + Comment
      </button>
    </div>
  );
}
