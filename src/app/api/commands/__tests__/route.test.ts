import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customCommand: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockFindMany = vi.mocked(prisma.customCommand.findMany);
const mockCreate = vi.mocked(prisma.customCommand.create);
const mockFindFirst = vi.mocked(prisma.customCommand.findFirst);
const mockDelete = vi.mocked(prisma.customCommand.delete);
const mockGetSession = vi.mocked(getServerSession);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/commands", () => {
  it("returns empty array for unauthenticated user", async () => {
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();
    expect(data).toEqual([]);
    expect(res.status).toBe(200);
  });

  it("returns user commands for authenticated user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as never);

    const mockCommands = [
      { id: "cmd-1", name: "signature", description: "My sig", content: "Best, Alice", ownerId: "user-1", createdAt: new Date() },
    ];
    mockFindMany.mockResolvedValue(mockCommands as never);

    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("signature");
  });
});

describe("POST /api/commands", () => {
  it("returns 401 for unauthenticated user", async () => {
    mockGetSession.mockResolvedValue(null);
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/commands", {
      method: "POST",
      body: JSON.stringify({ name: "test", content: "hello" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 if name is missing", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as never);

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/commands", {
      method: "POST",
      body: JSON.stringify({ content: "hello" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 if content is missing", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as never);

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/commands", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a command successfully", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as never);

    const mockCreated = {
      id: "cmd-new",
      name: "greeting",
      description: "A greeting",
      content: "Hello world!",
      ownerId: "user-1",
      createdAt: new Date(),
    };
    mockCreate.mockResolvedValue(mockCreated as never);

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/commands", {
      method: "POST",
      body: JSON.stringify({ name: "greeting", description: "A greeting", content: "Hello world!" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("greeting");
  });
});

describe("DELETE /api/commands", () => {
  it("returns 401 for unauthenticated user", async () => {
    mockGetSession.mockResolvedValue(null);
    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost/api/commands", {
      method: "DELETE",
      body: JSON.stringify({ id: "cmd-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 404 if command not found or not owned", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as never);
    mockFindFirst.mockResolvedValue(null);

    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost/api/commands", {
      method: "DELETE",
      body: JSON.stringify({ id: "cmd-unknown" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("deletes a command successfully", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as never);
    mockFindFirst.mockResolvedValue({
      id: "cmd-1",
      name: "sig",
      description: "",
      content: "Best",
      ownerId: "user-1",
      createdAt: new Date(),
    } as never);
    mockDelete.mockResolvedValue({} as never);

    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost/api/commands", {
      method: "DELETE",
      body: JSON.stringify({ id: "cmd-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
