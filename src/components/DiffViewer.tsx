"use client";

import { useMemo } from "react";
import * as Diff from "diff";

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

export default function DiffViewer({
  oldText,
  newText,
  oldLabel = "Previous version",
  newLabel = "Current document",
}: DiffViewerProps) {
  const lines = useMemo(() => {
    const changes = Diff.diffLines(oldText, newText);
    const result: DiffLine[] = [];
    let oldLine = 1;
    let newLine = 1;

    for (const change of changes) {
      const changeLines = change.value.replace(/\n$/, "").split("\n");

      for (const line of changeLines) {
        if (change.added) {
          result.push({
            type: "added",
            content: line,
            oldLineNum: null,
            newLineNum: newLine++,
          });
        } else if (change.removed) {
          result.push({
            type: "removed",
            content: line,
            oldLineNum: oldLine++,
            newLineNum: null,
          });
        } else {
          result.push({
            type: "unchanged",
            content: line,
            oldLineNum: oldLine++,
            newLineNum: newLine++,
          });
        }
      }
    }

    return result;
  }, [oldText, newText]);

  const addedCount = lines.filter((l) => l.type === "added").length;
  const removedCount = lines.filter((l) => l.type === "removed").length;

  return (
    <div className="diff-viewer">
      {/* Header with stats */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,0,0,0.1)] bg-[#f6f5f4] rounded-t-lg">
        <div className="flex items-center gap-4 text-xs">
          <span className="font-medium text-[#615d59]">{oldLabel}</span>
          <span className="text-[#a39e98]">vs</span>
          <span className="font-medium text-[#615d59]">{newLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {addedCount > 0 && (
            <span className="text-green-700 font-medium">+{addedCount}</span>
          )}
          {removedCount > 0 && (
            <span className="text-red-700 font-medium">-{removedCount}</span>
          )}
          {addedCount === 0 && removedCount === 0 && (
            <span className="text-[#615d59]">No changes</span>
          )}
        </div>
      </div>

      {/* Diff lines */}
      <div className="max-h-[60vh] overflow-y-auto">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`diff-viewer-row ${
              line.type === "added"
                ? "diff-added"
                : line.type === "removed"
                ? "diff-removed"
                : "diff-unchanged"
            }`}
          >
            <span className="diff-line-number">
              {line.oldLineNum ?? ""}
            </span>
            <span className="diff-line-number">
              {line.newLineNum ?? ""}
            </span>
            <span className="diff-line-content">
              {line.type === "added" && "+ "}
              {line.type === "removed" && "- "}
              {line.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
