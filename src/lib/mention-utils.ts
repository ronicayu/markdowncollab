/**
 * Mention format: @[Display Name](user-id)
 * Similar to markdown link syntax for easy parsing.
 */

export interface ParsedMention {
  name: string;
  id: string;
  fullMatch: string;
}

export interface MentionTextPart {
  type: "text" | "mention";
  content: string;
  userId?: string;
}

const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Format a user name and ID into mention syntax.
 */
export function formatMention(name: string, id: string): string {
  return `@[${name}](${id})`;
}

/**
 * Parse all mentions from a text string.
 */
export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, "g");

  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      name: match[1],
      id: match[2],
      fullMatch: match[0],
    });
  }

  return mentions;
}

/**
 * Extract unique user IDs from all mentions in a text string.
 */
export function extractMentionedUserIds(text: string): string[] {
  const mentions = parseMentions(text);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const m of mentions) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      ids.push(m.id);
    }
  }
  return ids;
}

/**
 * Split text into parts for rendering — plain text and mention spans.
 */
export function renderMentionText(text: string): MentionTextPart[] {
  const parts: MentionTextPart[] = [];
  const regex = new RegExp(MENTION_REGEX.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mention", content: match[1], userId: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
}

/**
 * Send mention notifications for a comment.
 * Called client-side after a comment with mentions is submitted.
 */
export async function notifyMentions(
  documentId: string,
  commentText: string,
  actorName: string,
  actorId?: string
): Promise<void> {
  const userIds = extractMentionedUserIds(commentText);
  if (userIds.length === 0) return;

  try {
    await fetch("/api/notifications/mentions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, mentionedUserIds: userIds, actorName, actorId }),
    });
  } catch {
    // Silently fail — mentions are best-effort
  }
}
