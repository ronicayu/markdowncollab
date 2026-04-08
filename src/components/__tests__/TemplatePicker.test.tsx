import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TemplatePicker from "../TemplatePicker";

const mockTemplates = [
  { id: "blank", name: "Blank", description: "Start from scratch", icon: "📄" },
  { id: "meeting-notes", name: "Meeting Notes", description: "Agenda and action items", icon: "📋" },
];

describe("TemplatePicker", () => {
  beforeEach(() => {
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("/api/templates/custom")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTemplates),
      });
    }) as unknown as typeof fetch;
  });

  it("renders template cards after loading", async () => {
    const onSelect = vi.fn();
    render(<TemplatePicker open={true} onClose={vi.fn()} onSelect={onSelect} />);
    await waitFor(() => {
      expect(screen.getByText("Blank")).toBeInTheDocument();
      expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
    });
  });

  it("calls onSelect with template id when a card is double-clicked", async () => {
    const onSelect = vi.fn();
    render(<TemplatePicker open={true} onClose={vi.fn()} onSelect={onSelect} />);
    await waitFor(() => expect(screen.getByText("Meeting Notes")).toBeInTheDocument());
    fireEvent.doubleClick(screen.getByText("Meeting Notes"));
    expect(onSelect).toHaveBeenCalledWith("meeting-notes");
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<TemplatePicker open={true} onClose={onClose} onSelect={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Blank")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("template-picker-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when open is false", () => {
    render(<TemplatePicker open={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByText("Choose a template")).not.toBeInTheDocument();
  });
});
