import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * POST /api/agent/expand
 * Expand and elaborate on selected text using AI.
 * Body: { text: string, instruction?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, instruction } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or empty text" },
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
    const rateLimitKey = `agent-expand:${request.headers.get("x-forwarded-for") || "anonymous"}`;
    const rateResult = checkRateLimit(rateLimitKey, 10, 6_000);
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

    const systemPrompt = "You are a writing assistant. When given text, expand and elaborate on it while maintaining the original tone and style. Keep the expanded text clear, coherent, and well-structured. Return only the expanded text without any preamble or explanation.";

    const userPrompt = instruction
      ? `Expand and elaborate on this text with the following instruction: "${instruction}"\n\nText:\n${text}`
      : `Expand and elaborate on this text:\n\n${text}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const expanded =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ expanded });
  } catch (err) {
    console.error("AI expand error:", err);
    return NextResponse.json(
      { error: "Failed to expand text" },
      { status: 500 }
    );
  }
}
