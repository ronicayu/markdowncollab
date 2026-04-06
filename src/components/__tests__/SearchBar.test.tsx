import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import SearchBar from "../SearchBar";

const defaultProps = {
  query: "",
  matchCount: 0,
  currentIndex: 0,
  caseSensitive: false,
  showReplace: false,
  onQueryChange: vi.fn(),
  onFindNext: vi.fn(),
  onFindPrevious: vi.fn(),
  onReplace: vi.fn(),
  onReplaceAll: vi.fn(),
  onToggleCaseSensitive: vi.fn(),
  onToggleReplace: vi.fn(),
  onClose: vi.fn(),
};

describe("SearchBar", () => {
  it("renders search input", () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText("Find...")).toBeDefined();
  });

  it("displays match count as '0 results' when no matches", () => {
    render(<SearchBar {...defaultProps} query="xyz" />);
    expect(screen.getByText("0 results")).toBeDefined();
  });

  it("displays match count as '1 of 3' with matches", () => {
    render(<SearchBar {...defaultProps} query="hello" matchCount={3} currentIndex={0} />);
    expect(screen.getByText("1 of 3")).toBeDefined();
  });

  it("calls onQueryChange when typing in search input", async () => {
    const onQueryChange = vi.fn();
    render(<SearchBar {...defaultProps} onQueryChange={onQueryChange} />);
    const input = screen.getByPlaceholderText("Find...");
    await userEvent.type(input, "h");
    expect(onQueryChange).toHaveBeenCalledWith("h");
  });

  it("calls onFindNext on Enter key", () => {
    const onFindNext = vi.fn();
    render(<SearchBar {...defaultProps} query="hello" matchCount={2} onFindNext={onFindNext} />);
    const input = screen.getByPlaceholderText("Find...");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onFindNext).toHaveBeenCalled();
  });

  it("calls onFindPrevious on Shift+Enter", () => {
    const onFindPrevious = vi.fn();
    render(<SearchBar {...defaultProps} query="hello" matchCount={2} onFindPrevious={onFindPrevious} />);
    const input = screen.getByPlaceholderText("Find...");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onFindPrevious).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<SearchBar {...defaultProps} onClose={onClose} />);
    const input = screen.getByPlaceholderText("Find...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows case sensitivity toggle button", () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByTitle("Case sensitive")).toBeDefined();
  });

  it("calls onToggleCaseSensitive when Aa button clicked", async () => {
    const onToggle = vi.fn();
    render(<SearchBar {...defaultProps} onToggleCaseSensitive={onToggle} />);
    await userEvent.click(screen.getByTitle("Case sensitive"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("shows replace row when showReplace is true", () => {
    render(<SearchBar {...defaultProps} showReplace={true} />);
    expect(screen.getByPlaceholderText("Replace...")).toBeDefined();
  });

  it("hides replace row when showReplace is false", () => {
    render(<SearchBar {...defaultProps} showReplace={false} />);
    expect(screen.queryByPlaceholderText("Replace...")).toBeNull();
  });

  it("calls onReplace when Replace button clicked", async () => {
    const onReplace = vi.fn();
    render(<SearchBar {...defaultProps} showReplace={true} query="hello" matchCount={1} onReplace={onReplace} />);
    await userEvent.click(screen.getByTitle("Replace"));
    expect(onReplace).toHaveBeenCalled();
  });

  it("calls onReplaceAll when Replace All button clicked", async () => {
    const onReplaceAll = vi.fn();
    render(<SearchBar {...defaultProps} showReplace={true} query="hello" matchCount={1} onReplaceAll={onReplaceAll} />);
    await userEvent.click(screen.getByTitle("Replace all"));
    expect(onReplaceAll).toHaveBeenCalled();
  });

  it("highlights case sensitive button when active", () => {
    const { container } = render(<SearchBar {...defaultProps} caseSensitive={true} />);
    const btn = screen.getByTitle("Case sensitive");
    expect(btn.className).toContain("bg-");
  });
});
