import { prisma } from "@/lib/prisma";

/**
 * Log an activity event for a document.
 */
export async function logActivity(
  documentId: string,
  userId: string | null,
  userName: string,
  action: string,
  detail?: string
) {
  try {
    await prisma.activityLog.create({
      data: {
        documentId,
        userId: userId ?? undefined,
        userName,
        action,
        detail: detail ?? undefined,
      },
    });
  } catch (err) {
    // Non-critical — log and continue
    console.error("Failed to log activity:", err);
  }
}
