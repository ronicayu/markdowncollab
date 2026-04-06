import { prisma } from "@/lib/prisma";

export interface AccessResult {
  hasAccess: boolean;
  role: "owner" | "editor" | "viewer" | null;
}

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/**
 * Check if a user has access to a document.
 * Priority: owner > explicit share (userId, then email) > share token > visibility fallback > legacy (no owner).
 * If requiredRole is specified, the user's resolved role must be >= requiredRole in the hierarchy.
 */
export async function checkDocumentAccess(
  documentId: string,
  userId: string | null | undefined,
  userEmail: string | null | undefined,
  shareToken?: string | null,
  requiredRole?: "viewer" | "editor" | "owner"
): Promise<AccessResult> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    return { hasAccess: false, role: null };
  }

  // Legacy documents with no owner are accessible to all authenticated users
  if (!doc.ownerId) {
    return { hasAccess: true, role: "editor" };
  }

  // Document owner gets full access
  if (userId && doc.ownerId === userId) {
    return { hasAccess: true, role: "owner" };
  }

  // Check explicit share by userId
  if (userId) {
    const shareByUser = await prisma.documentShare.findFirst({
      where: { documentId, userId },
    });
    if (shareByUser) {
      return meetsRequiredRole(shareByUser.role as AccessResult["role"], requiredRole);
    }
  }

  // Check explicit share by email
  if (userEmail) {
    const shareByEmail = await prisma.documentShare.findFirst({
      where: { documentId, email: userEmail.toLowerCase() },
    });
    if (shareByEmail) {
      return meetsRequiredRole(shareByEmail.role as AccessResult["role"], requiredRole);
    }
  }

  // Check share token
  if (shareToken) {
    const shareByToken = await prisma.documentShare.findFirst({
      where: { documentId, shareToken },
    });
    if (shareByToken) {
      return meetsRequiredRole(shareByToken.role as AccessResult["role"], requiredRole);
    }
  }

  // Fallback: anyone_with_link visibility grants viewer access, but only to authenticated users
  if (doc.visibility === "anyone_with_link" && userId) {
    return meetsRequiredRole("viewer", requiredRole);
  }

  return { hasAccess: false, role: null };
}

function meetsRequiredRole(
  resolvedRole: AccessResult["role"],
  requiredRole?: "viewer" | "editor" | "owner"
): AccessResult {
  if (!resolvedRole) {
    return { hasAccess: false, role: null };
  }
  if (!requiredRole) {
    return { hasAccess: true, role: resolvedRole };
  }
  const has = ROLE_HIERARCHY[resolvedRole] ?? 0;
  const needs = ROLE_HIERARCHY[requiredRole] ?? 0;
  return { hasAccess: has >= needs, role: resolvedRole };
}
