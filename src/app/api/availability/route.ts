import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAvailabilitySchema, queryAvailabilitySchema } from "@/lib/schemas/availability";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = queryAvailabilitySchema.safeParse({
    providerId: searchParams.get("providerId"),
    dayOfWeek: searchParams.get("dayOfWeek"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (parsed.data.providerId) where.providerId = parsed.data.providerId;
  if (parsed.data.dayOfWeek !== undefined) where.dayOfWeek = parsed.data.dayOfWeek;

  const availabilities = await db.availability.findMany({
    where,
    include: {
      provider: { include: { user: { select: { name: true } } } },
    },
    orderBy: [{ providerId: "asc" }, { dayOfWeek: "asc" }],
  });

  return NextResponse.json(availabilities);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createAvailabilitySchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json({ error: issue?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await db.availability.findUnique({
    where: {
      providerId_dayOfWeek: {
        providerId: parsed.data.providerId,
        dayOfWeek: parsed.data.dayOfWeek,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Availability for this day already exists" },
      { status: 409 },
    );
  }

  const availability = await db.availability.create({
    data: {
      providerId: parsed.data.providerId,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      isActive: parsed.data.isActive ?? true,
    },
    include: {
      provider: { include: { user: { select: { name: true } } } },
    },
  });

  return NextResponse.json(availability, { status: 201 });
}
