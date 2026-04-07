import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import {
  addSuggestion,
  getSuggestions,
  updateSuggestionStatus,
  addComment,
  getComments,
  resolveComment,
  addReplyToComment,
} from "../suggestion-store";
import type { Suggestion, Comment, CommentReply } from "@/types";

function createTestDoc(): Y.Doc {
  return new Y.Doc();
}

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: "sug-1",
    documentId: "doc-1",
    authorName: "Alice",
    authorType: "human",
    originalText: "old text",
    suggestedText: "new text",
    rationale: "improves clarity",
    status: "pending",
    startRelPos: new Uint8Array([1, 2, 3]),
    endRelPos: new Uint8Array([4, 5, 6]),
    contentHash: "abc123",
    createdAt: "2026-04-06T10:00:00Z",
    resolvedAt: null,
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "comment-1",
    documentId: "doc-1",
    authorName: "Bob",
    authorType: "human",
    content: "This needs work",
    startRelPos: new Uint8Array([10, 20]),
    endRelPos: new Uint8Array([30, 40]),
    parentCommentId: null,
    resolved: false,
    createdAt: "2026-04-06T10:00:00Z",
    replies: [],
    ...overrides,
  };
}

describe("suggestion-store: suggestions", () => {
  let ydoc: Y.Doc;

  beforeEach(() => {
    ydoc = createTestDoc();
  });

  it("adds and retrieves a suggestion", () => {
    const sug = makeSuggestion();
    addSuggestion(ydoc, sug);
    const results = getSuggestions(ydoc);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("sug-1");
    expect(results[0].originalText).toBe("old text");
    expect(results[0].suggestedText).toBe("new text");
    expect(results[0].status).toBe("pending");
  });

  it("preserves RelativePosition through serialization roundtrip", () => {
    const sug = makeSuggestion({
      startRelPos: new Uint8Array([10, 20, 30]),
      endRelPos: new Uint8Array([40, 50, 60]),
    });
    addSuggestion(ydoc, sug);
    const results = getSuggestions(ydoc);
    expect(Array.from(results[0].startRelPos)).toEqual([10, 20, 30]);
    expect(Array.from(results[0].endRelPos)).toEqual([40, 50, 60]);
  });

  it("adds multiple suggestions", () => {
    addSuggestion(ydoc, makeSuggestion({ id: "sug-1" }));
    addSuggestion(ydoc, makeSuggestion({ id: "sug-2", originalText: "other" }));
    const results = getSuggestions(ydoc);
    expect(results).toHaveLength(2);
  });

  it("updates suggestion status to accepted", () => {
    addSuggestion(ydoc, makeSuggestion());
    updateSuggestionStatus(ydoc, "sug-1", "accepted");
    const results = getSuggestions(ydoc);
    expect(results[0].status).toBe("accepted");
    expect(results[0].resolvedAt).toBeTruthy();
  });

  it("updates suggestion status to rejected", () => {
    addSuggestion(ydoc, makeSuggestion());
    updateSuggestionStatus(ydoc, "sug-1", "rejected");
    const results = getSuggestions(ydoc);
    expect(results[0].status).toBe("rejected");
    expect(results[0].resolvedAt).toBeTruthy();
  });

  it("does nothing when updating non-existent suggestion", () => {
    addSuggestion(ydoc, makeSuggestion());
    updateSuggestionStatus(ydoc, "non-existent", "accepted");
    const results = getSuggestions(ydoc);
    expect(results[0].status).toBe("pending");
  });

  it("returns empty array when no suggestions", () => {
    expect(getSuggestions(ydoc)).toEqual([]);
  });
});

describe("suggestion-store: comments", () => {
  let ydoc: Y.Doc;

  beforeEach(() => {
    ydoc = createTestDoc();
  });

  it("adds and retrieves a comment", () => {
    const comment = makeComment();
    addComment(ydoc, comment);
    const results = getComments(ydoc);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("comment-1");
    expect(results[0].content).toBe("This needs work");
    expect(results[0].resolved).toBe(false);
  });

  it("preserves RelativePosition through serialization roundtrip", () => {
    const comment = makeComment({
      startRelPos: new Uint8Array([100, 200]),
      endRelPos: new Uint8Array([150, 250]),
    });
    addComment(ydoc, comment);
    const results = getComments(ydoc);
    expect(Array.from(results[0].startRelPos)).toEqual([100, 200]);
    expect(Array.from(results[0].endRelPos)).toEqual([150, 250]);
  });

  it("resolves a comment", () => {
    addComment(ydoc, makeComment());
    resolveComment(ydoc, "comment-1");
    const results = getComments(ydoc);
    expect(results[0].resolved).toBe(true);
  });

  it("does nothing when resolving non-existent comment", () => {
    addComment(ydoc, makeComment());
    resolveComment(ydoc, "non-existent");
    const results = getComments(ydoc);
    expect(results[0].resolved).toBe(false);
  });

  it("adds a reply to a comment", () => {
    addComment(ydoc, makeComment());
    const reply: CommentReply = {
      id: "reply-1",
      text: "Good point",
      author: "Carol",
      createdAt: "2026-04-06T11:00:00Z",
    };
    addReplyToComment(ydoc, "comment-1", reply);
    const results = getComments(ydoc);
    expect(results[0].replies).toHaveLength(1);
    expect(results[0].replies![0].text).toBe("Good point");
    expect(results[0].replies![0].author).toBe("Carol");
  });

  it("adds multiple replies to a comment", () => {
    addComment(ydoc, makeComment());
    addReplyToComment(ydoc, "comment-1", {
      id: "reply-1",
      text: "First reply",
      author: "Carol",
      createdAt: "2026-04-06T11:00:00Z",
    });
    addReplyToComment(ydoc, "comment-1", {
      id: "reply-2",
      text: "Second reply",
      author: "Dave",
      createdAt: "2026-04-06T12:00:00Z",
    });
    const results = getComments(ydoc);
    expect(results[0].replies).toHaveLength(2);
  });

  it("does nothing when adding reply to non-existent comment", () => {
    addComment(ydoc, makeComment());
    addReplyToComment(ydoc, "non-existent", {
      id: "reply-1",
      text: "orphan reply",
      author: "Carol",
      createdAt: "2026-04-06T11:00:00Z",
    });
    const results = getComments(ydoc);
    expect(results[0].replies).toEqual([]);
  });

  it("returns empty array when no comments", () => {
    expect(getComments(ydoc)).toEqual([]);
  });
});
