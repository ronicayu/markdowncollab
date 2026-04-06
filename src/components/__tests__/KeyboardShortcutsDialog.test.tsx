import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import KeyboardShortcutsDialog from "../KeyboardShortcutsDialog";

describe("KeyboardShortcutsDialog", () => {
  it("does not render when open is false", () => {
    const { container } = render(
      <KeyboardShortcutsDialog open={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog with heading when open is true", () => {
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeDefined();
  });

  it("renders all shortcut categories", () => {
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Text Formatting")).toBeDefined();
    expect(screen.getByText("Blocks")).toBeDefined();
    expect(screen.getByText("Editing")).toBeDefined();
    expect(screen.getByText("Navigation")).toBeDefined();
  });

  it("renders shortcut actions like Bold, Italic, Undo", () => {
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Bold")).toBeDefined();
    expect(screen.getByText("Italic")).toBeDefined();
    expect(screen.getByText("Undo")).toBeDefined();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("shortcuts-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsDialog open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows Ctrl on non-Mac platforms", () => {
    // jsdom defaults to empty userAgent/platform, which is non-Mac
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    const allText = document.body.textContent || "";
    expect(allText).toContain("Ctrl");
  });
});
