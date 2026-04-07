import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock prisma
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customTemplate: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

import { getServerSession } from "next-auth";
import { GET, POST } from "../route";

const mockedGetSession = vi.mocked(getServerSession);

describe("GET /api/templates/custom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns custom templates for authenticated user", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test User", email: "test@test.com" },
      expires: "",
    });
    const templates = [
      { id: "t1", name: "My Template", description: "Desc", createdAt: new Date() },
    ];
    mockFindMany.mockResolvedValue(templates);

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].name).toBe("My Template");
  });
});

describe("POST /api/templates/custom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);
    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({ name: "Test", content: "<p>Hello</p>" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req as any);
    expect(response.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test User", email: "test@test.com" },
      expires: "",
    });
    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({ content: "<p>Hello</p>" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req as any);
    expect(response.status).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test User", email: "test@test.com" },
      expires: "",
    });
    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({ name: "My Template" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req as any);
    expect(response.status).toBe(400);
  });

  it("creates a custom template successfully", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test User", email: "test@test.com" },
      expires: "",
    });
    const created = {
      id: "t1",
      name: "Meeting Notes",
      description: "Weekly standup",
      content: "<p>Notes here</p>",
      ownerId: "user-1",
      createdAt: new Date(),
    };
    mockCreate.mockResolvedValue(created);

    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({ name: "Meeting Notes", description: "Weekly standup", content: "<p>Notes here</p>" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req as any);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.name).toBe("Meeting Notes");
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: "Meeting Notes",
        description: "Weekly standup",
        content: "<p>Notes here</p>",
        ownerId: "user-1",
      },
    });
  });
});
