import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateAvailabilitySchema } from "@/lib/schemas/availability";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateAvailabilitySchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json({ error: issue?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await db.availability.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.startTime !== undefined) data.startTime = parsed.data.startTime;
  if (parsed.data.endTime !== undefined) data.endTime = parsed.data.endTime;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

  const availability = await db.availability.update({
    where: { id },
    data,
    include: {
      provider: { include: { user: { select: { name: true } } } },
    },
  });

  return NextResponse.json(availability);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.availability.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.availability.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
