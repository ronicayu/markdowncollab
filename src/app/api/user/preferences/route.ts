import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ keyboardOverrides: null }, { status: 200 });
  }

  const pref = await prisma.userPreference.findUnique({ where: { userId } });
  let keyboardOverrides = null;
  if (pref?.keyboardOverrides) {
    try {
      keyboardOverrides = JSON.parse(pref.keyboardOverrides);
    } catch {
      keyboardOverrides = null;
    }
  }

  return NextResponse.json({
    digestFrequency: pref?.digestFrequency ?? "none",
    keyboardOverrides,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { keyboardOverrides } = body;

  const data: Record<string, string> = {};
  if (keyboardOverrides !== undefined) {
    data.keyboardOverrides =
      keyboardOverrides === null ? "" : JSON.stringify(keyboardOverrides);
  }

  const pref = await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  let parsed = null;
  if (pref.keyboardOverrides) {
    try {
      parsed = JSON.parse(pref.keyboardOverrides);
    } catch {
      parsed = null;
    }
  }

  return NextResponse.json({
    digestFrequency: pref.digestFrequency,
    keyboardOverrides: parsed,
  });
}
