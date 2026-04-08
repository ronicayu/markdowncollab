import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json([], { status: 200 });

  const pins = await prisma.documentPin.findMany({
    where: { userId },
    select: { documentId: true },
  });

  return NextResponse.json(pins);
}
