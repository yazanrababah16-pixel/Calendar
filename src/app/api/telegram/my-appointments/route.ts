import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/telegram/my-appointments?telegramChatId=xxx
 * Public endpoint for n8n AI Agent to fetch a linked patient's upcoming appointments.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const telegramChatId = searchParams.get("telegramChatId");

  if (!telegramChatId) {
    return NextResponse.json({ error: "telegramChatId is required" }, { status: 400 });
  }

  const patient = await db.patient.findUnique({
    where: { telegramChatId },
    select: { id: true },
  });

  if (!patient) {
    return NextResponse.json(
      { error: "No patient linked to this Telegram account" },
      { status: 404 },
    );
  }

  const appointments = await db.appointment.findMany({
    where: {
      patientId: patient.id,
      startTime: { gte: new Date() },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    include: {
      provider: { include: { user: { select: { name: true } } } },
    },
    orderBy: { startTime: "asc" },
    take: 10,
  });

  return NextResponse.json({
    appointments: appointments.map((a) => ({
      id: a.id,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      providerName: a.provider.user.name,
      status: a.status,
    })),
  });
}
