"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/core";

interface HistoryEntry {
  id: number;
  description: string;
  timestamp: number;
  transactionIndex: number;
}

function describeTransaction(tr: import("@tiptap/pm/state").Transaction): string | null {
  // Skip selection-only transactions
  if (!tr.docChanged) return null;

  // Check steps for clues about what changed
  for (const step of tr.steps) {
    const stepJson = step.toJSON();
    const stepType = stepJson.stepType;

    if (stepType === "replaceAround") {
      // Likely a block-level change (heading, list toggle)
      return "Block formatting changed";
    }
  }

  // Check what marks are on the content being inserted
  const meta = tr.getMeta("history$");
  if (meta) {
    return null; // Undo/redo transaction
  }

  // Check for added marks
  for (const step of tr.steps) {
    const stepJson = step.toJSON();
    if (stepJson.stepType === "addMark") {
      const markType = stepJson.mark?.type;
      if (markType === "bold") return "Bold applied";
      if (markType === "italic") return "Italic applied";
      if (markType === "strike") return "Strikethrough applied";
      if (markType === "code") return "Code formatting applied";
      if (markType === "link") return "Link added";
      if (markType === "highlight") return "Highlight applied";
      if (markType === "underline") return "Underline applied";
      return `${markType} mark applied`;
    }
    if (stepJson.stepType === "removeMark") {
      return "Formatting removed";
    }
  }

  // Detect heading creation
  if (tr.steps.length > 0) {
    const newDoc = tr.doc;
    const oldDoc = tr.before;
    // Check if a heading node was created
    let hasNewHeading = false;
    newDoc.descendants((node) => {
      if (node.type.name === "heading") hasNewHeading = true;
    });
    let hadHeading = false;
    oldDoc.descendants((node) => {
      if (node.type.name === "heading") hadHeading = true;
    });
    if (hasNewHeading && !hadHeading) return "Heading created";
  }

  // Check for content size changes
  const sizeDiff = tr.doc.content.size - tr.before.content.size;
  if (sizeDiff > 20) return "Content block inserted";
  if (sizeDiff < -20) return "Content deleted";
  if (sizeDiff > 0) return "Text inserted";
  if (sizeDiff < 0) return "Text deleted";

  return "Content edited";
}

interface SessionHistoryProps {
  editor: Editor | null;
}

export default function SessionHistory({ editor }: SessionHistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [collapsed, setCollapsed] = useState(true);
  const entryIdRef = useRef(0);
  const transactionCountRef = useRef(0);

  const addEntry = useCallback((description: string) => {
    entryIdRef.current++;
    transactionCountRef.current++;
    setEntries((prev) => {
      const newEntry: HistoryEntry = {
        id: entryIdRef.current,
        description,
        timestamp: Date.now(),
        transactionIndex: transactionCountRef.current,
      };
      const updated = [newEntry, ...prev];
      // Keep only last 10
      return updated.slice(0, 10);
    });
  }, []);

  useEffect(() => {
    if (!editor) return;

    const handler = ({ transaction }: { transaction: import("@tiptap/pm/state").Transaction }) => {
      const desc = describeTransaction(transaction);
      if (desc) addEntry(desc);
    };

    editor.on("transaction", handler);
    return () => {
      editor.off("transaction", handler);
    };
  }, [editor, addEntry]);

  const undoToEntry = useCallback(
    (entry: HistoryEntry) => {
      if (!editor) return;
      // Calculate how many undos we need
      const currentIndex = transactionCountRef.current;
      const targetIndex = entry.transactionIndex;
      const undoCount = currentIndex - targetIndex + 1;

      for (let i = 0; i < Math.min(undoCount, 50); i++) {
        const canUndo = editor.can().undo();
        if (!canUndo) break;
        editor.commands.undo();
      }
    },
    [editor],
  );

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        title="Session history"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        History
        {entries.length > 0 && (
          <span className="bg-gray-200 text-gray-500 rounded-full px-1 min-w-[14px] text-center">{entries.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setCollapsed(true)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
        title="Hide session history"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        History
      </button>

      <div className="absolute bottom-7 right-0 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-700">Session History</p>
          <button
            onClick={() => setCollapsed(true)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-52 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No actions yet</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-700 truncate">{entry.description}</p>
                  <p className="text-[10px] text-gray-400">{formatTime(entry.timestamp)}</p>
                </div>
                <button
                  onClick={() => undoToEntry(entry)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-[10px] text-amber-600 hover:text-amber-700 font-medium px-2 py-0.5 rounded hover:bg-amber-50 transition-all"
                  title="Undo to this point"
                >
                  Undo to here
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
