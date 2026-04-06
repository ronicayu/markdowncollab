# Context-Aware AI Agent

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P2 — Differentiator enhancement

## Problem

The AI agent gives the same generic writing suggestions regardless of document type. A meeting notes document needs different feedback than an ADR or bug report. The agent should understand context and tailor suggestions accordingly.

## Design

### Approach

Enhance the agent prompt in `src/lib/agent.ts` to include document metadata: the template type (if created from a template) and the document title. Use this context to generate type-appropriate suggestions.

### Data Model Change

Add `templateId` field to Document model:

```prisma
model Document {
  id         String          @id @default(uuid())
  title      String          @default("Untitled")
  ownerId    String?
  visibility String          @default("private")
  templateId String?                              // Template used at creation
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
  shares     DocumentShare[]
  versions   DocumentVersion[]
}
```

### Template Persistence

When a document is created with a template (POST /api/documents with templateId), store the templateId on the Document record. This enables the agent to know what kind of document it's reviewing.

### Enhanced Agent Prompt

Current prompt (generic):
> "Review this markdown document for clarity, grammar, style, and conciseness."

New prompt (context-aware):
```
You are reviewing a ${templateContext} document titled "${title}".

${templateGuidance}

Review for:
1. Clarity and readability
2. Grammar and style
3. Completeness — are any expected sections missing or empty?
4. Actionability — are action items, decisions, or next steps clear?

Return suggestions as JSON array...
```

Template-specific guidance:

| Template | Guidance |
|----------|----------|
| meeting-notes | "Focus on action items being specific and assigned. Flag vague decisions." |
| adr | "Verify the decision is clearly stated, context is sufficient, and consequences are honest about trade-offs." |
| rfc | "Check that the motivation is compelling, the design is detailed enough to implement, and alternatives are fairly evaluated." |
| standup | "Ensure blockers are clearly stated. Flag items that lack specificity." |
| project-brief | "Verify scope is bounded, timeline is realistic, and risks are identified." |
| bug-report | "Check that steps to reproduce are specific and the expected vs actual behavior is clear." |
| (none/blank) | "Review for general writing quality — clarity, grammar, style, conciseness." |

### Implementation

Modify `src/lib/agent.ts`:
1. Accept `templateId` and `title` as parameters to `generateSuggestions()`
2. Look up template metadata from `templates.ts`
3. Build context-aware prompt
4. Return suggestions as before (same JSON format)

Modify `src/app/api/agent/invite/route.ts`:
1. Fetch the document's `templateId` and `title` from Prisma
2. Pass to `generateSuggestions()`

### No New UI

The agent invocation flow stays the same — click "Invite Agent", get suggestions. The only difference is the quality of suggestions is better because the prompt has context.

## Team Debate Notes

**SWE 2 challenged:** "Is this worth a schema change? Can't we just infer the template from content?"
**SWE 1 response:** "Inference is unreliable. A document might start from a template and diverge. Storing the templateId at creation is explicit and costs nothing."
**Consensus:** Store templateId. It's one field.

**PM challenged:** "Should we show the user what context the agent is using?"
**SWE 1 response:** "Good idea but scope creep. The agent's rationale field already explains each suggestion. Adding a 'reviewing as Meeting Notes' badge is nice-to-have."
**Consensus:** No UI change. The improved suggestions speak for themselves.

## Testing Strategy

- Unit test prompt generation for each template type
- Unit test with no template (falls back to generic)
- Integration test: create doc with template, invite agent, verify suggestions reference template context
