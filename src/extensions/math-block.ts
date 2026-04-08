/**
 * MathBlock — a custom Tiptap Node that renders LaTeX math equations
 * using KaTeX. Shows a textarea for editing and rendered output for display.
 *
 * Usage in Editor.tsx:
 *   import { MathBlock } from "@/extensions/math-block";
 *   extensions: [ ..., MathBlock ]
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useState, useRef, useEffect, useCallback } from "react";
import React from "react";
import katex from "katex";

function MathNodeView({ node, updateAttributes, selected }: any) {
  const [editing, setEditing] = useState(!node.attrs.content);
  const [value, setValue] = useState(node.attrs.content || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  const renderMath = useCallback(() => {
    if (!displayRef.current) return;
    const latex = node.attrs.content || "";
    if (!latex.trim()) {
      displayRef.current.innerHTML =
        '<span class="math-block-placeholder">Click to add a math equation</span>';
      return;
    }
    try {
      displayRef.current.innerHTML = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        output: "htmlAndMathml",
      });
    } catch {
      displayRef.current.innerHTML = `<span class="math-block-error">Invalid LaTeX: ${latex}</span>`;
    }
  }, [node.attrs.content]);

  useEffect(() => {
    if (!editing) renderMath();
  }, [editing, renderMath]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  function handleBlur() {
    updateAttributes({ content: value });
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      updateAttributes({ content: value });
      setEditing(false);
    }
  }

  return React.createElement(
    NodeViewWrapper,
    { className: `math-block ${selected ? "math-block-selected" : ""}` },
    React.createElement(
      "div",
      { className: "math-block-label", contentEditable: false },
      "Math"
    ),
    editing
      ? React.createElement("textarea", {
          ref: textareaRef,
          className: "math-block-editor",
          value,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setValue(e.target.value);
            // Auto-resize
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          },
          onBlur: handleBlur,
          onKeyDown: handleKeyDown,
          placeholder: "Enter LaTeX (e.g. E = mc^2)",
          spellCheck: false,
        })
      : React.createElement("div", {
          ref: displayRef,
          className: "math-block-display",
          contentEditable: false,
          onClick: () => {
            setValue(node.attrs.content || "");
            setEditing(true);
          },
        })
  );
}

export const MathBlock = Node.create({
  name: "mathBlock",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      content: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "math-block", class: "math-block" }),
      HTMLAttributes.content || "",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});
