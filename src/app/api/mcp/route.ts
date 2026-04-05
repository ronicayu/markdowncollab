import { NextRequest } from "next/server";
import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { addComment, getComments } from "@/lib/suggestion-store";
import type { Comment } from "@/types";

const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";

// ---------------------------------------------------------------------------
// MCP manifest (GET)
// ---------------------------------------------------------------------------

export async function GET() {
  return Response.json({
    schema_version: "v1",
    name: "markdowncollab-mcp",
    description: "MCP tools for MarkdownCollab comment system",
    tools: [
      {
        name: "get_comments",
        description: "Get all comments for a document",
        input_schema: {
          type: "object",
          properties: {
            document_id: {
              type: "string",
              description: "The document UUID",
            },
            status: {
              type: "string",
              enum: ["open", "resolved", "all"],
              description: "Filter by status. Defaults to 'open'",
              default: "open",
            },
          },
          required: ["document_id"],
        },
      },
      {
        name: "add_comment",
        description: "Add a comment to a document",
        input_schema: {
          type: "object",
          properties: {
            document_id: {
              type: "string",
              description: "The document UUID",
            },
            content: {
              type: "string",
              description: "The comment text",
            },
            author_name: {
              type: "string",
              description: "Name of the agent/author",
            },
            selected_text: {
              type: "string",
              description:
                "Optional: the text this comment references",
            },
          },
          required: ["document_id", "content"],
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

type JsonRpcId = string | number | null;

function rpcSuccess(id: JsonRpcId, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return Response.json({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleGetComments(
  id: JsonRpcId,
  params: Record<string, unknown>
): Promise<Response> {
  const documentId = params["document_id"];
  if (typeof documentId !== "string" || !documentId) {
    return rpcError(id, -32602, "Invalid params: document_id is required");
  }

  const statusFilter = (params["status"] as string | undefined) ?? "open";
  if (!["open", "resolved", "all"].includes(statusFilter)) {
    return rpcError(
      id,
      -32602,
      "Invalid params: status must be 'open', 'resolved', or 'all'"
    );
  }

  // Verify the document exists in Prisma
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true },
  });
  if (!doc) {
    return rpcSuccess(id, {
      comments: [],
      error: `Document '${documentId}' not found`,
    });
  }

  let cleanup: (() => void) | null = null;
  try {
    const connection = await connectYjsServer(WS_URL, documentId);
    cleanup = connection.cleanup;

    const allComments = getComments(connection.ydoc);

    // Filter by status
    const filtered = allComments.filter((c) => {
      if (statusFilter === "open") return !c.resolved;
      if (statusFilter === "resolved") return c.resolved;
      return true; // "all"
    });

    const comments = filtered.map((c) => ({
      id: c.id,
      content: c.content,
      author: c.authorName,
      author_type: c.authorType,
      resolved: c.resolved,
      created_at: c.createdAt,
      replies: (c.replies ?? []).map((r) => ({
        id: r.id,
        text: r.text,
        author: r.author,
        created_at: r.createdAt,
      })),
    }));

    return rpcSuccess(id, { comments });
  } finally {
    cleanup?.();
  }
}

async function handleAddComment(
  id: JsonRpcId,
  params: Record<string, unknown>
): Promise<Response> {
  const documentId = params["document_id"];
  const content = params["content"];

  if (typeof documentId !== "string" || !documentId) {
    return rpcError(id, -32602, "Invalid params: document_id is required");
  }
  if (typeof content !== "string" || !content) {
    return rpcError(id, -32602, "Invalid params: content is required");
  }

  const authorName =
    typeof params["author_name"] === "string" && params["author_name"]
      ? params["author_name"]
      : "AI Agent";

  // Verify the document exists in Prisma
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true },
  });
  if (!doc) {
    return rpcSuccess(id, {
      success: false,
      error: `Document '${documentId}' not found`,
    });
  }

  let cleanup: (() => void) | null = null;
  try {
    const connection = await connectYjsServer(WS_URL, documentId, {
      name: authorName,
      color: "#6366f1",
    });
    cleanup = connection.cleanup;

    // Build the comment. No specific text position — use empty Uint8Arrays
    // for a document-level comment.
    const comment: Comment = {
      id: crypto.randomUUID(),
      documentId,
      authorName,
      authorType: "agent",
      content,
      startRelPos: new Uint8Array(),
      endRelPos: new Uint8Array(),
      parentCommentId: null,
      resolved: false,
      createdAt: new Date().toISOString(),
      replies: [],
    };

    // If a selected_text was provided, attempt to anchor the comment to
    // actual positions within the document via relative positions.
    const selectedText = params["selected_text"];
    if (typeof selectedText === "string" && selectedText) {
      const fragment = connection.ydoc.getXmlFragment("default");
      const anchors = findTextAnchors(fragment, selectedText);
      if (anchors) {
        comment.startRelPos = anchors.startRelPos;
        comment.endRelPos = anchors.endRelPos;
      }
    }

    addComment(connection.ydoc, comment);

    return rpcSuccess(id, {
      success: true,
      comment_id: comment.id,
      author: comment.authorName,
      created_at: comment.createdAt,
    });
  } finally {
    cleanup?.();
  }
}

// ---------------------------------------------------------------------------
// Text anchor helper (mirrors the pattern in agent/invite/route.ts)
// ---------------------------------------------------------------------------

function extractText(node: Y.XmlFragment | Y.XmlElement): string {
  const parts: string[] = [];
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlText) {
      parts.push(child.toString());
    } else if (child instanceof Y.XmlElement) {
      parts.push(extractText(child));
    }
  }
  return parts.join("");
}

function findTextAnchors(
  fragment: Y.XmlFragment,
  needle: string
): { startRelPos: Uint8Array; endRelPos: Uint8Array } | null {
  const fullText = extractText(fragment);
  const index = fullText.indexOf(needle);
  if (index === -1) return null;

  const startRelPos = Y.encodeRelativePosition(
    Y.createRelativePositionFromTypeIndex(fragment, index)
  );
  const endRelPos = Y.encodeRelativePosition(
    Y.createRelativePositionFromTypeIndex(fragment, index + needle.length)
  );

  return { startRelPos, endRelPos };
}

// ---------------------------------------------------------------------------
// POST — tool execution
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error: request body is not valid JSON");
  }

  if (
    typeof body !== "object" ||
    body === null ||
    (body as Record<string, unknown>)["jsonrpc"] !== "2.0"
  ) {
    return rpcError(null, -32600, "Invalid Request: not a valid JSON-RPC 2.0 request");
  }

  const rpc = body as Record<string, unknown>;
  const id: JsonRpcId =
    typeof rpc["id"] === "string" || typeof rpc["id"] === "number"
      ? (rpc["id"] as JsonRpcId)
      : null;

  const method = rpc["method"];
  if (typeof method !== "string") {
    return rpcError(id, -32600, "Invalid Request: method must be a string");
  }

  const rawParams = rpc["params"];
  const params: Record<string, unknown> =
    typeof rawParams === "object" && rawParams !== null && !Array.isArray(rawParams)
      ? (rawParams as Record<string, unknown>)
      : {};

  try {
    switch (method) {
      case "get_comments":
        return await handleGetComments(id, params);
      case "add_comment":
        return await handleAddComment(id, params);
      default:
        return rpcError(id, -32601, `Method not found: '${method}'`);
    }
  } catch (err) {
    console.error("[MCP] Unhandled error:", err);
    return rpcError(id, -32603, "Internal error");
  }
}
