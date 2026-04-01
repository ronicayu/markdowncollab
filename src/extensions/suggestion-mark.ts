import { Mark, mergeAttributes } from "@tiptap/core";

export interface SuggestionMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionMark: {
      setSuggestionMark: (attrs: {
        suggestionId: string;
        type: "add" | "delete";
      }) => ReturnType;
      unsetSuggestionMark: () => ReturnType;
    };
  }
}

export const SuggestionMark = Mark.create<SuggestionMarkOptions>({
  name: "suggestionMark",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-suggestion-id"),
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.suggestionId) return {};
          return { "data-suggestion-id": attrs.suggestionId };
        },
      },
      type: {
        default: "add",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-suggestion-type"),
        renderHTML: (attrs: Record<string, unknown>) => {
          return { "data-suggestion-type": attrs.type };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-suggestion-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes["data-suggestion-type"];
    const style =
      type === "delete"
        ? "text-decoration: line-through; color: #DC2626; background-color: #FEE2E2;"
        : "color: #16A34A; background-color: #DCFCE7;";
    return [
      "mark",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { style }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestionMark:
        (attributes) =>
        ({ commands }) =>
          commands.setMark(this.name, attributes),
      unsetSuggestionMark:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
