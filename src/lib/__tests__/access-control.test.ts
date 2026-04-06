import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkDocumentAccess, type AccessResult } from "@/lib/access-control";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
    },
    documentShare: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindUnique = vi.mocked(prisma.document.findUnique);
const mockShareFindFirst = vi.mocked(prisma.documentShare.findFirst);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkDocumentAccess", () => {
  const docId = "doc-1";
  const userId = "user-1";
  const userEmail = "user@example.com";

  it("returns no-access when document does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: false, role: null });
  });

  it("returns owner role when user is the document owner", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: userId,
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "owner" });
  });

  it("returns role from explicit share by userId", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue({
      id: "share-1",
      documentId: docId,
      userId,
      email: null,
      role: "editor",
      shareToken: null,
      createdAt: new Date(),
    } as any);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "editor" });
  });

  it("returns role from explicit share by email", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    // First call (by userId) returns null, second call (by email) returns share
    mockShareFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "share-2",
        documentId: docId,
        userId: null,
        email: userEmail,
        role: "viewer",
        shareToken: null,
        createdAt: new Date(),
      } as any);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "viewer" });
  });

  it("returns no-access for private doc with no share", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue(null);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: false, role: null });
  });

  it("returns viewer for anyone_with_link doc even without explicit share", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "anyone_with_link",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue(null);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "viewer" });
  });

  it("returns full access for legacy docs with no owner", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: null,
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue(null);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "editor" });
  });

  it("validates share token access", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst
      .mockResolvedValueOnce({     // by shareToken (userId and email are null, so those checks are skipped)
        id: "share-3",
        documentId: docId,
        userId: null,
        email: null,
        role: "editor",
        shareToken: "tok-abc",
        createdAt: new Date(),
      } as any);
    const result = await checkDocumentAccess(docId, null, null, "tok-abc");
    expect(result).toEqual({ hasAccess: true, role: "editor" });
  });

  it("checks required role — editor cannot delete (requires owner)", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue({
      id: "share-1",
      documentId: docId,
      userId,
      email: null,
      role: "editor",
      shareToken: null,
      createdAt: new Date(),
    } as any);
    const result = await checkDocumentAccess(docId, userId, userEmail, undefined, "owner");
    expect(result).toEqual({ hasAccess: false, role: "editor" });
  });
});
