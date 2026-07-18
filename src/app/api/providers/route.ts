import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { queryProvidersSchema } from "@/lib/schemas/provider";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = queryProvidersSchema.safeParse({
    isActive: searchParams.get("isActive"),
    specialty: searchParams.get("specialty"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (parsed.data.isActive !== undefined) where.isActive = parsed.data.isActive;
  if (parsed.data.specialty) where.specialty = parsed.data.specialty;

  const providers = await db.provider.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(providers);
}
