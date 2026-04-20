import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Default URL patterns for issue trackers.
 * Users can customize these via localStorage key "issueLinker:patterns".
 */
const DEFAULT_PATTERNS: Record<string, string> = {
  JIRA: "https://jira.example.com/browse/{ref}",
  GH: "https://github.com/org/repo/issues/{num}",
  "#": "https://github.com/org/repo/issues/{num}",
};

/**
 * Load user-configured patterns from localStorage, falling back to defaults.
 */
function getPatterns(): Record<string, string> {
  if (typeof window === "undefined") return DEFAULT_PATTERNS;
  try {
    const stored = localStorage.getItem("issueLinker:patterns");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed === "object" && parsed !== null) {
        return { ...DEFAULT_PATTERNS, ...parsed };
      }
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_PATTERNS;
}

/**
 * Build a URL from a pattern and a matched reference.
 * Pattern placeholders: {ref} = full reference (e.g. JIRA-123), {num} = number only
 */
function buildUrl(pattern: string, fullRef: string, num: string): string {
  return pattern.replace("{ref}", fullRef).replace("{num}", num);
}

/**
 * Regex that matches issue references: JIRA-123, GH-123, #123
 */
const ISSUE_REGEX = /(?:([A-Z]{2,10})-(\d+))|(#(\d+))/g;

const issueLinkerPluginKey = new PluginKey("issueLinker");

/**
 * Tiptap extension that detects issue references (JIRA-123, GH-123, #123)
 * and renders them as clickable links using ProseMirror decorations.
 */
export const IssueLinker = Extension.create({
  name: "issueLinker",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: issueLinkerPluginKey,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc);
          },
          apply(tr, oldSet) {
            if (tr.docChanged) {
              return buildDecorations(tr.doc);
            }
            return oldSet;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function buildDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  const patterns = getPatterns();

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text = node.text || "";
    let match: RegExpExecArray | null;
    ISSUE_REGEX.lastIndex = 0;

    while ((match = ISSUE_REGEX.exec(text)) !== null) {
      const start = pos + match.index;
      const fullMatch = match[0];
      const end = start + fullMatch.length;

      let url: string | null = null;

      if (match[1] && match[2]) {
        // Named prefix like JIRA-123 or GH-123
        const prefix = match[1];
        const num = match[2];
        const pattern = patterns[prefix] || patterns.JIRA;
        url = buildUrl(pattern, fullMatch, num);
      } else if (match[3] && match[4]) {
        // Hash reference like #123
        const num = match[4];
        const pattern = patterns["#"] || DEFAULT_PATTERNS["#"];
        url = buildUrl(pattern, fullMatch, num);
      }

      if (url) {
        decorations.push(
          Decoration.inline(start, end, {
            nodeName: "a",
            href: url,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "issue-link",
            style:
              "color: #0075de; text-decoration: underline; text-decoration-style: dotted; cursor: pointer;",
          })
        );
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export default IssueLinker;
