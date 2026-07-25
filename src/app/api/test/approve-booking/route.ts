import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/test/approve-booking
 * Approves a booking request and creates an appointment.
 * FOR TESTING ONLY — no auth check.
 */
export async function POST(req: NextRequest) {
  if (process.env.MOCK_WEBHOOK_MODE !== "true") {
    return NextResponse.json({ error: "Not in mock mode" }, { status: 403 });
  }

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const request = await db.bookingRequest.findUnique({
    where: { id },
    include: { provider: { include: { user: { select: { name: true } } } } },
  });

  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (request.status !== "PENDING") {
    return NextResponse.json(
      { error: `Status is ${request.status}, not PENDING` },
      { status: 400 },
    );
  }

  const startTime = request.modifiedStart ?? request.requestedDate;
  const endTime =
    request.modifiedEnd ??
    new Date(new Date(request.requestedDate).getTime() + request.durationMinutes * 60000);

  const appointment = await db.appointment.create({
    data: {
      providerId: request.providerId,
      patientId: request.patientId ?? "",
      startTime,
      endTime,
      title: `WhatsApp booking — ${request.patientPhone}`,
      status: "SCHEDULED",
    },
  });

  await db.bookingRequest.update({
    where: { id },
    data: { status: "APPROVED", appointmentId: appointment.id },
  });

  console.log(`[MOCK] Approved booking ${id} → appointment ${appointment.id}`);

  return NextResponse.json({
    success: true,
    appointmentId: appointment.id,
    message: `Appointment created at ${startTime.toISOString()}`,
  });
}
