import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json([]);

  const documentId = req.nextUrl.searchParams.get("documentId");

  const macros = await prisma.macro.findMany({
    where: {
      OR: [
        { ownerId: userId, documentId: null },
        ...(documentId ? [{ documentId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(macros.map((m) => ({
    ...m,
    steps: JSON.parse(m.steps),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, steps, documentId } = await req.json();
  if (!name || !Array.isArray(steps)) {
    return NextResponse.json({ error: "name and steps required" }, { status: 400 });
  }

  const macro = await prisma.macro.upsert({
    where: { ownerId_name: { ownerId: userId, name } },
    create: { name, steps: JSON.stringify(steps), ownerId: userId, documentId: documentId || null },
    update: { steps: JSON.stringify(steps), documentId: documentId || null },
  });

  return NextResponse.json({ ...macro, steps: JSON.parse(macro.steps) });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.macro.deleteMany({ where: { id, ownerId: userId } });
  return NextResponse.json({ ok: true });
}
