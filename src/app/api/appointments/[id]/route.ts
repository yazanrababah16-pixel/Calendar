import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateAppointmentSchema } from "@/lib/schemas/appointment";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const appointment = await db.appointment.findUnique({
    where: { id },
    include: {
      patient: { include: { user: { select: { name: true, email: true } } } },
      provider: { include: { user: { select: { name: true, email: true } } } },
      workflowEvents: {
        select: { id: true, workflowType: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(appointment);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateAppointmentSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json({ error: issue?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.startTime !== undefined) data.startTime = new Date(parsed.data.startTime);
  if (parsed.data.endTime !== undefined) data.endTime = new Date(parsed.data.endTime);

  if (data.startTime && data.endTime && (data.startTime as Date) >= (data.endTime as Date)) {
    return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
  }

  if (data.startTime || data.endTime) {
    const newStart = (data.startTime as Date | undefined) ?? existing.startTime;
    const newEnd = (data.endTime as Date | undefined) ?? existing.endTime;

    const overlapping = await db.appointment.findFirst({
      where: {
        id: { not: id },
        providerId: existing.providerId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        OR: [{ startTime: { lt: newEnd }, endTime: { gt: newStart } }],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: "Updated time slot overlaps with an existing appointment" },
        { status: 409 },
      );
    }
  }

  const appointment = await db.appointment.update({
    where: { id },
    data,
    include: {
      patient: { include: { user: { select: { name: true, email: true } } } },
      provider: { include: { user: { select: { name: true, email: true } } } },
      workflowEvents: {
        select: { id: true, workflowType: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(appointment);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.appointment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
