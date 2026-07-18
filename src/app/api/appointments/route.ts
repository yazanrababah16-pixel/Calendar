import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAppointmentSchema, queryAppointmentsSchema } from "@/lib/schemas/appointment";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = queryAppointmentsSchema.safeParse({
    providerId: searchParams.get("providerId"),
    patientId: searchParams.get("patientId"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    status: searchParams.get("status"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (parsed.data.providerId) where.providerId = parsed.data.providerId;
  if (parsed.data.patientId) where.patientId = parsed.data.patientId;
  if (parsed.data.status) where.status = parsed.data.status;
  if (parsed.data.dateFrom || parsed.data.dateTo) {
    const startFilter: Record<string, Date> = {};
    if (parsed.data.dateFrom) startFilter.gte = new Date(parsed.data.dateFrom);
    if (parsed.data.dateTo) startFilter.lte = new Date(parsed.data.dateTo);
    where.startTime = startFilter;
  }

  const appointments = await db.appointment.findMany({
    where,
    include: {
      patient: { include: { user: { select: { name: true, email: true } } } },
      provider: { include: { user: { select: { name: true, email: true } } } },
      workflowEvents: {
        select: { id: true, workflowType: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(appointments);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createAppointmentSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return NextResponse.json({ error: issue?.message ?? "Invalid input" }, { status: 400 });
  }

  const { providerId, patientId, startTime, endTime, title, notes } = parsed.data;
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
  }

  const overlapping = await db.appointment.findFirst({
    where: {
      providerId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      OR: [{ startTime: { lt: end }, endTime: { gt: start } }],
    },
  });

  if (overlapping) {
    return NextResponse.json(
      { error: "Time slot overlaps with an existing appointment" },
      { status: 409 },
    );
  }

  const appointment = await db.appointment.create({
    data: {
      providerId,
      patientId,
      startTime: start,
      endTime: end,
      title: title ?? null,
      notes: notes ?? null,
    },
    include: {
      patient: { include: { user: { select: { name: true, email: true } } } },
      provider: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  return NextResponse.json(appointment, { status: 201 });
}
