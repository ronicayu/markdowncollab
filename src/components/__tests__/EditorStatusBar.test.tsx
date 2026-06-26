import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import EditorStatusBar from "../EditorStatusBar";
import { getSuggestions } from "@/lib/suggestion-store";

// Mock addSuggestion to spy on calls without needing full Yjs wiring in DOM
const mockAddSuggestion = vi.fn();
vi.mock("@/lib/suggestion-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/suggestion-store")>();
  return {
    ...actual,
    addSuggestion: (...args: unknown[]) => mockAddSuggestion(...args),
  };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Minimal mock editor that records chain calls
function createMockEditor() {
  const chainFns: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainProxy: Record<string, unknown> = {};

  const methods = [
    "focus", "setTextSelection", "setSuggestionMark",
    "insertContentAt", "unsetSuggestionMark", "deleteRange",
    "insertContent", "run",
  ];
  for (const m of methods) {
    chainFns[m] = vi.fn(() => chainProxy);
    chainProxy[m] = chainFns[m];
  }

  const editor = {
    state: {
      selection: { from: 5, to: 10 },
      doc: {
        textBetween: vi.fn(() => "world"),
      },
    },
    chain: vi.fn(() => chainProxy),
    schema: {
      marks: {
        suggestionMark: { name: "suggestionMark" },
      },
    },
    _chainFns: chainFns,
  };
  return editor;
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  const ydoc = new Y.Doc();
  const editor = createMockEditor();
  return {
    editor: editor as unknown as Parameters<typeof EditorStatusBar>[0]["editor"],
    documentId: "doc-1",
    ydoc,
    saveStatus: "saved" as const,
    lastSyncTime: Date.now(),
    now: Date.now(),
    lastSavedByName: "TestUser",
    hasTextSelection: true,
    wordCount: { words: 100, chars: 500 },
    docSize: "2 KB",
    spellcheckEnabled: false,
    onSpellcheckChange: vi.fn(),
    typewriterMode: false,
    onTypewriterChange: vi.fn(),
    wordGoal: null,
    onWordGoalChange: vi.fn(),
    _mockEditor: editor,
    ...overrides,
  };
}

describe("EditorStatusBar AI actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("Expand with AI", () => {
    it("renders Expand button when text is selected", () => {
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);
      expect(screen.getByTitle("Expand selected text with AI")).toBeDefined();
    });

    it("does not render Expand button when no selection", () => {
      const props = defaultProps({ hasTextSelection: false });
      render(<EditorStatusBar {...props} />);
      expect(screen.queryByTitle("Expand selected text with AI")).toBeNull();
    });

    it("calls fetch and creates tracked suggestion on success", async () => {
      const expandedText = "wonderful world of possibilities";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ expanded: expandedText }),
      });
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);

      fireEvent.click(screen.getByTitle("Expand selected text with AI"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/agent/expand", expect.objectContaining({
          method: "POST",
        }));
      });

      await waitFor(() => {
        expect(mockAddSuggestion).toHaveBeenCalledTimes(1);
      });

      const [, suggestion] = mockAddSuggestion.mock.calls[0];
      expect(suggestion.authorType).toBe("agent");
      expect(suggestion.authorName).toBe("AI Assistant");
      expect(suggestion.suggestedText).toBe(expandedText);
      expect(suggestion.originalText).toBe("world");
      expect(suggestion.status).toBe("pending");
      expect(suggestion.rationale).toContain("Expand");
    });

    it("does not create suggestion when fetch fails", { timeout: 15000 }, async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);

      fireEvent.click(screen.getByTitle("Expand selected text with AI"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Give time for any async aftermath
      await new Promise((r) => setTimeout(r, 100));
      expect(mockAddSuggestion).not.toHaveBeenCalled();
    });

    it("does not create suggestion when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const props = defaultProps();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<EditorStatusBar {...props} />);

      fireEvent.click(screen.getByTitle("Expand selected text with AI"));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });
      expect(mockAddSuggestion).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Summarize with AI", () => {
    it("renders Summarize button when text is selected", () => {
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);
      expect(screen.getByTitle("Summarize selected text with AI")).toBeDefined();
    });

    it("calls fetch and creates replace-mode tracked suggestion", { timeout: 15000 }, async () => {
      const summaryText = "short version";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: summaryText }),
      });
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);

      fireEvent.click(screen.getByTitle("Summarize selected text with AI"));

      await waitFor(() => {
        expect(mockAddSuggestion).toHaveBeenCalledTimes(1);
      });

      const [, suggestion] = mockAddSuggestion.mock.calls[0];
      expect(suggestion.suggestedText).toBe(summaryText);
      expect(suggestion.rationale).toContain("Summarize");
    });

    it("no longer shows summary popover (uses tracked suggestion)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: "short" }),
      });
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);

      fireEvent.click(screen.getByTitle("Summarize selected text with AI"));

      await waitFor(() => {
        expect(mockAddSuggestion).toHaveBeenCalled();
      });

      // Old popover buttons should not exist
      expect(screen.queryByText("Replace")).toBeNull();
      expect(screen.queryByText("Insert below")).toBeNull();
      expect(screen.queryByText("Dismiss")).toBeNull();
    });
  });

  describe("Rewrite with AI", () => {
    it("renders Rewrite button when text is selected", () => {
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);
      expect(screen.getByTitle("Rewrite selected text with AI")).toBeDefined();
    });

    it("opens style menu on click", () => {
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);
      fireEvent.click(screen.getByTitle("Rewrite selected text with AI"));
      expect(screen.getByText("Make shorter")).toBeDefined();
      expect(screen.getByText("Make longer")).toBeDefined();
      expect(screen.getByText("Simplify")).toBeDefined();
      expect(screen.getByText("Make formal")).toBeDefined();
    });

    it("calls fetch with style and creates replace-mode tracked suggestion", async () => {
      const rewrittenText = "concise version";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rewritten: rewrittenText }),
      });
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);

      // Open menu
      fireEvent.click(screen.getByTitle("Rewrite selected text with AI"));
      // Click "Make shorter"
      fireEvent.click(screen.getByText("Make shorter"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/agent/rewrite", expect.objectContaining({
          method: "POST",
        }));
      });

      // Verify style was sent
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.style).toBe("shorter");

      await waitFor(() => {
        expect(mockAddSuggestion).toHaveBeenCalledTimes(1);
      });

      const [, suggestion] = mockAddSuggestion.mock.calls[0];
      expect(suggestion.suggestedText).toBe(rewrittenText);
      expect(suggestion.rationale).toContain("Rewrite (shorter)");
    });

    it("no longer shows old preview accept/reject inline", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rewritten: "new text" }),
      });
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);

      fireEvent.click(screen.getByTitle("Rewrite selected text with AI"));
      fireEvent.click(screen.getByText("Simplify"));

      await waitFor(() => {
        expect(mockAddSuggestion).toHaveBeenCalled();
      });

      // Old inline preview should not exist
      expect(screen.queryByText(/^Preview:/)).toBeNull();
    });
  });

  describe("Suggestion data integrity", () => {
    it("suggestion has valid UUID format id", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ expanded: "more text" }),
      });
      // Mock crypto.randomUUID
      const originalRandomUUID = crypto.randomUUID;
      crypto.randomUUID = vi.fn(() => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee") as typeof crypto.randomUUID;

      const props = defaultProps();
      render(<EditorStatusBar {...props} />);
      fireEvent.click(screen.getByTitle("Expand selected text with AI"));

      await waitFor(() => {
        expect(mockAddSuggestion).toHaveBeenCalled();
      });

      const [, suggestion] = mockAddSuggestion.mock.calls[0];
      expect(suggestion.id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
      expect(suggestion.documentId).toBe("doc-1");

      crypto.randomUUID = originalRandomUUID;
    });

    it("suggestion has contentHash derived from original text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ expanded: "more" }),
      });
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);
      fireEvent.click(screen.getByTitle("Expand selected text with AI"));

      await waitFor(() => {
        expect(mockAddSuggestion).toHaveBeenCalled();
      });

      const [, suggestion] = mockAddSuggestion.mock.calls[0];
      expect(suggestion.contentHash).toBeTruthy();
      expect(typeof suggestion.contentHash).toBe("string");
      // Hash is hex-encoded slice of original text bytes, truncated to 16 chars
      // "world" = 5 bytes = 10 hex chars (less than 16, so full length)
      expect(suggestion.contentHash.length).toBeLessThanOrEqual(16);
      expect(suggestion.contentHash.length).toBeGreaterThan(0);
      expect(suggestion.contentHash).toMatch(/^[0-9a-f]+$/);
    });

    it("suggestion has ISO timestamp", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ expanded: "more" }),
      });
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);
      fireEvent.click(screen.getByTitle("Expand selected text with AI"));

      await waitFor(() => {
        expect(mockAddSuggestion).toHaveBeenCalled();
      });

      const [, suggestion] = mockAddSuggestion.mock.calls[0];
      expect(suggestion.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(suggestion.resolvedAt).toBeNull();
    });

    it("suggestion has Yjs relative positions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ expanded: "more" }),
      });
      const props = defaultProps();
      render(<EditorStatusBar {...props} />);
      fireEvent.click(screen.getByTitle("Expand selected text with AI"));

      await waitFor(() => {
        expect(mockAddSuggestion).toHaveBeenCalled();
      });

      const [, suggestion] = mockAddSuggestion.mock.calls[0];
      expect(suggestion.startRelPos).toBeInstanceOf(Uint8Array);
      expect(suggestion.endRelPos).toBeInstanceOf(Uint8Array);
      expect(suggestion.startRelPos.length).toBeGreaterThan(0);
    });
  });
});
