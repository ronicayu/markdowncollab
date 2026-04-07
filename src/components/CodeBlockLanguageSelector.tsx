"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

const LANGUAGES = [
  { value: "", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "bash", label: "Bash" },
  { value: "markdown", label: "Markdown" },
  { value: "mermaid", label: "Mermaid" },
];

export default function CodeBlockLanguageSelector({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const language: string = node.attrs.language ?? "";

  return (
    <NodeViewWrapper
      className="code-block-wrapper relative my-3 rounded-md border border-gray-200 bg-[#f8f9fa] overflow-hidden"
    >
      {/* Language selector bar */}
      <div
        contentEditable={false}
        className="flex items-center justify-between px-3 py-1.5 bg-gray-100 border-b border-gray-200"
      >
        <select
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className="text-xs bg-transparent border border-gray-300 rounded px-1.5 py-0.5 text-gray-600 hover:border-gray-400 focus:outline-none focus:border-[#B8692A] cursor-pointer"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Code content */}
      <NodeViewContent<"pre">
        as={"pre" as "pre"}
        className={`block w-full whitespace-pre-wrap p-3 font-mono text-sm text-gray-800 focus:outline-none ${
          selected ? "ring-2 ring-[#B8692A]/30 ring-inset" : ""
        }`}
      />
    </NodeViewWrapper>
  );
}
