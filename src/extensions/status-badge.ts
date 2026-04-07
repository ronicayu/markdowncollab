/**
 * StatusBadge — a custom inline Tiptap Node for colored status badges.
 * Renders as a small colored pill with a label.
 *
 * Usage:
 *   import { StatusBadge } from "@/extensions/status-badge";
 *   extensions: [ ..., StatusBadge ]
 */

import { Node, mergeAttributes } from "@tiptap/core";

/** Predefined badge options with label and color. */
export const STATUS_BADGE_OPTIONS = [
  { label: "To Do", color: "#6b7280" },
  { label: "In Progress", color: "#3b82f6" },
  { label: "Done", color: "#22c55e" },
  { label: "Blocked", color: "#ef4444" },
  { label: "Needs Review", color: "#f59e0b" },
] as const;

export const StatusBadge = Node.create({
  name: "statusBadge",

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      label: {
        default: "To Do",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-label") || element.textContent || "To Do",
      },
      color: {
        default: "#6b7280",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-color") || "#6b7280",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="status-badge"]' }];
  },

  renderHTML({ node, HTMLAttributes }: { node: { attrs: { label: string; color: string } }; HTMLAttributes: Record<string, unknown> }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "status-badge",
        "data-label": node.attrs.label,
        "data-color": node.attrs.color,
        class: "status-badge",
        style: `background: ${node.attrs.color}`,
      }),
      node.attrs.label,
    ];
  },

  addCommands() {
    return {
      insertStatusBadge:
        (attrs: { label: string; color: string }) =>
        ({ chain }: { chain: () => ReturnType<ReturnType<typeof chain>> }) => {
          return chain()
            .insertContent({
              type: "statusBadge",
              attrs,
            })
            .run();
        },
    } as Record<string, (...args: unknown[]) => unknown>;
  },
});
