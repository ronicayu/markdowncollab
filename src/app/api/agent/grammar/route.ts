import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * POST /api/agent/grammar
 * Sends paragraph text to Anthropic to find grammar issues.
 * Body: { text: string }
 * Returns: { issues: [{start, end, message, suggestion}] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ issues: [] });
    }

    // Rate limit: 10 requests per minute per IP
    const rateLimitKey = `grammar:${request.headers.get("x-forwarded-for") || "anonymous"}`;
    const rateResult = checkRateLimit(rateLimitKey, 10, 6_000);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Rate limited", retryAfter: rateResult.retryAfter },
        { status: 429 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ issues: [] });
    }

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Find grammar, spelling, and punctuation issues in the following text. Return a JSON array of issues. Each issue should have: "start" (character index where issue starts), "end" (character index where issue ends), "message" (brief description of the issue), "suggestion" (corrected text for that span). If there are no issues, return an empty array. Only return the JSON array, nothing else.

Text:
${text}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ issues: [] });
    }

    try {
      // Extract JSON from the response (it might be wrapped in markdown code fences)
      let jsonStr = content.text.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }
      const issues = JSON.parse(jsonStr);
      if (!Array.isArray(issues)) {
        return NextResponse.json({ issues: [] });
      }
      return NextResponse.json({ issues });
    } catch {
      return NextResponse.json({ issues: [] });
    }
  } catch (error) {
    console.error("Grammar check error:", error);
    return NextResponse.json({ issues: [] });
  }
}
