import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/templates/marketplace
 * Returns all published community templates.
 */
export async function GET() {
  const templates = await prisma.customTemplate.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      content: true,
      ownerId: true,
      createdAt: true,
    },
  });
  return NextResponse.json(templates);
}
