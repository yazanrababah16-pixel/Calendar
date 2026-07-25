import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/availability/slots
 * Public endpoint for n8n AI Agent to check available appointment slots.
 * Query params: providerId (optional), date (YYYY-MM-DD), durationMinutes (default 30)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const providerId = searchParams.get("providerId");
  const durationMinutes = parseInt(searchParams.get("durationMinutes") || "30", 10);

  if (!date) {
    return NextResponse.json({ error: "date query param is required (YYYY-MM-DD)" }, { status: 400 });
  }

  const searchStart = new Date(date);
  searchStart.setHours(0, 0, 0, 0);
  const searchEnd = new Date(searchStart);
  searchEnd.setDate(searchEnd.getDate() + 7);

  const providerFilter: Record<string, unknown> = {};
  if (providerId) providerFilter.providerId = providerId;

  const workingHours = await db.workingHours.findMany({
    where: { ...providerFilter, isActive: true },
    include: { provider: { include: { user: { select: { name: true } } } } },
    orderBy: { dayOfWeek: "asc" },
  });

  if (workingHours.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  const existingAppointments = await db.appointment.findMany({
    where: {
      ...providerFilter,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startTime: { gte: searchStart, lte: searchEnd },
    },
    select: { startTime: true, endTime: true, providerId: true },
  });

  const leaveRequests = await db.leaveRequest.findMany({
    where: {
      ...providerFilter,
      status: { in: ["PENDING", "APPROVED"] },
      date: { gte: searchStart, lte: searchEnd },
    },
    select: { date: true, providerId: true },
  });

  const leaveDates = new Set(
    leaveRequests.map((l) => {
      const d = new Date(l.date);
      return `${l.providerId}:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  );

  const whMap = new Map(workingHours.map((wh) => [`${wh.providerId}:${wh.dayOfWeek}`, wh]));

  const slots: {
    start: string;
    end: string;
    providerId: string;
    providerName: string;
    dayLabel: string;
  }[] = [];

  const cursor = new Date(searchStart);

  while (cursor <= searchEnd && slots.length < 10) {
    const dow = cursor.getDay();
    const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;

    const dayWorkingHours = workingHours.filter((wh) => wh.dayOfWeek === dow);

    for (const wh of dayWorkingHours) {
      const leaveKey = `${wh.providerId}:${dateKey}`;
      if (leaveDates.has(leaveKey)) continue;

      const startParts = (wh.startTime ?? "0:0").split(":");
      const endParts = (wh.endTime ?? "0:0").split(":");
      const dayStartMin = Number(startParts[0] ?? 0) * 60 + Number(startParts[1] ?? 0);
      const dayEndMin = Number(endParts[0] ?? 0) * 60 + Number(endParts[1] ?? 0);

      let slotStart = dayStartMin;
      while (slotStart + durationMinutes <= dayEndMin && slots.length < 10) {
        const sH = Math.floor(slotStart / 60);
        const sM = slotStart % 60;
        const eH = Math.floor((slotStart + durationMinutes) / 60);
        const eM = (slotStart + durationMinutes) % 60;

        const slotStartDT = new Date(cursor);
        slotStartDT.setHours(sH, sM, 0, 0);
        const slotEndDT = new Date(cursor);
        slotEndDT.setHours(eH, eM, 0, 0);

        const overlaps = existingAppointments.some(
          (a) =>
            a.providerId === wh.providerId &&
            new Date(a.startTime) < slotEndDT &&
            new Date(a.endTime) > slotStartDT,
        );

        if (!overlaps) {
          const dayLabel = cursor.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          slots.push({
            start: slotStartDT.toISOString(),
            end: slotEndDT.toISOString(),
            providerId: wh.providerId,
            providerName: wh.provider.user.name,
            dayLabel: `${dayLabel}, ${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")} - ${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`,
          });
        }

        slotStart += 30;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return NextResponse.json({ slots });
}
