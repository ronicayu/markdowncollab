import { Node, mergeAttributes } from "@tiptap/core";

/**
 * EventBlock — inline calendar event card.
 * Attributes: title, date, time, description.
 * Renders as a styled card; exports as plain text with calendar emoji.
 */
export const EventBlock = Node.create({
  name: "eventBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      title: {
        default: "Untitled Event",
        parseHTML: (el) => el.getAttribute("data-title") ?? "Untitled Event",
        renderHTML: (attrs) => ({ "data-title": attrs.title }),
      },
      date: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-date") ?? "",
        renderHTML: (attrs) => ({ "data-date": attrs.date }),
      },
      time: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-time") ?? "",
        renderHTML: (attrs) => ({ "data-time": attrs.time }),
      },
      description: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-description") ?? "",
        renderHTML: (attrs) => ({ "data-description": attrs.description }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="event-block"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { title, date, time, description } = node.attrs;
    const dateStr = time ? `${date} ${time}` : date;

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "event-block",
        style:
          "display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border:1px solid #E5E7EB;border-radius:8px;background:#FEFCE8;margin:8px 0;",
      }),
      [
        "span",
        { style: "font-size:24px;line-height:1;" },
        "\uD83D\uDCC5",
      ],
      [
        "div",
        {},
        ["strong", { style: "font-size:14px;color:#1F2937;" }, title],
        [
          "div",
          { style: "font-size:12px;color:#6B7280;margin-top:2px;" },
          dateStr,
        ],
        ...(description
          ? [
              [
                "div",
                { style: "font-size:12px;color:#9CA3AF;margin-top:4px;" },
                description,
              ] as any,
            ]
          : []),
      ],
    ];
  },

  // Markdown serialization for export
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const { title, date, time } = node.attrs;
          const dateStr = time ? `${date} ${time}` : date;
          state.write(`\uD83D\uDCC5 Event: ${title} (${dateStr})\n\n`);
        },
        parse: {
          // Not parsed from markdown — inserted via slash command only
        },
      },
    };
  },
});
