import { NextResponse } from "next/server";
import * as Y from "yjs";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { checkRateLimit } from "@/lib/rate-limiter";
import Anthropic from "@anthropic-ai/sdk";

const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";

/**
 * Recursively extract plain text from a Yjs XmlFragment/XmlElement.
 */
function extractText(node: Y.XmlFragment | Y.XmlElement): string {
  const parts: string[] = [];
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlText) {
      parts.push(child.toString());
    } else if (child instanceof Y.XmlElement) {
      const inner = extractText(child);
      const tag = child.nodeName?.toLowerCase() ?? "";
      const blockTags = [
        "paragraph", "heading", "blockquote", "codeblock",
        "bulletlist", "orderedlist", "listitem",
        "p", "h1", "h2", "h3", "h4", "h5", "h6",
        "div", "li", "ul", "ol", "pre",
      ];
      if (blockTags.includes(tag)) {
        parts.push(inner + "\n");
      } else {
        parts.push(inner);
      }
    }
  }
  return parts.join("");
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Rate limit: 5 summaries per hour per document
  const rl = checkRateLimit(`summarize:${id}`, 5, 720_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Retry after ${rl.retryAfter}s` },
      { status: 429 }
    );
  }

  try {
    const connection = await connectYjsServer(WS_URL, id);

    const fragment = connection.ydoc.getXmlFragment("default");
    const plainText = extractText(fragment).trim();
    connection.cleanup();

    if (!plainText || plainText.length < 10) {
      return NextResponse.json(
        { error: "Document is too short to summarize" },
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
    const truncated = plainText.slice(0, 8000);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Summarize the following document in 2-3 sentences. Be concise and informative.\n\n${truncated}`,
        },
      ],
    });

    const summary =
      message.content[0]?.type === "text"
        ? message.content[0].text
        : "Unable to generate summary";

    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("Summarize error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate summary" },
      { status: 500 }
    );
  }
}
