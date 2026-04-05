import * as Y from "yjs";
import type { Suggestion, Comment } from "@/types";

export function getSuggestionMap(ydoc: Y.Doc): Y.Map<string> {
  return ydoc.getMap<string>("suggestions");
}

export function getCommentMap(ydoc: Y.Doc): Y.Map<string> {
  return ydoc.getMap<string>("comments");
}

/** Convert Uint8Array to plain number array for JSON serialization */
function encodeRelPos(pos: Uint8Array): number[] {
  return Array.from(pos);
}

/** Convert plain number array back to Uint8Array */
function decodeRelPos(arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}

interface SerializedSuggestion
  extends Omit<Suggestion, "startRelPos" | "endRelPos"> {
  startRelPos: number[];
  endRelPos: number[];
}

interface SerializedComment
  extends Omit<Comment, "startRelPos" | "endRelPos"> {
  startRelPos: number[];
  endRelPos: number[];
}

export function addSuggestion(ydoc: Y.Doc, suggestion: Suggestion): void {
  const map = getSuggestionMap(ydoc);
  const serialized: SerializedSuggestion = {
    ...suggestion,
    startRelPos: encodeRelPos(suggestion.startRelPos),
    endRelPos: encodeRelPos(suggestion.endRelPos),
  };
  map.set(suggestion.id, JSON.stringify(serialized));
}

export function getSuggestions(ydoc: Y.Doc): Suggestion[] {
  const map = getSuggestionMap(ydoc);
  const results: Suggestion[] = [];
  map.forEach((value: string) => {
    try {
      const parsed: SerializedSuggestion = JSON.parse(value);
      results.push({
        ...parsed,
        startRelPos: decodeRelPos(parsed.startRelPos),
        endRelPos: decodeRelPos(parsed.endRelPos),
      });
    } catch {
      // skip malformed entries
    }
  });
  return results;
}

export function updateSuggestionStatus(
  ydoc: Y.Doc,
  id: string,
  status: Suggestion["status"]
): void {
  const map = getSuggestionMap(ydoc);
  const raw = map.get(id);
  if (!raw) return;
  try {
    const parsed: SerializedSuggestion = JSON.parse(raw);
    parsed.status = status;
    if (status === "accepted" || status === "rejected") {
      parsed.resolvedAt = new Date().toISOString();
    }
    map.set(id, JSON.stringify(parsed));
  } catch {
    // skip malformed entries
  }
}

export function addComment(ydoc: Y.Doc, comment: Comment): void {
  const map = getCommentMap(ydoc);
  const serialized: SerializedComment = {
    ...comment,
    startRelPos: encodeRelPos(comment.startRelPos),
    endRelPos: encodeRelPos(comment.endRelPos),
  };
  map.set(comment.id, JSON.stringify(serialized));
}

export function resolveComment(ydoc: Y.Doc, commentId: string): void {
  const map = getCommentMap(ydoc);
  const raw = map.get(commentId);
  if (!raw) return;
  try {
    const parsed: SerializedComment = JSON.parse(raw);
    parsed.resolved = true;
    map.set(commentId, JSON.stringify(parsed));
  } catch {
    // skip malformed entries
  }
}

export function getComments(ydoc: Y.Doc): Comment[] {
  const map = getCommentMap(ydoc);
  const results: Comment[] = [];
  map.forEach((value: string) => {
    try {
      const parsed: SerializedComment = JSON.parse(value);
      results.push({
        ...parsed,
        startRelPos: decodeRelPos(parsed.startRelPos),
        endRelPos: decodeRelPos(parsed.endRelPos),
      });
    } catch {
      // skip malformed entries
    }
  });
  return results;
}
