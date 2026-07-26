import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

function verifySignature(req: NextRequest, body: string): boolean {
  if (process.env.MOCK_WEBHOOK_MODE === "true") return true;

  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers.get("x-n8n-signature");
  if (!signature) return true;

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  if (!verifySignature(req, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    workflowType,
    idempotencyKey,
    patientPhone,
    patientName,
    patientEmail,
    requestedDate,
    requestedTime,
    durationMinutes,
    message,
    providerId,
  } = payload as {
    workflowType?: string;
    idempotencyKey?: string;
    patientPhone?: string;
    patientName?: string;
    patientEmail?: string;
    requestedDate?: string;
    requestedTime?: string;
    durationMinutes?: number;
    message?: string;
    providerId?: string;
  };

  if (!idempotencyKey) {
    return NextResponse.json({ error: "Missing idempotencyKey" }, { status: 400 });
  }

  if (!patientPhone || !requestedDate || !requestedTime) {
    return NextResponse.json(
      { error: "Missing required fields: patientPhone, requestedDate, requestedTime" },
      { status: 400 },
    );
  }

  const existing = await db.workflowEvent.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return NextResponse.json({ message: "Already processed" }, { status: 200 });
  }

  const patient = await db.patient.findFirst({
    where: { phone: patientPhone },
    select: { id: true },
  });

  let resolvedProviderId = providerId;
  if (!resolvedProviderId) {
    const firstProvider = await db.provider.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    resolvedProviderId = firstProvider?.id;
  }

  if (!resolvedProviderId) {
    return NextResponse.json({ error: "No active provider found" }, { status: 500 });
  }

  const dateObj = new Date(`${requestedDate}T12:00:00`);

  const bookingRequest = await db.bookingRequest.create({
    data: {
      patientPhone,
      patientName: patientName ?? null,
      patientEmail: patientEmail ?? null,
      requestedDate: dateObj,
      requestedTime,
      durationMinutes: durationMinutes ?? 30,
      message: message ?? null,
      providerId: resolvedProviderId,
      patientId: patient?.id ?? null,
    },
  });

  const staff = await db.user.findMany({
    where: { role: { in: ["RECEPTIONIST", "ADMIN"] } },
    select: { id: true },
  });

  if (staff.length > 0) {
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const senderId = staff[0]?.id;
    if (senderId) {
      await db.notification.createMany({
        data: staff.map((s) => ({
          type: "booking_request",
          message: `New WhatsApp booking request from ${patientPhone} for ${formattedDate} at ${requestedTime}.`,
          senderId,
          receiverId: s.id,
          relatedEntityId: bookingRequest.id,
          relatedEntityType: "booking_request",
        })),
      });
    }
  }

  await db.workflowEvent.create({
    data: {
      workflowType: workflowType ?? "booking_request",
      status: "DELIVERED",
      idempotencyKey,
      payload: payload as never,
    },
  });

  return NextResponse.json(
    { message: "Created", bookingRequestId: bookingRequest.id },
    { status: 201 },
  );
}
