"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

let mermaidInitialized = false;
let mermaidInitializing = false;
let mermaidInitCallbacks: Array<() => void> = [];

/**
 * Lazily initializes mermaid exactly once on the client side.
 * Calls `onReady` when initialization is complete (or immediately if already done).
 */
function ensureMermaidInitialized(onReady: () => void): void {
  if (mermaidInitialized) {
    onReady();
    return;
  }
  mermaidInitCallbacks.push(onReady);
  if (mermaidInitializing) return;
  mermaidInitializing = true;
  import("mermaid").then((m) => {
    m.default.initialize({ startOnLoad: false, theme: "neutral" });
    mermaidInitialized = true;
    const cbs = mermaidInitCallbacks;
    mermaidInitCallbacks = [];
    cbs.forEach((cb) => cb());
  });
}

/** Monotonically increasing counter for unique mermaid render element IDs. */
let idCounter = 0;

/** Remove any lingering temporary Mermaid render containers from the document. */
function cleanupMermaidContainers(renderId: string) {
  const el = document.getElementById(renderId);
  if (el) el.remove();
  // Also clean up the parent container Mermaid sometimes creates
  const parent = document.getElementById(`d${renderId}`);
  if (parent) parent.remove();
}

export default function MermaidNodeView({ node, selected }: NodeViewProps) {
  const code = node.textContent ?? "";

  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Stable reference to the current code so the async render callback doesn't
  // close over a stale value when the component re-renders mid-flight.
  const codeRef = useRef(code);
  codeRef.current = code;

  // A generation counter lets us discard results from superseded renders.
  const genRef = useRef(0);
  // Debounce timer ref — we delay rendering by 300ms while the user types.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderDiagram = useCallback(() => {
    const gen = ++genRef.current;

    ensureMermaidInitialized(async () => {
      const currentCode = codeRef.current.trim();
      if (!currentCode) {
        if (gen === genRef.current) {
          setSvg(null);
          setError(null);
        }
        return;
      }

      const renderId = `mermaid-render-${++idCounter}`;
      try {
        const mermaid = (await import("mermaid")).default;
        // Each render needs a globally unique DOM ID.
        const result = await mermaid.render(renderId, currentCode);
        if (gen === genRef.current) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (err: unknown) {
        if (gen === genRef.current) {
          setSvg(null);
          // Show a short, user-friendly error. The raw Mermaid error often
          // includes the full source text which makes the message very long.
          const raw = err instanceof Error ? err.message : "";
          const message = raw.startsWith("No diagram type detected")
            ? "No diagram type detected — check your syntax and make sure the first line is a valid diagram type (e.g. graph TD, sequenceDiagram)."
            : raw
            ? raw.split("\n")[0].substring(0, 120)
            : "Invalid Mermaid syntax";
          setError(message);
        }
      } finally {
        // Always clean up the temporary render container Mermaid appends to
        // the document. Without this, each failed render leaves behind a ghost
        // element with duplicate error content visible on the page.
        cleanupMermaidContainers(renderId);
      }
    });
  }, []);

  // Re-render whenever the diagram source changes, debounced to avoid firing
  // on every keystroke while the user is actively editing the source.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      renderDiagram();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code, renderDiagram]);

  // When the node is deselected while editing, close the editor panel.
  // We only close when `selected` transitions from true → false (the user
  // clicked away). We must NOT close just because `selected` starts as false
  // — that would immediately undo any toggle triggered while the node is
  // not ProseMirror-selected (which is the normal state during mousedown
  // with preventDefault).
  const prevSelectedRef = useRef(selected);
  useEffect(() => {
    const wasSelected = prevSelectedRef.current;
    prevSelectedRef.current = selected;
    if (wasSelected && !selected && isEditing) {
      setIsEditing(false);
    }
  }, [selected, isEditing]);

  return (
    <NodeViewWrapper
      className="mermaid-block relative my-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
      data-language="mermaid"
    >
      {/* Top-right toggle.
          We use onMouseDown + preventDefault/stopPropagation so that ProseMirror
          never sees the pointer event and cannot trigger a node-selection transaction
          that would cause the React node view to re-render and reset isEditing state. */}
      <button
        contentEditable={false}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsEditing((prev) => !prev);
        }}
        className="absolute right-3 top-2.5 select-none rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
      >
        {isEditing ? "Hide source" : "Edit source"}
      </button>

      {/* Rendered diagram */}
      {!isEditing && (
        <div className="flex justify-center">
          {svg ? (
            <div
              className="max-w-full overflow-x-auto"
              // mermaid returns trusted SVG — it is generated locally from the
              // user's own input, never from a network source.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : error ? (
            <div className="w-full rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <span className="font-semibold">Mermaid error: </span>
              {error}
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">
              {code.trim() ? "Rendering diagram…" : "Empty diagram — add code below."}
            </div>
          )}
        </div>
      )}

      {/* Source editor (NodeViewContent is the live ProseMirror content node) */}
      <div
        className={`transition-all duration-150 ${
          isEditing ? "mt-3 block" : "hidden"
        }`}
      >
        {/* NodeViewContent renders the editable ProseMirror content node.
            The generic <T> lets us use a semantic element while keeping TypeScript happy. */}
        <NodeViewContent<"pre">
          as={"pre" as "pre"}
          className="block w-full whitespace-pre-wrap rounded border border-gray-300 bg-white p-3 font-mono text-sm text-gray-800 focus:outline-none"
        />
      </div>
    </NodeViewWrapper>
  );
}
