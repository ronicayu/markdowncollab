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

const TEMPLATE_GUIDANCE: Record<string, { context: string; guidance: string }> = {
  "meeting-notes": {
    context: "meeting notes",
    guidance: "Focus on action items being specific and assigned. Flag vague decisions. Ensure attendees and date are filled in.",
  },
  adr: {
    context: "architecture decision record",
    guidance: "Verify the decision is clearly stated, context is sufficient, and consequences are honest about trade-offs.",
  },
  rfc: {
    context: "RFC (Request for Comments)",
    guidance: "Check that the motivation is compelling, the design is detailed enough to implement, and alternatives are fairly evaluated.",
  },
  standup: {
    context: "standup update",
    guidance: "Ensure blockers are clearly stated. Flag items that lack specificity.",
  },
  "project-brief": {
    context: "project brief",
    guidance: "Verify scope is bounded, timeline is realistic, and risks are identified.",
  },
  "bug-report": {
    context: "bug report",
    guidance: "Check that steps to reproduce are specific and the expected vs actual behavior is clear.",
  },
};

export type WritingTone = "formal" | "casual" | "technical" | "friendly";

interface PromptContext {
  templateId?: string | null;
  title?: string | null;
  tone?: WritingTone | null;
}

/**
 * Build a context-aware review prompt based on document template and title.
 */
export function buildReviewPrompt(markdown: string, context: PromptContext): string {
  const template = context.templateId ? TEMPLATE_GUIDANCE[context.templateId] : null;

  const docType = template ? template.context : "document";
  const titleLine = context.title ? ` titled "${context.title}"` : "";
  const guidanceLine = template
    ? template.guidance
    : "Review for general writing quality — clarity, grammar, style, conciseness.";

  const toneLine = context.tone ? `Write in a ${context.tone} tone.\n\n` : "";

  return `${toneLine}You are a writing assistant reviewing a ${docType}${titleLine}.

${guidanceLine}

Review for:
1. Clarity and readability
2. Grammar and style
3. Completeness — are any expected sections missing or empty?
4. Actionability — are action items, decisions, or next steps clear?

Return your suggestions as a JSON array where each item has:
- "original": the exact text from the document that should be changed (must match character-for-character)
- "suggested": the replacement text
- "rationale": a brief explanation of why this change improves the document

Return ONLY the JSON array, no other text. If there are no suggestions, return an empty array [].

Important: the "original" field must contain the EXACT text from the document — it will be used for text matching.

Here is the document to review:

${markdown}`;
}

/**
 * Call the Anthropic API to generate editing suggestions for a markdown document.
 */
export async function generateSuggestions(
  markdown: string,
  context?: PromptContext
): Promise<RawSuggestion[]> {
  const client = new Anthropic();
  const prompt = buildReviewPrompt(markdown, context || {});

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return [];
  }

  return parseSuggestions(textBlock.text);
}
