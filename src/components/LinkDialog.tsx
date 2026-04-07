"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";

interface LinkDialogProps {
  editor: Editor;
  onClose: () => void;
}

export default function LinkDialog({ editor, onClose }: LinkDialogProps) {
  const urlRef = useRef<HTMLInputElement>(null);
  const { from, to } = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(from, to, " ");

  // Pre-fill from existing link if cursor is inside one
  const existingHref = editor.getAttributes("link").href ?? "";

  const [url, setUrl] = useState(existingHref);
  const [text, setText] = useState(selectedText);

  useEffect(() => {
    // Focus the URL field on mount
    urlRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleApply() {
    if (!url.trim()) return;
    const href = url.match(/^https?:\/\//) ? url : `https://${url}`;

    if (text && text !== selectedText) {
      // Replace selection with new text + link
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent({
          type: "text",
          text: text,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    } else if (selectedText) {
      // Apply link to existing selection
      editor.chain().focus().setLink({ href }).run();
    } else {
      // No selection — insert text with link
      const displayText = text || url;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: displayText,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    }
    onClose();
  }

  function handleRemove() {
    editor.chain().focus().unsetLink().run();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleApply();
  }

  return (
    <div
      data-testid="link-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <form
        data-testid="link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-dialog-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 id="link-dialog-title" className="text-sm font-semibold text-gray-900">Insert Link</h3>

        <div className="space-y-3">
          <div>
            <label htmlFor="link-url" className="block text-xs font-medium text-gray-500 mb-1">
              URL
            </label>
            <input
              ref={urlRef}
              id="link-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
            />
          </div>

          <div>
            <label htmlFor="link-text" className="block text-xs font-medium text-gray-500 mb-1">
              Display text
            </label>
            <input
              id="link-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Link text"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          {existingHref ? (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Remove link
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim()}
              className="px-4 py-1.5 text-xs font-medium text-white bg-[#B8692A] rounded-lg hover:bg-[#A05A22] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
