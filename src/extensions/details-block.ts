/**
 * DetailsBlock — a custom Tiptap Node that renders a collapsible/details
 * section with a summary title and content body.
 *
 * Usage in Editor.tsx:
 *   import { DetailsBlock } from "@/extensions/details-block";
 *   extensions: [ ..., DetailsBlock ]
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useState, useRef, useEffect } from "react";
import React from "react";

function DetailsNodeView({ node, updateAttributes, selected }: {
  node: { attrs: { summary: string; body: string } };
  updateAttributes: (attrs: Partial<{ summary: string; body: string }>) => void;
  selected: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [summaryValue, setSummaryValue] = useState(node.attrs.summary || "Details");
  const [bodyValue, setBodyValue] = useState(node.attrs.body || "");
  const summaryRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSummaryValue(node.attrs.summary || "Details");
  }, [node.attrs.summary]);

  useEffect(() => {
    setBodyValue(node.attrs.body || "");
  }, [node.attrs.body]);

  useEffect(() => {
    if (editingSummary && summaryRef.current) summaryRef.current.focus();
  }, [editingSummary]);

  useEffect(() => {
    if (editingBody && bodyRef.current) {
      bodyRef.current.focus();
      bodyRef.current.style.height = "auto";
      bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
    }
  }, [editingBody]);

  return React.createElement(
    NodeViewWrapper,
    { className: `details-block ${selected ? "details-block-selected" : ""}`, contentEditable: false },
    // Summary row
    React.createElement(
      "div",
      {
        className: "details-block-summary",
        onClick: () => {
          if (!editingSummary) setExpanded((v) => !v);
        },
      },
      React.createElement("span", { className: "details-block-chevron" }, expanded ? "\u25BC" : "\u25B6"),
      editingSummary
        ? React.createElement("input", {
            ref: summaryRef,
            className: "details-block-summary-input",
            value: summaryValue,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSummaryValue(e.target.value),
            onBlur: () => {
              updateAttributes({ summary: summaryValue });
              setEditingSummary(false);
            },
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === "Escape") {
                updateAttributes({ summary: summaryValue });
                setEditingSummary(false);
              }
            },
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
          })
        : React.createElement(
            "span",
            {
              className: "details-block-summary-text",
              onDoubleClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                setEditingSummary(true);
              },
            },
            summaryValue || "Details"
          )
    ),
    // Body
    expanded &&
      React.createElement(
        "div",
        { className: "details-block-body" },
        editingBody
          ? React.createElement("textarea", {
              ref: bodyRef,
              className: "details-block-body-editor",
              value: bodyValue,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setBodyValue(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              },
              onBlur: () => {
                updateAttributes({ body: bodyValue });
                setEditingBody(false);
              },
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Escape") {
                  updateAttributes({ body: bodyValue });
                  setEditingBody(false);
                }
              },
              placeholder: "Add content here...",
            })
          : React.createElement(
              "div",
              {
                className: "details-block-body-text",
                onClick: () => setEditingBody(true),
              },
              bodyValue || "Click to add content..."
            )
      )
  );
}

export const DetailsBlock = Node.create({
  name: "detailsBlock",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      summary: { default: "Details" },
      body: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="details-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "details-block", class: "details-block" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DetailsNodeView);
  },
});
