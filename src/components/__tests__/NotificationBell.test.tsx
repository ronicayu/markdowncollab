import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NotificationBell from "../NotificationBell";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no unread notifications
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ unread: 0 }),
    });
  });

  it("renders bell icon", () => {
    render(<NotificationBell />);
    expect(screen.getByTitle("Notifications")).toBeDefined();
  });

  it("shows unread badge when count > 0", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unread: 3 }),
    });
    render(<NotificationBell />);
    await waitFor(() => {
      expect(screen.getByText("3")).toBeDefined();
    });
  });

  it("does not show badge when count is 0", async () => {
    render(<NotificationBell />);
    await waitFor(() => {
      expect(screen.queryByText("0")).toBeNull();
    });
  });

  it("opens dropdown when clicked", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unread: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "n1",
            type: "comment",
            message: "Alice commented on My Doc",
            documentId: "doc-1",
            read: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

    render(<NotificationBell />);
    fireEvent.click(screen.getByTitle("Notifications"));

    await waitFor(() => {
      expect(screen.getByText("Alice commented on My Doc")).toBeDefined();
    });
  });
});
