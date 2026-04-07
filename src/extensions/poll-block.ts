/**
 * PollBlock — custom Tiptap atom node for inline polls/voting.
 *
 * Stores votes in Yjs Y.Map("polls") for real-time sync.
 * Each poll entry: { votes: Record<optionIndex, string[]> }
 * (option index -> array of voter names)
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import PollNodeView from "@/components/PollNodeView";

export const PollBlock = Node.create({
  name: "pollBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      pollId: {
        default: null,
      },
      question: {
        default: "Untitled Poll",
      },
      options: {
        default: "[]",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="poll-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "poll-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PollNodeView);
  },
});
