import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/appointments/tomorrow
 * Returns tomorrow's uncancelled appointments with patient/provider info.
 * Used by the cron reminder route.
 */
export async function GET() {
  const now = new Date();

  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const appointments = await db.appointment.findMany({
    where: {
      startTime: { gte: tomorrowStart, lt: tomorrowEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      reminderSent: false,
    },
    include: {
      patient: { include: { user: { select: { name: true } } } },
      provider: { include: { user: { select: { name: true } } } },
    },
    orderBy: { startTime: "asc" },
    take: 50,
  });

  return NextResponse.json({
    appointments: appointments.map((apt) => ({
      id: apt.id,
      startTime: apt.startTime.toISOString(),
      endTime: apt.endTime.toISOString(),
      title: apt.title,
      patientName: apt.patient.user.name,
      patientPhone: apt.patient.phone,
      providerName: apt.provider.user.name,
      providerId: apt.providerId,
    })),
  });
}
