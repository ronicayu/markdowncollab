import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reminders = await prisma.reminder.findMany({
    where: { userId, dismissed: false },
    orderBy: { remindAt: "asc" },
  });

  return NextResponse.json(reminders);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { documentId, remindAt, message } = body;

  if (!documentId || !remindAt) {
    return NextResponse.json(
      { error: "documentId and remindAt are required" },
      { status: 400 }
    );
  }

  const parsedDate = new Date(remindAt);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const reminder = await prisma.reminder.create({
    data: {
      documentId,
      userId,
      remindAt: parsedDate,
      message: message || "",
    },
  });

  return NextResponse.json(reminder, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Verify ownership
  const reminder = await prisma.reminder.findFirst({
    where: { id, userId },
  });
  if (!reminder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.reminder.update({
    where: { id },
    data: { dismissed: true },
  });

  return NextResponse.json({ ok: true });
}
