import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhook: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { fireWebhook } from "@/lib/webhook";

const mockFindMany = vi.mocked(prisma.webhook.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true })
  );
});

describe("fireWebhook", () => {
  it("sends POST to matching webhook URLs", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hook",
        events: "agent.completed,comment.created",
        ownerId: "user-1",
        active: true,
        createdAt: new Date(),
      },
    ] as any);

    fireWebhook("user-1", "agent.completed", {
      documentId: "doc-1",
      documentTitle: "Test Doc",
      data: { suggestionsCount: 3 },
    });

    // Allow the async fire-and-forget to execute
    await new Promise((r) => setTimeout(r, 50));

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const callBody = JSON.parse(
      (fetch as any).mock.calls[0][1].body
    );
    expect(callBody.event).toBe("agent.completed");
    expect(callBody.documentId).toBe("doc-1");
    expect(callBody.data.suggestionsCount).toBe(3);
    expect(callBody.timestamp).toBeDefined();
  });

  it("skips webhooks not subscribed to the event", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hook",
        events: "document.edited",
        ownerId: "user-1",
        active: true,
        createdAt: new Date(),
      },
    ] as any);

    fireWebhook("user-1", "agent.completed", {
      documentId: "doc-1",
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends to wildcard (*) webhooks", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hook",
        events: "*",
        ownerId: "user-1",
        active: true,
        createdAt: new Date(),
      },
    ] as any);

    fireWebhook("user-1", "any.event", {
      documentId: "doc-1",
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not throw on fetch errors", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hook",
        events: "*",
        ownerId: "user-1",
        active: true,
        createdAt: new Date(),
      },
    ] as any);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    // Should not throw
    expect(() => {
      fireWebhook("user-1", "test.event", { documentId: "doc-1" });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));
  });

  it("does not throw on DB errors", async () => {
    mockFindMany.mockRejectedValue(new Error("DB error"));

    expect(() => {
      fireWebhook("user-1", "test.event", { documentId: "doc-1" });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));
  });
});
