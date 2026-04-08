import { NextRequest, NextResponse } from "next/server";
import * as Y from "yjs";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
        "paragraph", "heading", "blockquote", "codeblock", "bulletlist",
        "orderedlist", "listitem", "p", "h1", "h2", "h3", "h4", "h5", "h6",
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

const SUPPORTED_LANGUAGES = [
  "Spanish", "French", "Japanese", "Chinese", "German", "Portuguese",
  "Korean", "Italian", "Russian", "Arabic", "Hindi",
];

export async function POST(request: NextRequest) {
  let cleanup: (() => void) | null = null;

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate limit: 5 translations per hour per user
    const rl = checkRateLimit(`translate:${userId}`, 5, 720_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.retryAfter}s` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { documentId, targetLanguage } = body;

    if (!documentId || !targetLanguage) {
      return NextResponse.json(
        { error: "documentId and targetLanguage required" },
        { status: 400 }
      );
    }

    if (!SUPPORTED_LANGUAGES.includes(targetLanguage)) {
      return NextResponse.json(
        { error: `Unsupported language: ${targetLanguage}` },
        { status: 400 }
      );
    }

    // Get original document title
    const originalDoc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { title: true, ownerId: true, folderId: true },
    });

    if (!originalDoc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Connect to Yjs to get document content
    const { ydoc, cleanup: c } = await connectYjsServer(WS_URL, documentId);
    cleanup = c;

    const fragment = ydoc.getXmlFragment("default");
    const content = extractText(fragment);

    if (!content.trim()) {
      return NextResponse.json({ error: "Document is empty" }, { status: 400 });
    }

    // Call Anthropic to translate
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: anthropicApiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Translate the following markdown document to ${targetLanguage}. Preserve all markdown formatting, links, code blocks, and structure. Only translate the human-readable text. Do not add any explanation or commentary — output only the translated markdown.\n\n${content}`,
        },
      ],
    });

    const translatedContent =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Create a new document with translated content
    const newDoc = await prisma.document.create({
      data: {
        title: `${originalDoc.title} (${targetLanguage})`,
        ownerId: userId,
        folderId: originalDoc.folderId,
      },
    });

    // Clean up Yjs connection to source doc
    cleanup();
    cleanup = null;

    // Connect to the new doc and set content
    const { ydoc: newYdoc, cleanup: newCleanup } = await connectYjsServer(
      WS_URL,
      newDoc.id
    );

    // Insert translated content as plain text in the new doc
    const newFragment = newYdoc.getXmlFragment("default");
    const lines = translatedContent.split("\n");
    for (const line of lines) {
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText(line)]);
      newFragment.push([p]);
    }

    // Give Yjs a moment to sync
    await new Promise((resolve) => setTimeout(resolve, 1000));
    newCleanup();

    return NextResponse.json({
      documentId: newDoc.id,
      title: newDoc.title,
      language: targetLanguage,
    });
  } catch (error: any) {
    console.error("Translate error:", error);
    return NextResponse.json(
      { error: error.message || "Translation failed" },
      { status: 500 }
    );
  } finally {
    if (cleanup) cleanup();
  }
}
