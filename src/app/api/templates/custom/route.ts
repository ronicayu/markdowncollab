import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const templates = await prisma.customTemplate.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      content: true,
      published: true,
      createdAt: true,
    },
  });
  return NextResponse.json(templates);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const body = await req.json();
  const { id, published } = body;

  if (!id || typeof published !== "boolean") {
    return NextResponse.json({ error: "Missing id or published" }, { status: 400 });
  }

  // Ensure template belongs to user
  const template = await prisma.customTemplate.findFirst({
    where: { id, ownerId: userId },
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.customTemplate.update({
    where: { id },
    data: { published },
  });

  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const body = await req.json();
  const { name, description, content } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const template = await prisma.customTemplate.create({
    data: {
      name: name.trim(),
      description: (description || "").trim(),
      content,
      ownerId: userId,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
