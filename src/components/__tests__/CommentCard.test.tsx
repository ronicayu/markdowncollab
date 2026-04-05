import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CommentCard from "../CommentCard";
import type { Comment } from "@/types";

const base: Comment = {
  id: "abc",
  documentId: "doc1",
  authorName: "Alice",
  authorType: "human",
  content: "This needs work",
  startRelPos: new Uint8Array(),
  endRelPos: new Uint8Array(),
  parentCommentId: null,
  resolved: false,
  createdAt: new Date().toISOString(),
};

describe("CommentCard", () => {
  it("shows Resolve button when comment is open", () => {
    render(
      <CommentCard
        comment={base}
        onClick={vi.fn()}
        onResolve={vi.fn()}
        onReply={vi.fn()}
        isActive={false}
        isContentDeleted={false}
      />
    );
    expect(screen.getByRole("button", { name: /resolve/i })).toBeDefined();
  });

  it("shows content-deleted badge and Resolve button when isContentDeleted", () => {
    render(
      <CommentCard
        comment={base}
        onClick={vi.fn()}
        onResolve={vi.fn()}
        onReply={vi.fn()}
        isActive={false}
        isContentDeleted={true}
      />
    );
    expect(screen.getByText(/content deleted/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /resolve/i })).toBeDefined();
  });

  it("shows resolved badge and no Resolve button when resolved", () => {
    render(
      <CommentCard
        comment={{ ...base, resolved: true }}
        onClick={vi.fn()}
        onResolve={vi.fn()}
        onReply={vi.fn()}
        isActive={false}
        isContentDeleted={false}
      />
    );
    expect(screen.getByText(/resolved/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /resolve/i })).toBeNull();
  });

  it("calls onResolve with comment id when Resolve clicked", () => {
    const onResolve = vi.fn();
    render(
      <CommentCard
        comment={base}
        onClick={vi.fn()}
        onResolve={onResolve}
        onReply={vi.fn()}
        isActive={false}
        isContentDeleted={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /resolve/i }));
    expect(onResolve).toHaveBeenCalledWith("abc");
  });

  it("calls onClick with comment id when open card body is clicked", () => {
    const onClick = vi.fn();
    render(
      <CommentCard
        comment={base}
        onClick={onClick}
        onResolve={vi.fn()}
        onReply={vi.fn()}
        isActive={false}
        isContentDeleted={false}
      />
    );
    fireEvent.click(screen.getByText("This needs work"));
    expect(onClick).toHaveBeenCalledWith("abc");
  });

  it("does not call onClick when resolved card body is clicked", () => {
    const onClick = vi.fn();
    render(
      <CommentCard
        comment={{ ...base, resolved: true }}
        onClick={onClick}
        onResolve={vi.fn()}
        onReply={vi.fn()}
        isActive={false}
        isContentDeleted={false}
      />
    );
    fireEvent.click(screen.getByText("This needs work"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
