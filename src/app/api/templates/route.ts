import { NextResponse } from "next/server";
import { templates } from "@/lib/templates";

export async function GET() {
  const list = templates.map(({ id, name, description, icon }) => ({
    id,
    name,
    description,
    icon,
  }));
  return NextResponse.json(list);
}
