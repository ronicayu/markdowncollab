"use client";

import { useState } from "react";
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

const RUNNABLE_LANGUAGES = new Set(["javascript"]);

export default function CodeBlockLanguageSelector({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const language: string = node.attrs.language ?? "";
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const isRunnable = RUNNABLE_LANGUAGES.has(language);

  function handleRun() {
    if (!isRunnable) {
      setOutput(`Execution not supported for ${language || "plain text"}`);
      return;
    }

    setRunning(true);
    setOutput(null);

    const code = node.textContent;
    const logs: string[] = [];

    try {
      // Capture console.log output
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;
      console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
      console.warn = (...args: unknown[]) => logs.push(`[warn] ${args.map(String).join(" ")}`);
      console.error = (...args: unknown[]) => logs.push(`[error] ${args.map(String).join(" ")}`);

      try {
        // eslint-disable-next-line no-new-func
        const result = new Function(code)();
        if (result !== undefined) {
          logs.push(String(result));
        }
      } catch (err: unknown) {
        logs.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
      }

      setOutput(logs.length > 0 ? logs.join("\n") : "(no output)");
    } finally {
      setRunning(false);
    }
  }

  return (
    <NodeViewWrapper
      className="code-block-wrapper relative my-3 rounded-md border border-[rgba(0,0,0,0.1)] bg-[#f8f9fa] overflow-hidden"
    >
      {/* Language selector bar */}
      <div
        contentEditable={false}
        className="flex items-center justify-between px-3 py-1.5 bg-[#f6f5f4] border-b border-[rgba(0,0,0,0.1)]"
      >
        <select
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className="text-xs bg-transparent border border-[#dddddd] rounded px-1.5 py-0.5 text-[#615d59] hover:border-[#a39e98] focus:outline-none focus:border-[#0075de] cursor-pointer"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>

        {/* Run button for JavaScript */}
        {language && (
          <button
            onClick={handleRun}
            disabled={running}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${
              isRunnable
                ? "text-green-700 bg-green-50 hover:bg-green-100 border border-green-200"
                : "text-[#a39e98] bg-[#f6f5f4] border border-[rgba(0,0,0,0.1)] cursor-not-allowed"
            }`}
            title={isRunnable ? "Run code in browser" : `Execution not supported for ${language}`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
            {running ? "Running..." : "Run"}
          </button>
        )}
      </div>

      {/* Code content */}
      <NodeViewContent<"pre">
        as={"pre" as "pre"}
        className={`block w-full whitespace-pre-wrap p-3 font-mono text-sm text-[#31302e] focus:outline-none ${
          selected ? "ring-2 ring-[#0075de]/30 ring-inset" : ""
        }`}
      />

      {/* Output section */}
      {output !== null && (
        <div contentEditable={false} className="border-t border-[rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between px-3 py-1 bg-[#f6f5f4]">
            <span className="text-[10px] font-medium text-[#615d59] uppercase tracking-wide">Output</span>
            <button
              onClick={() => setOutput(null)}
              className="text-[10px] text-[#a39e98] hover:text-[#615d59]"
            >
              Clear
            </button>
          </div>
          <pre className="px-3 py-2 text-xs font-mono text-[#31302e] whitespace-pre-wrap bg-[#f6f5f4]/50 max-h-40 overflow-y-auto">
            {output}
          </pre>
        </div>
      )}
    </NodeViewWrapper>
  );
}
