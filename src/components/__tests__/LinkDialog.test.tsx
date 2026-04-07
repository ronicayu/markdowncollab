import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LinkDialog from "../LinkDialog";

// Create a minimal mock editor
function createMockEditor(overrides: Record<string, unknown> = {}) {
  return {
    state: {
      selection: { from: 0, to: 0 },
      doc: {
        textBetween: () => "",
      },
    },
    getAttributes: () => ({}),
    chain: () => {
      const chainObj: Record<string, unknown> = {};
      chainObj.focus = () => chainObj;
      chainObj.setLink = () => chainObj;
      chainObj.unsetLink = () => chainObj;
      chainObj.deleteRange = () => chainObj;
      chainObj.insertContent = () => chainObj;
      chainObj.run = vi.fn();
      return chainObj;
    },
    ...overrides,
  } as never;
}

describe("LinkDialog", () => {
  it("renders the dialog with URL and text inputs", () => {
    const editor = createMockEditor();
    render(<LinkDialog editor={editor} onClose={vi.fn()} />);

    expect(screen.getByText("Insert Link")).toBeDefined();
    expect(screen.getByLabelText("URL")).toBeDefined();
    expect(screen.getByLabelText("Display text")).toBeDefined();
    expect(screen.getByText("Apply")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    const editor = createMockEditor();
    render(<LinkDialog editor={editor} onClose={onClose} />);

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const editor = createMockEditor();
    render(<LinkDialog editor={editor} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("link-dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables Apply button when URL is empty", () => {
    const editor = createMockEditor();
    render(<LinkDialog editor={editor} onClose={vi.fn()} />);

    const applyBtn = screen.getByText("Apply");
    expect(applyBtn.hasAttribute("disabled")).toBe(true);
  });

  it("shows Remove link button when editing an existing link", () => {
    const editor = createMockEditor({
      getAttributes: () => ({ href: "https://example.com" }),
    });
    render(<LinkDialog editor={editor} onClose={vi.fn()} />);

    expect(screen.getByText("Remove link")).toBeDefined();
  });

  it("does not show Remove link button for new links", () => {
    const editor = createMockEditor();
    render(<LinkDialog editor={editor} onClose={vi.fn()} />);

    expect(screen.queryByText("Remove link")).toBeNull();
  });

  it("pre-fills URL from existing link attributes", () => {
    const editor = createMockEditor({
      getAttributes: () => ({ href: "https://example.com" }),
    });
    render(<LinkDialog editor={editor} onClose={vi.fn()} />);

    const urlInput = screen.getByLabelText("URL") as HTMLInputElement;
    expect(urlInput.value).toBe("https://example.com");
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    const editor = createMockEditor();
    render(<LinkDialog editor={editor} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
