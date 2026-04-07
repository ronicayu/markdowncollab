import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

const mockCreate = vi.mocked(prisma.activityLog.create);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logActivity", () => {
  it("creates an activity log entry", async () => {
    mockCreate.mockResolvedValue({
      id: "act-1",
      documentId: "doc-1",
      userId: "user-1",
      userName: "Alice",
      action: "shared",
      detail: "Shared with bob@test.com",
      createdAt: new Date(),
    } as any);

    await logActivity("doc-1", "user-1", "Alice", "shared", "Shared with bob@test.com");

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        documentId: "doc-1",
        userId: "user-1",
        userName: "Alice",
        action: "shared",
        detail: "Shared with bob@test.com",
      },
    });
  });

  it("handles null userId", async () => {
    mockCreate.mockResolvedValue({} as any);

    await logActivity("doc-1", null, "Anonymous", "shared");

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        documentId: "doc-1",
        userId: undefined,
        userName: "Anonymous",
        action: "shared",
        detail: undefined,
      },
    });
  });

  it("does not throw on create failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error("DB error"));

    // Should not throw
    await logActivity("doc-1", "user-1", "Alice", "shared");

    expect(consoleSpy).toHaveBeenCalledWith("Failed to log activity:", expect.any(Error));
    consoleSpy.mockRestore();
  });
});
