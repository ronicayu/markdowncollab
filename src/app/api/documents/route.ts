import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const docs = await prisma.document.findMany({
    select: { id: true, title: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  const { title } = await req.json();
  const doc = await prisma.document.create({
    data: { title: title || "Untitled" },
  });
  return NextResponse.json(doc, { status: 201 });
}
