import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { xmlFragmentToMarkdown } from "@/lib/export-markdown";
import { checkRateLimit } from "@/lib/rate-limiter";

const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";

/**
 * POST /api/agent/title
 * Generate a concise title (3-6 words) for a document based on its content.
 * Body: { documentId: string }
 */
export async function POST(request: NextRequest) {
  let cleanup: (() => void) | null = null;

  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }

    // Rate limit: 10 title generations per user per 10 minutes
    const rateLimitKey = `agent-title:${request.headers.get("x-forwarded-for") || "anonymous"}`;
    const rateResult = checkRateLimit(rateLimitKey, 10, 60_000);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Rate limited. Try again later.", retryAfter: rateResult.retryAfter },
        { status: 429 }
      );
    }

    // Connect to Yjs and get document content
    const conn = await connectYjsServer(WS_URL, documentId);
    cleanup = conn.cleanup;
    const yxml = conn.ydoc.getXmlFragment("default");
    const markdown = xmlFragmentToMarkdown(yxml);

    // Take the first 500 characters
    const contentSnippet = markdown.slice(0, 500);

    if (!contentSnippet.trim()) {
      return NextResponse.json(
        { error: "Document is empty" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: `Generate a concise title (3-6 words) for this document. Return ONLY the title, no quotes or punctuation unless part of the title.\n\n${contentSnippet}`,
        },
      ],
    });

    const titleBlock = message.content[0];
    const title = titleBlock.type === "text" ? titleBlock.text.trim() : "Untitled";

    return NextResponse.json({ title });
  } catch (error) {
    console.error("Title generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate title" },
      { status: 500 }
    );
  } finally {
    cleanup?.();
  }
}
