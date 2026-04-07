import { prisma } from "@/lib/prisma";

interface WebhookPayload {
  event: string;
  documentId?: string;
  documentTitle?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/**
 * Fire webhooks for a given user and event.
 * Fire-and-forget: does not await, does not fail on error.
 */
export function fireWebhook(
  userId: string,
  event: string,
  payload: Omit<WebhookPayload, "event" | "timestamp">
) {
  const fullPayload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  // Fire and forget — do not await
  void (async () => {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: {
          ownerId: userId,
          active: true,
        },
      });

      for (const webhook of webhooks) {
        // Check if this webhook is subscribed to this event
        const subscribedEvents = webhook.events.split(",").map((e) => e.trim());
        if (!subscribedEvents.includes(event) && !subscribedEvents.includes("*")) {
          continue;
        }

        // Fire-and-forget POST
        fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fullPayload),
        }).catch(() => {
          // Silently ignore errors — webhook delivery is best-effort
        });
      }
    } catch {
      // Silently ignore errors
    }
  })();
}
