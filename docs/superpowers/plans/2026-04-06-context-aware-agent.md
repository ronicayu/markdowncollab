# Context-Aware AI Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make AI agent suggestions context-aware by incorporating document template type and title into the review prompt.

**Architecture:** Add templateId to Document schema. Enhance agent prompt with template-specific guidance. Pass context from invite API to generateSuggestions().

**Tech Stack:** Prisma, Anthropic Claude API

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `templateId` field to Document model |
| `src/lib/agent.ts` | Modify — accept `templateId` and `title` params, build context-aware prompt |
| `src/lib/__tests__/agent.test.ts` | New — unit tests for prompt generation per template type |
| `src/app/api/agent/invite/route.ts` | Modify — fetch document metadata, pass context to generateSuggestions |
| `src/app/api/documents/route.ts` | Modify — store templateId when creating a document |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add templateId field to the Document model**

In `prisma/schema.prisma`, find the Document model and add `templateId` after the `visibility` field:

Find:
```prisma
  visibility String             @default("private")
  createdAt  DateTime           @default(now())
```

Replace with:
```prisma
  visibility String             @default("private")
  templateId String?
  createdAt  DateTime           @default(now())
```

- [ ] **Step 2: Run the migration**

```bash
cd /Users/ronica/projects/markdown-collab
npx prisma migrate dev --name add-template-id-to-document
```

- [ ] **Step 3: Verify the migration applied**

```bash
cd /Users/ronica/projects/markdown-collab
npx prisma db push --accept-data-loss 2>&1 | tail -5
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add templateId field to Document model"
```

---

## Task 2: Enhance Agent Prompt with Template Context (TDD)

**Files:**
- New: `src/lib/__tests__/agent.test.ts`
- Modify: `src/lib/agent.ts`

- [ ] **Step 1: Write the test file**

Create `src/lib/__tests__/agent.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildReviewPrompt, parseSuggestions } from "../agent";

describe("buildReviewPrompt", () => {
  it("builds a generic prompt when no template is provided", () => {
    const prompt = buildReviewPrompt("Some document text", {});
    expect(prompt).toContain("Review for:");
    expect(prompt).toContain("general writing quality");
    expect(prompt).toContain("Some document text");
  });

  it("includes meeting-notes guidance when templateId is meeting-notes", () => {
    const prompt = buildReviewPrompt("Meeting content", {
      templateId: "meeting-notes",
      title: "Sprint Planning",
    });
    expect(prompt).toContain("meeting notes");
    expect(prompt).toContain("Sprint Planning");
    expect(prompt).toContain("action items");
  });

  it("includes ADR guidance when templateId is adr", () => {
    const prompt = buildReviewPrompt("ADR content", {
      templateId: "adr",
      title: "Use PostgreSQL",
    });
    expect(prompt).toContain("architecture decision record");
    expect(prompt).toContain("Use PostgreSQL");
    expect(prompt).toContain("decision is clearly stated");
  });

  it("includes RFC guidance when templateId is rfc", () => {
    const prompt = buildReviewPrompt("RFC content", {
      templateId: "rfc",
      title: "New API Design",
    });
    expect(prompt).toContain("RFC");
    expect(prompt).toContain("New API Design");
    expect(prompt).toContain("motivation");
  });

  it("includes standup guidance when templateId is standup", () => {
    const prompt = buildReviewPrompt("Standup content", {
      templateId: "standup",
      title: "Daily Standup",
    });
    expect(prompt).toContain("standup");
    expect(prompt).toContain("blockers");
  });

  it("includes project-brief guidance when templateId is project-brief", () => {
    const prompt = buildReviewPrompt("Brief content", {
      templateId: "project-brief",
      title: "Q2 Roadmap",
    });
    expect(prompt).toContain("project brief");
    expect(prompt).toContain("scope");
  });

  it("includes bug-report guidance when templateId is bug-report", () => {
    const prompt = buildReviewPrompt("Bug content", {
      templateId: "bug-report",
      title: "Login Crash",
    });
    expect(prompt).toContain("bug report");
    expect(prompt).toContain("steps to reproduce");
  });

  it("falls back to generic for unknown template", () => {
    const prompt = buildReviewPrompt("Content", {
      templateId: "unknown-template",
      title: "Some Doc",
    });
    expect(prompt).toContain("general writing quality");
  });

  it("includes title when provided without template", () => {
    const prompt = buildReviewPrompt("Content", { title: "My Document" });
    expect(prompt).toContain("My Document");
  });
});

describe("parseSuggestions", () => {
  it("parses valid JSON array", () => {
    const json = JSON.stringify([
      { original: "foo", suggested: "bar", rationale: "better" },
    ]);
    const result = parseSuggestions(json);
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("foo");
  });

  it("parses JSON inside code fences", () => {
    const text = '```json\n[{"original":"a","suggested":"b","rationale":"c"}]\n```';
    const result = parseSuggestions(text);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseSuggestions("not json")).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(parseSuggestions("[]")).toEqual([]);
  });

  it("filters out malformed items", () => {
    const json = JSON.stringify([
      { original: "foo", suggested: "bar", rationale: "ok" },
      { original: "missing" },
    ]);
    const result = parseSuggestions(json);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests (should fail for buildReviewPrompt — function doesn't exist yet)**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/agent.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Update agent.ts to add buildReviewPrompt and modify generateSuggestions**

Replace the contents of `src/lib/agent.ts` with:

```typescript
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

interface DocumentContext {
  templateId?: string;
  title?: string;
}

const TEMPLATE_GUIDANCE: Record<string, { label: string; guidance: string }> = {
  "meeting-notes": {
    label: "meeting notes",
    guidance:
      "Focus on action items being specific and assigned. Flag vague decisions. Check that attendees, date, and agenda are present.",
  },
  adr: {
    label: "architecture decision record",
    guidance:
      "Verify the decision is clearly stated, context is sufficient, and consequences are honest about trade-offs.",
  },
  rfc: {
    label: "RFC",
    guidance:
      "Check that the motivation is compelling, the design is detailed enough to implement, and alternatives are fairly evaluated.",
  },
  standup: {
    label: "standup update",
    guidance:
      "Ensure blockers are clearly stated. Flag items that lack specificity. Yesterday/today items should be concrete.",
  },
  "project-brief": {
    label: "project brief",
    guidance:
      "Verify scope is bounded, timeline is realistic, and risks are identified. Check that the objective is measurable.",
  },
  "bug-report": {
    label: "bug report",
    guidance:
      "Check that steps to reproduce are specific and the expected vs actual behavior is clear. Severity should match the description.",
  },
};

/**
 * Build a context-aware review prompt based on document metadata.
 */
export function buildReviewPrompt(
  markdown: string,
  context: DocumentContext
): string {
  const { templateId, title } = context;
  const template = templateId ? TEMPLATE_GUIDANCE[templateId] : undefined;

  const docDescription = template
    ? `a ${template.label} document`
    : "a document";
  const titleLine = title ? ` titled "${title}"` : "";
  const guidanceLine = template
    ? template.guidance
    : "Review for general writing quality — clarity, grammar, style, conciseness.";

  return `You are a writing assistant reviewing ${docDescription}${titleLine}.

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
  context: DocumentContext = {}
): Promise<RawSuggestion[]> {
  const client = new Anthropic();

  const prompt = buildReviewPrompt(markdown, context);

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
```

- [ ] **Step 4: Run tests (should pass)**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/agent.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/lib/agent.ts src/lib/__tests__/agent.test.ts
git commit -m "feat: add context-aware review prompt with template-specific guidance"
```

---

## Task 3: Pass Context from Invite API to Agent

**Files:**
- Modify: `src/app/api/agent/invite/route.ts`

- [ ] **Step 1: Fetch document metadata and pass to generateSuggestions**

In `src/app/api/agent/invite/route.ts`, add a Prisma import and fetch the document metadata. Find this block (around line 90-94):

```typescript
    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }
```

After that block, add a Prisma import at the top of the file (add after the existing imports):

```typescript
import { prisma } from "@/lib/prisma";
```

Then, after the `documentId` validation block and before the API key check, add:

```typescript
    // Fetch document metadata for context-aware prompting
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { title: true, templateId: true },
    });
```

- [ ] **Step 2: Pass context to generateSuggestions**

Find this line (around line 132):

```typescript
    const rawSuggestions = await generateSuggestions(plainText);
```

Replace with:

```typescript
    const rawSuggestions = await generateSuggestions(plainText, {
      templateId: document?.templateId ?? undefined,
      title: document?.title ?? undefined,
    });
```

- [ ] **Step 3: Run the full test suite**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/app/api/agent/invite/route.ts
git commit -m "feat: pass document template and title context to AI agent"
```

---

## Task 4: Store templateId on Document Creation

**Files:**
- Modify: `src/app/api/documents/route.ts`

- [ ] **Step 1: Read the current documents route**

```bash
cd /Users/ronica/projects/markdown-collab
cat src/app/api/documents/route.ts
```

- [ ] **Step 2: Update the POST handler to store templateId**

In the POST handler of `src/app/api/documents/route.ts`, find the `prisma.document.create` call and add `templateId` to the data object. The templateId should come from the request body (it's already sent by the TemplatePicker when creating a document).

Find the `prisma.document.create` call and add `templateId` to the `data` field:

```typescript
templateId: templateId || null,
```

Make sure to destructure `templateId` from `await req.json()` alongside the existing fields.

- [ ] **Step 3: Run existing document tests**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/app/api/documents/__tests__/route.test.ts 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/app/api/documents/route.ts
git commit -m "feat: persist templateId when creating documents from templates"
```
