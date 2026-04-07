import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "../route";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockCreate = vi.mocked(prisma.user.create);

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a new user successfully", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      password: "hashed",
      createdAt: new Date(),
    } as any);

    const res = await POST(makeRequest({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({
      email: "alice@example.com",
      password: "password123",
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({
      name: "Alice",
      password: "password123",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeRequest({
      name: "Alice",
      email: "alice@example.com",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    const res = await POST(makeRequest({
      name: "Alice",
      email: "alice@example.com",
      password: "12345",
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("6 characters");
  });

  it("returns 409 when email already exists", async () => {
    mockFindUnique.mockResolvedValue({
      id: "existing",
      name: "Existing",
      email: "alice@example.com",
      password: "hashed",
      createdAt: new Date(),
    } as any);

    const res = await POST(makeRequest({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already registered");
  });

  it("lowercases email before checking and storing", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      password: "hashed",
      createdAt: new Date(),
    } as any);

    await POST(makeRequest({
      name: "Alice",
      email: "Alice@Example.COM",
      password: "password123",
    }));

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "alice@example.com" },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "alice@example.com",
      }),
    });
  });

  it("trims whitespace from name", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      password: "hashed",
      createdAt: new Date(),
    } as any);

    await POST(makeRequest({
      name: "  Alice  ",
      email: "alice@example.com",
      password: "password123",
    }));

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Alice",
      }),
    });
  });
});
