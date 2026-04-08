import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import React from "react";

/**
 * InlineDateView — React NodeView for the inline date picker node.
 * Renders a styled date with a calendar icon. Click to edit via native date picker.
 */
function InlineDateView(props: any) {
  const { node, updateAttributes } = props;
  const [editing, setEditing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  }, [editing]);

  const formattedDate = (() => {
    try {
      const d = new Date(node.attrs.date + "T00:00:00");
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return node.attrs.date;
    }
  })();

  if (editing) {
    return React.createElement(
      NodeViewWrapper,
      { as: "span", className: "inline-date-node" },
      React.createElement("input", {
        ref: inputRef,
        type: "date",
        value: node.attrs.date,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          if (e.target.value) {
            updateAttributes({ date: e.target.value });
          }
        },
        onBlur: () => setEditing(false),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === "Escape") {
            setEditing(false);
          }
        },
        className:
          "border border-gray-300 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:border-[#B8692A] focus:ring-1 focus:ring-[#B8692A]",
        style: { fontSize: "inherit" },
      })
    );
  }

  return React.createElement(
    NodeViewWrapper,
    { as: "span", className: "inline-date-node" },
    React.createElement(
      "span",
      {
        onClick: () => setEditing(true),
        className:
          "inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded cursor-pointer hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200",
        title: "Click to change date",
        contentEditable: false,
      },
      React.createElement(
        "svg",
        {
          className: "h-3.5 w-3.5",
          fill: "none",
          viewBox: "0 0 24 24",
          stroke: "currentColor",
          strokeWidth: 2,
        },
        React.createElement("path", {
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
        })
      ),
      formattedDate
    )
  );
}

/**
 * InlineDate — Tiptap inline node extension for an editable date picker.
 */
export const InlineDate = Node.create({
  name: "inlineDate",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      date: {
        default: new Date().toISOString().slice(0, 10),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-date"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "inline-date" }),
      HTMLAttributes.date || "",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineDateView);
  },
});
