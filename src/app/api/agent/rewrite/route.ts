import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limiter";

const STYLE_PROMPTS: Record<string, string> = {
  shorter:
    "Rewrite the following text to be more concise and shorter, while preserving the key meaning. Remove unnecessary words and redundancy.",
  longer:
    "Rewrite the following text to be more detailed and longer, expanding on the ideas while maintaining the original tone.",
  simpler:
    "Rewrite the following text in simpler language. Use shorter sentences, common words, and clear structure. Aim for 8th-grade reading level.",
  formal:
    "Rewrite the following text in a formal, professional tone. Use precise vocabulary and proper structure.",
};

/**
 * POST /api/agent/rewrite
 * Rewrite selected text in a given style.
 * Body: { text: string, style: "shorter"|"longer"|"simpler"|"formal" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, style } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or empty text" },
        { status: 400 }
      );
    }

    if (!style || !STYLE_PROMPTS[style]) {
      return NextResponse.json(
        { error: "Invalid style. Must be one of: shorter, longer, simpler, formal" },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: "Text too long (max 5000 characters)" },
        { status: 400 }
      );
    }

    // Rate limit: 10 requests per 60 seconds per IP
    const rateLimitKey = `agent-rewrite:${request.headers.get("x-forwarded-for") || "anonymous"}`;
    const rateResult = checkRateLimit(rateLimitKey, 10, 60_000);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Rate limited. Please wait before trying again." },
        { status: 429 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system:
        "You are a writing assistant. Return only the rewritten text without any preamble, explanation, or quotation marks.",
      messages: [
        {
          role: "user",
          content: `${STYLE_PROMPTS[style]}\n\nText:\n${text}`,
        },
      ],
    });

    const rewritten =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ rewritten });
  } catch (err) {
    console.error("AI rewrite error:", err);
    return NextResponse.json(
      { error: "Failed to rewrite text" },
      { status: 500 }
    );
  }
}
