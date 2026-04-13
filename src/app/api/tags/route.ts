import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(tags);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, color } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
  }
  const trimmed = name.trim();

  // Check if tag already exists (case-insensitive for SQLite)
  const existing = await prisma.tag.findFirst({
    where: { name: trimmed },
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  const tag = await prisma.tag.create({
    data: {
      name: trimmed,
      color: color || "#6b7280",
    },
  });
  return NextResponse.json(tag, { status: 201 });
}
