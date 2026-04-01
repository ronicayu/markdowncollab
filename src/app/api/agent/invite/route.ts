import { NextRequest, NextResponse } from "next/server";
import * as Y from "yjs";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { generateSuggestions } from "@/lib/agent";
import { addSuggestion } from "@/lib/suggestion-store";

const WS_URL = process.env.YJS_WS_URL || "ws://localhost:1234";

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
        "paragraph",
        "heading",
        "blockquote",
        "codeblock",
        "bulletlist",
        "orderedlist",
        "listitem",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "div",
        "li",
        "ul",
        "ol",
        "pre",
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

/**
 * Find the index of `needle` text within the XmlFragment's text content,
 * and return Yjs RelativePositions for start and end.
 */
function findTextAndCreateAnchors(
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

function generateId(): string {
  return `suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function contentHash(text: string): string {
  // Simple hash for content tracking
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

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

    // Connect to Yjs room server-side
    const connection = await connectYjsServer(WS_URL, documentId, {
      name: "Claude",
      color: "#374151",
    });
    cleanup = connection.cleanup;
    const { ydoc } = connection;

    // Extract plain text from the Yjs XmlFragment
    const fragment = ydoc.getXmlFragment("default");
    const plainText = extractText(fragment).trim();

    if (!plainText) {
      return NextResponse.json(
        { error: "Document is empty" },
        { status: 400 }
      );
    }

    // Generate suggestions via Anthropic API
    const rawSuggestions = await generateSuggestions(plainText);

    // Add each suggestion to the Yjs shared map with RelativePosition anchors
    let suggestionsCount = 0;

    for (const raw of rawSuggestions) {
      const anchors = findTextAndCreateAnchors(fragment, raw.original);
      if (!anchors) continue; // Skip if original text not found in document

      addSuggestion(ydoc, {
        id: generateId(),
        documentId,
        authorName: "Claude",
        authorType: "agent",
        originalText: raw.original,
        suggestedText: raw.suggested,
        rationale: raw.rationale,
        status: "pending",
        startRelPos: anchors.startRelPos,
        endRelPos: anchors.endRelPos,
        contentHash: contentHash(raw.original),
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      });

      suggestionsCount++;
    }

    return NextResponse.json({ success: true, suggestionsCount });
  } catch (error) {
    console.error("Agent invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    if (cleanup) {
      cleanup();
    }
  }
}
