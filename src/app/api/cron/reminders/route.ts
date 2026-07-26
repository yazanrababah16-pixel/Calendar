import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatAppointmentReminder } from "@/lib/whatsapp/templates";

/**
 * GET /api/cron/reminders
 * Vercel Cron Route — runs daily at 8am.
 * Fetches tomorrow's uncancelled appointments, sends WhatsApp reminders via n8n,
 * and marks them as reminderSent.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (appointments.length === 0) {
    return NextResponse.json({ message: "No appointments to remind", sent: 0 });
  }

  const n8nWebhookUrl = process.env.N8N_REMINDER_WEBHOOK_URL;
  const sentIds: string[] = [];
  const failedIds: string[] = [];

  for (const apt of appointments) {
    const message = formatAppointmentReminder({
      patientName: apt.patient.user.name,
      patientPhone: apt.patient.phone,
      providerName: apt.provider.user.name,
      startTime: apt.startTime.toISOString(),
      appointmentId: apt.id,
    });

    try {
      if (n8nWebhookUrl) {
        const response = await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientPhone: apt.patient.phone,
            patientName: apt.patient.user.name,
            providerName: apt.provider.user.name,
            startTime: apt.startTime.toISOString(),
            appointmentId: apt.id,
            message,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          failedIds.push(apt.id);
          continue;
        }
      }

      await db.appointment.update({
        where: { id: apt.id },
        data: { reminderSent: true },
      });

      await db.workflowEvent.create({
        data: {
          workflowType: "appointment_reminder",
          status: "DELIVERED",
          idempotencyKey: `reminder-${apt.id}-${tomorrowStart.toISOString().split("T")[0]}`,
          appointmentId: apt.id,
          payload: { message, patientPhone: apt.patient.phone } as never,
        },
      });

      sentIds.push(apt.id);
    } catch {
      failedIds.push(apt.id);
    }
  }

  return NextResponse.json({
    message: "Reminders processed",
    total: appointments.length,
    sent: sentIds.length,
    failed: failedIds.length,
  });
}
