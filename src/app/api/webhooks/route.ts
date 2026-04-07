import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id ?? null;
}

/**
 * GET /api/webhooks — list all webhooks for the authenticated user.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhooks = await prisma.webhook.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(webhooks);
}

/**
 * POST /api/webhooks — create a new webhook.
 * Body: { url: string, events: string }
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { url, events } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    new URL(url); // Validate URL format
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const eventsStr = typeof events === "string" ? events : "*";

  const webhook = await prisma.webhook.create({
    data: {
      url,
      events: eventsStr,
      ownerId: userId,
    },
  });

  return NextResponse.json(webhook, { status: 201 });
}

/**
 * DELETE /api/webhooks — delete a webhook by id.
 * Body: { id: string }
 */
export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Ensure the webhook belongs to this user
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook || webhook.ownerId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.webhook.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
