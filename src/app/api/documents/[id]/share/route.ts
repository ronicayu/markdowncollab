import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { logActivity } from "@/lib/activity-log";
import { fireWebhook } from "@/lib/webhook";

async function getSessionInfo() {
  const session = await getServerSession(authOptions);
  return {
    userId: (session?.user as any)?.id as string | undefined,
    userEmail: session?.user?.email ?? undefined,
    userName: session?.user?.name ?? "Unknown",
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Only the document owner can view shares" }, { status: 403 });
  }

  const shares = await prisma.documentShare.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(shares);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, userEmail, userName } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Only the document owner can share" }, { status: 403 });
  }

  const { email, role } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!["viewer", "editor"].includes(role)) {
    return NextResponse.json({ error: "Role must be viewer or editor" }, { status: 400 });
  }

  try {
    const share = await prisma.documentShare.create({
      data: {
        documentId: id,
        email: email.toLowerCase(),
        role,
      },
    });

    // Log share activity
    await logActivity(
      id,
      userId ?? null,
      userName,
      "shared",
      `Shared with ${email} as ${role}`
    );

    // Fire webhook for document share
    if (userId) {
      fireWebhook(userId, "document.shared", {
        documentId: id,
        data: { email, role },
      });
    }

    return NextResponse.json(share, { status: 201 });
  } catch (error: any) {
    // Prisma unique constraint violation
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "This document is already shared with that email" },
        { status: 409 }
      );
    }
    throw error;
  }
}
