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

export interface CommentReply {
  id: string;
  text: string;
  author: string;
  createdAt: string;
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
  replies?: CommentReply[];
}

export interface Collaborator {
  name: string;
  color: string;
  type: "human" | "agent";
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  title: string;
  createdByName: string | null;
  type: "auto" | "manual" | "restore";
  createdAt: string;
}

export interface VersionPreview extends DocumentVersion {
  markdown: string;
}

export interface VersionListResponse {
  versions: DocumentVersion[];
  total: number;
  page: number;
  pageSize: number;
}
