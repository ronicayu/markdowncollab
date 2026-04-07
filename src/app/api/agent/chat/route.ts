import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { xmlFragmentToMarkdown } from "@/lib/export-markdown";
import { checkRateLimit } from "@/lib/rate-limiter";

const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";

/**
 * POST /api/agent/chat
 * Chat with AI about the current document.
 * Body: { documentId: string, messages: [{role, content}] }
 */
export async function POST(request: NextRequest) {
  let cleanup: (() => void) | null = null;

  try {
    const body = await request.json();
    const { documentId, messages } = body;

    if (!documentId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Missing documentId or messages" },
        { status: 400 }
      );
    }

    // Rate limit: 20 messages per user per 10 minutes
    const rateLimitKey = `agent-chat:${request.headers.get("x-forwarded-for") || "anonymous"}`;
    const rateResult = checkRateLimit(rateLimitKey, 20, 30_000); // 600000ms/20 = 30000ms per token
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter) } }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-key-here") {
      return NextResponse.json(
        { error: "Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env." },
        { status: 503 }
      );
    }

    // Connect to Yjs to get current document content
    const connection = await connectYjsServer(WS_URL, documentId);
    cleanup = connection.cleanup;
    const fragment = connection.ydoc.getXmlFragment("default");
    const documentMarkdown = xmlFragmentToMarkdown(fragment);

    if (!documentMarkdown.trim()) {
      return NextResponse.json(
        { error: "Document is empty" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Build conversation with document as system context
    const systemPrompt = `You are a helpful AI assistant embedded in a collaborative markdown editor. The user is asking about the document they are currently editing. Be concise, helpful, and specific to the document content.

Here is the current document content:

---
${documentMarkdown}
---

Answer the user's questions about this document. If they ask for suggestions, improvements, or summaries, base your response on the actual document content above.`;

    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const assistantContent =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : "I could not generate a response.";

    return NextResponse.json({ content: assistantContent });
  } catch (error) {
    console.error("Agent chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    cleanup?.();
  }
}
