import type { Node as PmNode } from "@tiptap/pm/model";

export interface SearchMatch {
  from: number;
  to: number;
  text: string;
}

/**
 * Escape special regex characters in a string so it can be used as a literal
 * pattern inside a RegExp constructor.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find all occurrences of `query` in a ProseMirror document.
 * Returns an array of { from, to, text } with absolute document positions.
 *
 * `caseSensitive` controls whether matching respects letter case.
 */
export function findTextMatches(
  doc: PmNode,
  query: string,
  caseSensitive: boolean
): SearchMatch[] {
  if (!query) return [];

  const matches: SearchMatch[] = [];
  const flags = caseSensitive ? "g" : "gi";
  const regex = new RegExp(escapeRegex(query), flags);

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(node.text)) !== null) {
      matches.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
        text: match[0],
      });
    }
  });

  return matches;
}
