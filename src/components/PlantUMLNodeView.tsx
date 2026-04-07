"use client";

import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

/**
 * Encode PlantUML source and return the server URL for the rendered SVG.
 * Falls back to null if encoding fails.
 */
function getPlantUMLUrl(source: string): string | null {
  try {
    // plantuml-encoder is a lightweight synchronous encoder
    const plantumlEncoder = require("plantuml-encoder");
    const encoded = plantumlEncoder.encode(source);
    return `https://www.plantuml.com/plantuml/svg/${encoded}`;
  } catch {
    return null;
  }
}

export default function PlantUMLNodeView({ node, selected }: NodeViewProps) {
  const code = node.textContent ?? "";

  const [isEditing, setIsEditing] = useState(false);
  const [imgError, setImgError] = useState(false);

  const prevSelectedRef = useRef(selected);
  useEffect(() => {
    const wasSelected = prevSelectedRef.current;
    prevSelectedRef.current = selected;
    if (wasSelected && !selected && isEditing) {
      setIsEditing(false);
    }
  }, [selected, isEditing]);

  // Reset error state when code changes
  useEffect(() => {
    setImgError(false);
  }, [code]);

  const trimmed = code.trim();
  const url = trimmed ? getPlantUMLUrl(trimmed) : null;

  return (
    <NodeViewWrapper
      className="plantuml-block relative my-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
      data-language="plantuml"
    >
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
          {url && !imgError ? (
            <img
              src={url}
              alt="PlantUML diagram"
              className="max-w-full"
              onError={() => setImgError(true)}
            />
          ) : imgError ? (
            <div className="w-full rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <span className="font-semibold">PlantUML error: </span>
              Failed to render diagram. Check your syntax.
              {trimmed && (
                <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                  {trimmed}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">
              Empty diagram — add PlantUML code below.
            </div>
          )}
        </div>
      )}

      {/* Source editor */}
      <div
        className={`transition-all duration-150 ${
          isEditing ? "mt-3 block" : "hidden"
        }`}
      >
        <NodeViewContent<"pre">
          as={"pre" as "pre"}
          className="block w-full whitespace-pre-wrap rounded border border-gray-300 bg-white p-3 font-mono text-sm text-gray-800 focus:outline-none"
        />
      </div>
    </NodeViewWrapper>
  );
}
