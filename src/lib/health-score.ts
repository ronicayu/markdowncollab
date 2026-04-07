/**
 * Document Health Score — readability and completeness metrics.
 */

export interface HealthMetrics {
  fleschReadingEase: number;
  avgSentenceLength: number;
  hasHeadings: boolean;
  hasLinks: boolean;
  wordCountAppropriate: boolean;
  wordCount: number;
  templateCompleteness: number | null; // 0-100 or null if not template-based
}

export interface HealthScore {
  score: number; // 0-100
  metrics: HealthMetrics;
  color: "red" | "amber" | "green";
}

/**
 * Count syllables in an English word (heuristic).
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;

  // Count vowel groups
  const vowelGroups = w.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Subtract silent e at end
  if (w.endsWith("e") && !w.endsWith("le") && count > 1) {
    count--;
  }

  // Common suffixes that add syllables
  if (w.endsWith("tion") || w.endsWith("sion")) {
    // already counted by vowel groups
  }

  return Math.max(1, count);
}

/**
 * Split text into sentences (basic heuristic).
 */
export function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or end
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences.length > 0 ? sentences : [text].filter((s) => s.trim().length > 0);
}

/**
 * Extract words from text, stripping markdown syntax.
 */
export function extractWords(text: string): string[] {
  // Strip markdown syntax
  const cleaned = text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
    .replace(/[*_~`]/g, "") // emphasis
    .replace(/^\s*[-*+]\s+/gm, "") // list markers
    .replace(/^\s*\d+\.\s+/gm, "") // numbered list markers
    .replace(/^\s*>\s+/gm, "") // blockquotes
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`[^`]+`/g, ""); // inline code

  return cleaned
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-zA-Z]/.test(w));
}

/**
 * Known template sections keyed by template ID.
 */
const TEMPLATE_SECTIONS: Record<string, string[]> = {
  "meeting-notes": ["Agenda", "Discussion", "Action Items"],
  adr: ["Context", "Decision", "Consequences"],
  "project-brief": ["Objective", "Scope", "Timeline", "Stakeholders"],
  "bug-report": ["Steps to Reproduce", "Expected Behavior", "Actual Behavior"],
  retrospective: ["What went well", "What didn't go well", "Action items"],
};

/**
 * Calculate health score for a document.
 */
export function calculateHealthScore(
  text: string,
  templateId?: string
): HealthScore {
  const words = extractWords(text);
  const wordCount = words.length;

  // For blank/near-blank docs, return a minimal score
  if (wordCount < 3) {
    return {
      score: 0,
      metrics: {
        fleschReadingEase: 0,
        avgSentenceLength: 0,
        hasHeadings: false,
        hasLinks: false,
        wordCountAppropriate: false,
        wordCount,
        templateCompleteness: templateId ? 0 : null,
      },
      color: "red",
    };
  }

  const sentences = splitSentences(text);
  const sentenceCount = Math.max(1, sentences.length);
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  // Flesch Reading Ease
  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / wordCount;
  const fleschReadingEase = Math.max(
    0,
    Math.min(100, 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord)
  );

  // Structure checks
  const hasHeadings = /^#{1,6}\s+.+/m.test(text);
  const hasLinks = /\[.+?\]\(.+?\)/.test(text) || /https?:\/\/\S+/.test(text);
  const wordCountAppropriate = wordCount >= 50;

  // Template completeness
  let templateCompleteness: number | null = null;
  if (templateId && TEMPLATE_SECTIONS[templateId]) {
    const expectedSections = TEMPLATE_SECTIONS[templateId];
    const presentCount = expectedSections.filter((section) => {
      const regex = new RegExp(`^#+\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "im");
      return regex.test(text);
    }).length;
    templateCompleteness = Math.round((presentCount / expectedSections.length) * 100);
  }

  // Weighted score calculation
  // Flesch: 30%, sentence length: 15%, headings: 15%, links: 10%, word count: 15%, template: 15%
  const fleschScore = fleschReadingEase; // already 0-100
  const sentenceLengthScore =
    avgSentenceLength <= 20 ? 100 : avgSentenceLength <= 30 ? 60 : 20;
  const headingsScore = hasHeadings ? 100 : 0;
  const linksScore = hasLinks ? 100 : 0;
  const wordCountScore = wordCountAppropriate ? 100 : Math.min(100, (wordCount / 50) * 100);

  let score: number;
  if (templateCompleteness !== null) {
    score =
      fleschScore * 0.25 +
      sentenceLengthScore * 0.1 +
      headingsScore * 0.15 +
      linksScore * 0.1 +
      wordCountScore * 0.15 +
      templateCompleteness * 0.25;
  } else {
    score =
      fleschScore * 0.3 +
      sentenceLengthScore * 0.15 +
      headingsScore * 0.2 +
      linksScore * 0.1 +
      wordCountScore * 0.25;
  }

  score = Math.round(Math.max(0, Math.min(100, score)));

  const color: "red" | "amber" | "green" =
    score < 50 ? "red" : score < 75 ? "amber" : "green";

  return {
    score,
    metrics: {
      fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      hasHeadings,
      hasLinks,
      wordCountAppropriate,
      wordCount,
      templateCompleteness,
    },
    color,
  };
}
