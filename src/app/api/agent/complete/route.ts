import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return NextResponse.json(
        { error: "Text must be at least 5 characters" },
        { status: 400 }
      );
    }

    // Truncate to last 500 chars to keep prompt small
    const trimmed = text.slice(-500);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `Complete the following text with 1-2 sentences. Return ONLY the completion text, nothing else. Do not repeat the original text.\n\n${trimmed}`,
        },
      ],
    });

    const completion =
      message.content[0]?.type === "text" ? message.content[0].text : "";

    return NextResponse.json({ completion });
  } catch (err: any) {
    console.error("Auto-complete error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate completion" },
      { status: 500 }
    );
  }
}
