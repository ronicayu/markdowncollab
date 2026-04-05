import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CommentSidebar from "../CommentSidebar";
import type { Comment } from "@/types";

const makeComment = (id: string, resolved: boolean): Comment => ({
  id,
  documentId: "doc1",
  authorName: "Alice",
  authorType: "human",
  content: `Comment ${id}`,
  startRelPos: new Uint8Array(),
  endRelPos: new Uint8Array(),
  parentCommentId: null,
  resolved,
  createdAt: new Date().toISOString(),
});

const defaultProps = {
  suggestions: [],
  comments: [makeComment("open1", false), makeComment("resolved1", true)],
  activeCommentIds: new Set(["open1"]),
  onAcceptSuggestion: vi.fn(),
  onRejectSuggestion: vi.fn(),
  onClickItem: vi.fn(),
  onAddComment: vi.fn(),
  onResolveComment: vi.fn(),
  onReplyToComment: vi.fn(),
  hasSelection: false,
  activeCommentId: null,
};

describe("CommentSidebar filter", () => {
  it("shows only open comments by default", () => {
    render(<CommentSidebar {...defaultProps} />);
    expect(screen.getByText("Comment open1")).toBeDefined();
    expect(screen.queryByText("Comment resolved1")).toBeNull();
  });

  it("shows only resolved comments when filter is Resolved", () => {
    render(<CommentSidebar {...defaultProps} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "resolved" } });
    expect(screen.queryByText("Comment open1")).toBeNull();
    expect(screen.getByText("Comment resolved1")).toBeDefined();
  });

  it("shows all comments when filter is All", () => {
    render(<CommentSidebar {...defaultProps} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });
    expect(screen.getByText("Comment open1")).toBeDefined();
    expect(screen.getByText("Comment resolved1")).toBeDefined();
  });

  it("hides + Comment button when filter is Resolved", () => {
    render(<CommentSidebar {...defaultProps} hasSelection={true} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "resolved" } });
    expect(screen.queryByText("+ Comment")).toBeNull();
  });

  it("shows + Comment button when filter is Open and text is selected", () => {
    render(<CommentSidebar {...defaultProps} hasSelection={true} />);
    expect(screen.getByText("+ Comment")).toBeDefined();
  });
});
