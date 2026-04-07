/**
 * MermaidBlock — extends the built-in CodeBlock so that code blocks with
 * `language="mermaid"` are rendered as interactive Mermaid diagrams via a
 * React NodeView. All other code blocks behave exactly as normal.
 *
 * Usage in Editor.tsx:
 *   StarterKit.configure({ codeBlock: false }),
 *   MermaidBlock,
 */

import { mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import CodeBlock from "@tiptap/extension-code-block";
import type { CodeBlockOptions } from "@tiptap/extension-code-block";
import type { NodeViewRenderer, NodeViewRendererProps } from "@tiptap/core";
import type { NodeView } from "@tiptap/pm/view";
import MermaidNodeView from "@/components/MermaidNodeView";
import CodeBlockLanguageSelector from "@/components/CodeBlockLanguageSelector";

export const MermaidBlock = CodeBlock.extend<CodeBlockOptions>({
  // Keep the same node name so that existing documents and Markdown parsing
  // continue to work without any schema migration.
  name: "codeBlock",

  addNodeView(): NodeViewRenderer {
    const mermaidRenderer = ReactNodeViewRenderer(MermaidNodeView);
    const codeBlockRenderer = ReactNodeViewRenderer(CodeBlockLanguageSelector);

    return (props: NodeViewRendererProps): NodeView => {
      const { node } = props;

      if (node.attrs.language === "mermaid") {
        return mermaidRenderer(props);
      }

      // For all other languages use the CodeBlockLanguageSelector React
      // node view which renders a language dropdown above the code.
      return codeBlockRenderer(props);
    };
  },

  // Keep renderHTML in sync so that the HTML serialiser (copy/paste, SSR)
  // still emits the correct markup for all code blocks.
  renderHTML({ node, HTMLAttributes }) {
    const lang: string | null = node.attrs.language ?? null;
    const prefix =
      typeof this.options.languageClassPrefix === "string"
        ? this.options.languageClassPrefix
        : "language-";
    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      [
        "code",
        { class: lang && prefix ? prefix + lang : null },
        0,
      ],
    ];
  },
});
