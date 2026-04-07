import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/yjs-server-connect", () => ({
  connectYjsServer: vi.fn(),
}));

vi.mock("@/lib/suggestion-store", () => ({
  addComment: vi.fn(),
  getComments: vi.fn().mockReturnValue([]),
}));

import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { getComments, addComment } from "@/lib/suggestion-store";
import { GET, POST } from "../route";

const mockFindUnique = vi.mocked(prisma.document.findUnique);
const mockConnectYjs = vi.mocked(connectYjsServer);
const mockGetComments = vi.mocked(getComments);
const mockAddComment = vi.mocked(addComment);

function makeJsonRpcRequest(method: string, params: Record<string, unknown> = {}, id: number = 1) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  }) as any;
}

describe("GET /api/mcp (manifest)", () => {
  it("returns the MCP manifest with tool definitions", async () => {
    const res = await GET();
    const data = await res.json();

    expect(data.schema_version).toBe("v1");
    expect(data.name).toBe("markdowncollab-mcp");
    expect(data.tools).toHaveLength(2);
    expect(data.tools[0].name).toBe("get_comments");
    expect(data.tools[1].name).toBe("add_comment");
  });

  it("includes input_schema for each tool", async () => {
    const res = await GET();
    const data = await res.json();

    for (const tool of data.tools) {
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe("object");
      expect(tool.input_schema.properties.document_id).toBeDefined();
    }
  });
});

describe("POST /api/mcp (tool execution)", () => {
  const mockYdoc = {} as any;
  const mockCleanup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectYjs.mockResolvedValue({
      ydoc: mockYdoc,
      awareness: {} as any,
      cleanup: mockCleanup,
    });
  });

  it("returns parse error for invalid JSON", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{",
    }) as any;

    const res = await POST(req);
    const data = await res.json();
    expect(data.error.code).toBe(-32700);
  });

  it("returns invalid request for non-JSON-RPC body", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    }) as any;

    const res = await POST(req);
    const data = await res.json();
    expect(data.error.code).toBe(-32600);
  });

  it("returns method not found for unknown method", async () => {
    const res = await POST(makeJsonRpcRequest("unknown_method"));
    const data = await res.json();
    expect(data.error.code).toBe(-32601);
    expect(data.error.message).toContain("unknown_method");
  });

  it("get_comments returns empty array when document not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeJsonRpcRequest("get_comments", { document_id: "doc-1" }));
    const data = await res.json();
    expect(data.result.comments).toEqual([]);
    expect(data.result.error).toContain("not found");
  });

  it("get_comments returns comments from Yjs", async () => {
    mockFindUnique.mockResolvedValue({ id: "doc-1" } as any);
    mockGetComments.mockReturnValue([
      {
        id: "c-1",
        documentId: "doc-1",
        authorName: "Alice",
        authorType: "human",
        content: "Fix this",
        startRelPos: new Uint8Array(),
        endRelPos: new Uint8Array(),
        parentCommentId: null,
        resolved: false,
        createdAt: "2026-04-06T10:00:00Z",
        replies: [],
      },
    ]);

    const res = await POST(makeJsonRpcRequest("get_comments", { document_id: "doc-1" }));
    const data = await res.json();
    expect(data.result.comments).toHaveLength(1);
    expect(data.result.comments[0].content).toBe("Fix this");
    expect(data.result.comments[0].author).toBe("Alice");
  });

  it("get_comments requires document_id", async () => {
    const res = await POST(makeJsonRpcRequest("get_comments", {}));
    const data = await res.json();
    expect(data.error.code).toBe(-32602);
  });

  it("get_comments validates status parameter", async () => {
    const res = await POST(makeJsonRpcRequest("get_comments", {
      document_id: "doc-1",
      status: "invalid",
    }));
    const data = await res.json();
    expect(data.error.code).toBe(-32602);
    expect(data.error.message).toContain("status");
  });

  it("add_comment creates a comment and returns success", async () => {
    mockFindUnique.mockResolvedValue({ id: "doc-1" } as any);

    const res = await POST(makeJsonRpcRequest("add_comment", {
      document_id: "doc-1",
      content: "Great work!",
      author_name: "Bot",
    }));
    const data = await res.json();
    expect(data.result.success).toBe(true);
    expect(data.result.author).toBe("Bot");
    expect(data.result.comment_id).toBeTruthy();
    expect(mockAddComment).toHaveBeenCalled();
  });

  it("add_comment requires document_id", async () => {
    const res = await POST(makeJsonRpcRequest("add_comment", { content: "test" }));
    const data = await res.json();
    expect(data.error.code).toBe(-32602);
  });

  it("add_comment requires content", async () => {
    const res = await POST(makeJsonRpcRequest("add_comment", { document_id: "doc-1" }));
    const data = await res.json();
    expect(data.error.code).toBe(-32602);
  });

  it("add_comment defaults author to 'AI Agent'", async () => {
    mockFindUnique.mockResolvedValue({ id: "doc-1" } as any);

    const res = await POST(makeJsonRpcRequest("add_comment", {
      document_id: "doc-1",
      content: "Note",
    }));
    const data = await res.json();
    expect(data.result.author).toBe("AI Agent");
  });

  it("cleans up Yjs connection after get_comments", async () => {
    mockFindUnique.mockResolvedValue({ id: "doc-1" } as any);
    mockGetComments.mockReturnValue([]);

    await POST(makeJsonRpcRequest("get_comments", { document_id: "doc-1" }));
    expect(mockCleanup).toHaveBeenCalled();
  });
});
