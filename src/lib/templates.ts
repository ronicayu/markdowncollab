export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  content: string;
}

export const templates: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start from scratch",
    icon: "📄",
    content: "",
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Agenda, discussion, and action items",
    icon: "📋",
    content: `# Meeting Notes

**Date:** {{date}}
**Attendees:**

## Agenda

1.

## Discussion



## Action Items

- [ ]
`,
  },
  {
    id: "adr",
    name: "ADR",
    description: "Architecture Decision Record",
    icon: "🏗️",
    content: `# ADR: [Title]

**Date:** {{date}}
**Status:** Proposed

## Context

[What is the issue that we're seeing that is motivating this decision?]

## Decision

[What is the change that we're proposing and/or doing?]

## Consequences

[What becomes easier or more difficult to do because of this change?]
`,
  },
  {
    id: "rfc",
    name: "RFC",
    description: "Request for Comments",
    icon: "💬",
    content: `# RFC: [Title]

**Author:**
**Date:** {{date}}
**Status:** Draft

## Summary

[One-paragraph summary of the proposal.]

## Motivation

[Why are we doing this? What problem does it solve?]

## Detailed Design

[Explain the design in enough detail for someone familiar with the codebase to understand.]

## Alternatives Considered

[What other approaches were considered and why were they not chosen?]

## Open Questions

-
`,
  },
  {
    id: "standup",
    name: "Standup Update",
    description: "Yesterday, today, blockers",
    icon: "🧍",
    content: `# Standup — {{date}}

## Yesterday

-

## Today

-

## Blockers

-
`,
  },
  {
    id: "project-brief",
    name: "Project Brief",
    description: "Objective, scope, timeline, stakeholders",
    icon: "🎯",
    content: `# Project Brief: [Title]

**Date:** {{date}}
**Owner:**

## Objective

[What are we trying to achieve?]

## Scope

[What is included and excluded?]

## Timeline

| Milestone | Date |
| --------- | ---- |
|           |      |

## Stakeholders

-

## Risks

-
`,
  },
  {
    id: "bug-report",
    name: "Bug Report",
    description: "Steps to reproduce, expected vs actual",
    icon: "🐛",
    content: `# Bug Report: [Title]

**Date:** {{date}}
**Severity:** [Critical / High / Medium / Low]
**Reporter:**

## Summary

[Brief description of the bug.]

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

[What should happen?]

## Actual Behavior

[What actually happens?]

## Environment

- Browser:
- OS:
- Version:
`,
  },
];

export function getTemplateById(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function substituteVariables(content: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return content.replace(/\{\{date\}\}/g, today);
}
