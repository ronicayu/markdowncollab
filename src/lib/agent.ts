import Anthropic from "@anthropic-ai/sdk";

export interface RawSuggestion {
  original: string;
  suggested: string;
  rationale: string;
}

/**
 * Extract and validate a JSON array of suggestions from Claude's response text.
 * Handles responses with or without code fences.
 */
export function parseSuggestions(response: string): RawSuggestion[] {
  // Try to extract JSON from code fences first, then fall back to raw text
  const fenceMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : response.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }

  return parsed.filter(
    (item: unknown): item is RawSuggestion =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).original === "string" &&
      typeof (item as Record<string, unknown>).suggested === "string" &&
      typeof (item as Record<string, unknown>).rationale === "string"
  );
}

const REVIEW_PROMPT = `You are a writing assistant reviewing a markdown document. Analyze the document and suggest improvements for clarity, grammar, style, and conciseness.

Return your suggestions as a JSON array where each item has:
- "original": the exact text from the document that should be changed (must match character-for-character)
- "suggested": the replacement text
- "rationale": a brief explanation of why this change improves the document

Return ONLY the JSON array, no other text. If there are no suggestions, return an empty array [].

Important: the "original" field must contain the EXACT text from the document — it will be used for text matching.`;

/**
 * Call the Anthropic API to generate editing suggestions for a markdown document.
 */
export async function generateSuggestions(
  markdown: string
): Promise<RawSuggestion[]> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `${REVIEW_PROMPT}\n\nHere is the document to review:\n\n${markdown}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return [];
  }

  return parseSuggestions(textBlock.text);
}
