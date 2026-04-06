import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "comment"
  | "reply"
  | "mention"
  | "share"
  | "suggestion";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  documentId: string;
  documentTitle: string;
  actorName: string;
  actorId?: string;
}

export function buildNotificationMessage(
  type: NotificationType,
  actorName: string,
  documentTitle: string
): string {
  switch (type) {
    case "comment":
      return `${actorName} commented on ${documentTitle}`;
    case "reply":
      return `${actorName} replied to your comment on ${documentTitle}`;
    case "share":
      return `${actorName} shared ${documentTitle} with you`;
    case "suggestion":
      return `${actorName} added a suggestion on ${documentTitle}`;
    case "mention":
      return `${actorName} mentioned you in ${documentTitle}`;
    default:
      return `${actorName} updated ${documentTitle}`;
  }
}

export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  const { userId, type, documentId, documentTitle, actorName, actorId } =
    params;

  // Don't notify the actor about their own action
  if (actorId && actorId === userId) return;

  const message = buildNotificationMessage(type, actorName, documentTitle);

  await prisma.notification.create({
    data: {
      userId,
      type,
      documentId,
      documentTitle,
      actorName,
      actorId: actorId ?? null,
      message,
    },
  });
}
