import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotification, buildNotificationMessage } from "../notifications";

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notif-1" }),
    },
  },
}));

import { prisma } from "@/lib/prisma";

describe("buildNotificationMessage", () => {
  it("builds comment message", () => {
    const msg = buildNotificationMessage("comment", "Alice", "My Doc");
    expect(msg).toBe("Alice commented on My Doc");
  });

  it("builds reply message", () => {
    const msg = buildNotificationMessage("reply", "Bob", "My Doc");
    expect(msg).toBe("Bob replied to your comment on My Doc");
  });

  it("builds share message", () => {
    const msg = buildNotificationMessage("share", "Carol", "My Doc");
    expect(msg).toBe("Carol shared My Doc with you");
  });

  it("builds suggestion message", () => {
    const msg = buildNotificationMessage("suggestion", "Dave", "My Doc");
    expect(msg).toBe("Dave added a suggestion on My Doc");
  });
});

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a notification in the database", async () => {
    await createNotification({
      userId: "user-1",
      type: "comment",
      documentId: "doc-1",
      documentTitle: "My Doc",
      actorName: "Alice",
      actorId: "actor-1",
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "comment",
        documentId: "doc-1",
        documentTitle: "My Doc",
        actorName: "Alice",
        actorId: "actor-1",
        message: "Alice commented on My Doc",
        snippet: null,
      },
    });
  });

  it("does not notify the actor themselves", async () => {
    await createNotification({
      userId: "actor-1",
      type: "comment",
      documentId: "doc-1",
      documentTitle: "My Doc",
      actorName: "Alice",
      actorId: "actor-1",
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
