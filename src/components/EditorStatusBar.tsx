"use client";

import { useState } from "react";
import * as Y from "yjs";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { WebsocketProvider } from "y-websocket";
import type { HealthScore as HealthScoreType } from "@/lib/health-score";
import { addSuggestion } from "@/lib/suggestion-store";
import type { Suggestion } from "@/types";
import CursorChat from "./CursorChat";

interface EditorStatusBarProps {
  editor: TiptapEditor | null;
  documentId: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  userName: string;
  saveStatus: "idle" | "saving" | "saved";
  lastSyncTime: number | null;
  now: number;
  lastSavedByName: string | null;
  hasTextSelection: boolean;
  healthScore: HealthScoreType | null;
  wordCount: { words: number; chars: number };
  docSize: string;
  spellcheckEnabled: boolean;
  onSpellcheckChange: (v: boolean) => void;
  heatmapEnabled: boolean;
  onHeatmapChange: (v: boolean) => void;
  typewriterMode: boolean;
  onTypewriterChange: (v: boolean) => void;
  onIssueSettingsOpen: () => void;
  wordGoal: number | null;
  onWordGoalChange: (v: number | null) => void;
}

export default function EditorStatusBar({
  editor,
  documentId,
  ydoc,
  provider,
  userName,
  saveStatus,
  lastSyncTime,
  now,
  lastSavedByName,
  hasTextSelection,
  healthScore,
  wordCount,
  docSize,
  spellcheckEnabled,
  onSpellcheckChange,
  heatmapEnabled,
  onHeatmapChange,
  typewriterMode,
  onTypewriterChange,
  onIssueSettingsOpen,
  wordGoal,
  onWordGoalChange,
}: EditorStatusBarProps) {
  const [expandLoading, setExpandLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteMenuOpen, setRewriteMenuOpen] = useState(false);
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  /** Create a tracked suggestion with SuggestionMark in editor + Yjs store */
  function createTrackedSuggestion(
    from: number,
    to: number,
    originalText: string,
    suggestedText: string,
    rationale: string,
    mode: "replace" | "insert-after",
  ) {
    if (!editor) return;
    const yxml = ydoc.getXmlFragment("default");
    const suggestionId = crypto.randomUUID();
    const suggestion: Suggestion = {
      id: suggestionId,
      documentId,
      authorName: "AI Assistant",
      authorType: "agent",
      originalText,
      suggestedText,
      rationale,
      status: "pending",
      startRelPos: Y.encodeRelativePosition(
        Y.createRelativePositionFromTypeIndex(yxml, Math.max(0, from - 1)),
      ),
      endRelPos: Y.encodeRelativePosition(
        Y.createRelativePositionFromTypeIndex(yxml, Math.max(0, to - 1)),
      ),
      contentHash: Array.from(
        new Uint8Array(
          new TextEncoder().encode(originalText).buffer as ArrayBuffer,
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 16),
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    addSuggestion(ydoc, suggestion);

    // Build a single ProseMirror transaction to avoid position drift
    // between mark + insert operations during concurrent edits.
    const { tr, schema } = editor.state;
    const markTypeSchema = schema.marks.suggestionMark;

    if (mode === "replace") {
      // 1) Mark original text as "delete"
      tr.addMark(from, to, markTypeSchema.create({ suggestionId, type: "delete" }));
      // 2) Insert new text right after original, already marked as "add"
      if (suggestedText) {
        const addMark = markTypeSchema.create({ suggestionId, type: "add" });
        tr.insert(to, schema.text(suggestedText, [addMark]));
      }
    } else {
      // insert-after: no deletion mark, just insert new text with "add" mark
      if (suggestedText) {
        const addMark = markTypeSchema.create({ suggestionId, type: "add" });
        tr.insert(to, schema.text(suggestedText, [addMark]));
      }
    }

    editor.view.dispatch(tr);
    editor.commands.focus();
  }

  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalInputValue, setGoalInputValue] = useState("");

  return (
    <div className="sticky bottom-0 flex justify-between items-center px-4 py-1.5 text-xs text-gray-400 bg-[#FFFEF9]/80 backdrop-blur-sm border-t border-gray-100">
      <span>
        {saveStatus === "saving" ? (
          "Saving..."
        ) : lastSyncTime ? (
          (() => {
            const ago = Math.floor((now - lastSyncTime) / 1000);
            const byLine = lastSavedByName ? ` by ${lastSavedByName}` : "";
            if (ago < 10) return `Saved${byLine} just now`;
            if (ago < 60) return `Saved${byLine} ${ago}s ago`;
            if (ago < 3600) return `Saved${byLine} ${Math.floor(ago / 60)}m ago`;
            return `Saved${byLine} ${new Date(lastSyncTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
          })()
        ) : ""}
      </span>
      {/* Expand with AI */}
      {hasTextSelection && editor && (
        <button
          onClick={async () => {
            if (!editor || expandLoading) return;
            const { from, to } = editor.state.selection;
            const selectedText = editor.state.doc.textBetween(from, to, " ");
            if (!selectedText.trim()) return;
            setExpandLoading(true);
            try {
              const res = await fetch("/api/agent/expand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: selectedText }),
              });
              if (res.ok) {
                const { expanded } = await res.json();
                if (expanded) {
                  createTrackedSuggestion(from, to, selectedText, expanded, `Expand: ${selectedText.slice(0, 50)}...`, "insert-after");
                }
              }
            } catch (err) {
              console.error("Expand failed:", err);
            } finally {
              setExpandLoading(false);
            }
          }}
          disabled={expandLoading}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors"
          title="Expand selected text with AI"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
          {expandLoading ? "Expanding..." : "Expand with AI"}
        </button>
      )}
      {/* Summarize with AI */}
      {hasTextSelection && editor && (
        <div className="relative">
          <button
            onClick={async () => {
              if (!editor || summarizeLoading) return;
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to, " ");
              if (!selectedText.trim()) return;
              setSummarizeLoading(true);
              try {
                const res = await fetch("/api/agent/summarize-selection", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: selectedText }),
                });
                if (res.ok) {
                  const { summary } = await res.json();
                  if (summary) {
                    createTrackedSuggestion(from, to, selectedText, summary, `Summarize: ${selectedText.slice(0, 50)}...`, "replace");
                  }
                }
              } catch (err) {
                console.error("Summarize failed:", err);
              } finally {
                setSummarizeLoading(false);
              }
            }}
            disabled={summarizeLoading}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 disabled:opacity-50 transition-colors"
            title="Summarize selected text with AI"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
            </svg>
            {summarizeLoading ? "Summarizing..." : "Summarize"}
          </button>
        </div>
      )}
      {/* Rewrite with AI */}
      {hasTextSelection && editor && (
        <div className="relative">
          <button
            onClick={() => setRewriteMenuOpen((v) => !v)}
            disabled={rewriteLoading}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            title="Rewrite selected text with AI"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            {rewriteLoading ? "Rewriting..." : "Rewrite"}
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {rewriteMenuOpen && (
            <div className="absolute bottom-7 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 w-36">
              {[
                { style: "shorter", label: "Make shorter" },
                { style: "longer", label: "Make longer" },
                { style: "simpler", label: "Simplify" },
                { style: "formal", label: "Make formal" },
              ].map(({ style, label }) => (
                <button
                  key={style}
                  onClick={async () => {
                    setRewriteMenuOpen(false);
                    if (!editor || rewriteLoading) return;
                    const { from, to } = editor.state.selection;
                    const selectedText = editor.state.doc.textBetween(from, to, " ");
                    if (!selectedText.trim()) return;
                    setRewriteLoading(true);
                    try {
                      const res = await fetch("/api/agent/rewrite", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: selectedText, style }),
                      });
                      if (res.ok) {
                        const { rewritten } = await res.json();
                        if (rewritten) {
                          createTrackedSuggestion(from, to, selectedText, rewritten, `Rewrite (${style}): ${selectedText.slice(0, 50)}...`, "replace");
                        }
                      }
                    } catch (err) {
                      console.error("Rewrite failed:", err);
                    } finally {
                      setRewriteLoading(false);
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Cursor Chat */}
      <CursorChat provider={provider} userName={userName} />
      {/* Spellcheck Toggle */}
      <button
        onClick={() => {
          const next = !spellcheckEnabled;
          onSpellcheckChange(next);
          try { localStorage.setItem("spellcheckEnabled", String(next)); } catch {}
        }}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
          spellcheckEnabled
            ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        }`}
        title={spellcheckEnabled ? "Disable spellcheck" : "Enable spellcheck"}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Spellcheck
      </button>
      {/* Heatmap Toggle */}
      <button
        onClick={() => onHeatmapChange(!heatmapEnabled)}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
          heatmapEnabled
            ? "text-orange-600 bg-orange-50 hover:bg-orange-100"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        }`}
        title={heatmapEnabled ? "Hide edit heatmap" : "Show edit heatmap"}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        </svg>
        Heatmap
      </button>
      {/* Typewriter Mode Toggle */}
      <button
        onClick={() => {
          const next = !typewriterMode;
          onTypewriterChange(next);
          try { localStorage.setItem(`typewriterMode:${documentId}`, String(next)); } catch {}
        }}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
          typewriterMode
            ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        }`}
        title={typewriterMode ? "Disable typewriter mode" : "Enable typewriter mode"}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Typewriter
      </button>
      {/* Issue Tracker Settings */}
      <button
        onClick={onIssueSettingsOpen}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        title="Issue tracker link settings"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798" />
        </svg>
        Issues
      </button>
      {/* Health Score Badge */}
      {healthScore && (
        <div className="relative">
          <button
            onClick={() => setShowHealthDetails((v) => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
              healthScore.color === "green"
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : healthScore.color === "amber"
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-red-100 text-red-700 hover:bg-red-200"
            }`}
            title="Document Health Score — click for details"
          >
            <span>{healthScore.score}</span>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          {showHealthDetails && (
            <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 text-xs text-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">Health Score: {healthScore.score}/100</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowHealthDetails(false); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span>Readability (Flesch)</span>
                  <span className="font-medium">{healthScore.metrics.fleschReadingEase}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg sentence length</span>
                  <span className="font-medium">{healthScore.metrics.avgSentenceLength} words</span>
                </div>
                <div className="flex justify-between">
                  <span>Has headings</span>
                  <span className="font-medium">{healthScore.metrics.hasHeadings ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Has links</span>
                  <span className="font-medium">{healthScore.metrics.hasLinks ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Word count</span>
                  <span className="font-medium">{healthScore.metrics.wordCount} {healthScore.metrics.wordCountAppropriate ? "" : "(too short)"}</span>
                </div>
                {healthScore.metrics.templateCompleteness !== null && (
                  <div className="flex justify-between">
                    <span>Template completeness</span>
                    <span className="font-medium">{healthScore.metrics.templateCompleteness}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <span
        className="cursor-pointer hover:text-gray-600 transition-colors relative"
        onClick={() => {
          setGoalInputValue(wordGoal ? String(wordGoal) : "");
          setShowGoalInput(true);
        }}
        title="Click to set a word count goal"
      >
        {wordGoal ? (
          <span className="flex items-center gap-2">
            <span>{wordCount.words} / {wordGoal} words</span>
            <span className="inline-flex items-center w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <span
                className={`h-full rounded-full transition-all ${
                  wordCount.words >= wordGoal
                    ? "bg-green-500"
                    : wordCount.words >= wordGoal * 0.5
                    ? "bg-amber-400"
                    : "bg-gray-400"
                }`}
                style={{ width: `${Math.min(100, (wordCount.words / wordGoal) * 100)}%` }}
              />
            </span>
            <span className={`text-[10px] ${
              wordCount.words >= wordGoal
                ? "text-green-600"
                : wordCount.words >= wordGoal * 0.5
                ? "text-amber-500"
                : "text-gray-400"
            }`}>
              {Math.min(100, Math.round((wordCount.words / wordGoal) * 100))}%
            </span>
          </span>
        ) : (
          <span>{wordCount.words} words · {wordCount.chars} characters · {wordCount.words < 200 ? "< 1" : Math.ceil(wordCount.words / 200)} min read{docSize ? ` · ${docSize}` : ""}</span>
        )}
      </span>
      {showGoalInput && (
        <div className="absolute bottom-8 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
          <p className="text-xs font-medium text-gray-700 mb-2">Set word count goal</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="e.g. 500"
              value={goalInputValue}
              onChange={(e) => setGoalInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = parseInt(goalInputValue, 10);
                  if (val > 0) {
                    onWordGoalChange(val);
                    localStorage.setItem(`wordGoal:${documentId}`, String(val));
                  } else {
                    onWordGoalChange(null);
                    localStorage.removeItem(`wordGoal:${documentId}`);
                  }
                  setShowGoalInput(false);
                } else if (e.key === "Escape") {
                  setShowGoalInput(false);
                }
              }}
              className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
              autoFocus
            />
            <button
              onClick={() => {
                const val = parseInt(goalInputValue, 10);
                if (val > 0) {
                  onWordGoalChange(val);
                  localStorage.setItem(`wordGoal:${documentId}`, String(val));
                } else {
                  onWordGoalChange(null);
                  localStorage.removeItem(`wordGoal:${documentId}`);
                }
                setShowGoalInput(false);
              }}
              className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Set
            </button>
            {wordGoal && (
              <button
                onClick={() => {
                  onWordGoalChange(null);
                  localStorage.removeItem(`wordGoal:${documentId}`);
                  setShowGoalInput(false);
                }}
                className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
