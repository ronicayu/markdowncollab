export interface Suggestion {
  id: string;
  documentId: string;
  authorName: string;
  authorType: "human" | "agent";
  originalText: string;
  suggestedText: string;
  rationale: string;
  status: "pending" | "accepted" | "rejected" | "stale";
  startRelPos: Uint8Array;
  endRelPos: Uint8Array;
  contentHash: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Comment {
  id: string;
  documentId: string;
  authorName: string;
  authorType: "human" | "agent";
  content: string;
  startRelPos: Uint8Array;
  endRelPos: Uint8Array;
  parentCommentId: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface Collaborator {
  name: string;
  color: string;
  type: "human" | "agent";
}
