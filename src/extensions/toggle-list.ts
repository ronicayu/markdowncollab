/**
 * ToggleList — a custom Tiptap extension that provides collapsible list items.
 * Each toggle item has a header (always visible) and a body (collapsible).
 * Click the triangle indicator to expand/collapse.
 *
 * Usage:
 *   import { ToggleList, ToggleItem } from "@/extensions/toggle-list";
 *   extensions: [ ..., ToggleList, ToggleItem ]
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import React, { useState, useCallback } from "react";

/* ---------- ToggleItem Node View (React) ---------- */

function ToggleItemView({
  node,
  updateAttributes,
}: {
  node: { attrs: { open: boolean } };
  updateAttributes: (attrs: Partial<{ open: boolean }>) => void;
  selected: boolean;
}) {
  const [open, setOpen] = useState(node.attrs.open);

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !open;
      setOpen(next);
      updateAttributes({ open: next });
    },
    [open, updateAttributes],
  );

  return React.createElement(
    NodeViewWrapper,
    { as: "div", className: "toggle-item" },
    React.createElement(
      "div",
      { className: "toggle-item-row" },
      React.createElement(
        "button",
        {
          type: "button",
          className: "toggle-item-indicator",
          onClick: toggle,
          contentEditable: false,
          "aria-label": open ? "Collapse" : "Expand",
        },
        open ? "\u25BC" : "\u25B6",
      ),
      React.createElement(
        "div",
        { className: "toggle-item-header" },
        React.createElement(NodeViewContent, { as: "div", className: "toggle-item-content" }),
      ),
    ),
  );
}

/* ---------- ToggleItem Node ---------- */

export const ToggleItem = Node.create({
  name: "toggleItem",

  group: "block",

  content: "paragraph block*",

  draggable: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-open") !== "false",
        renderHTML: (attributes: { open: boolean }) => ({
          "data-open": attributes.open ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-item"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toggle-item", class: "toggle-item" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleItemView);
  },
});

/* ---------- ToggleList Node ---------- */

export const ToggleList = Node.create({
  name: "toggleList",

  group: "block",

  content: "toggleItem+",

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-list"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toggle-list", class: "toggle-list" }),
      0,
    ];
  },

  addCommands() {
    return {
      insertToggleList:
        () =>
        ({ chain }: { chain: () => ReturnType<ReturnType<typeof chain>> }) => {
          return chain()
            .insertContent({
              type: "toggleList",
              content: [
                {
                  type: "toggleItem",
                  attrs: { open: true },
                  content: [{ type: "paragraph" }],
                },
              ],
            })
            .run();
        },
    } as Record<string, (...args: unknown[]) => unknown>;
  },
});
