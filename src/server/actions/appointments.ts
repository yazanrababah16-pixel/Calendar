"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAppointmentSchema } from "@/lib/schemas/appointment";
import { triggerN8nWorkflow } from "@/server/actions/n8n";
import { checkAvailability } from "@/server/actions/availability";

type ActionResult = { success: true; id: string } | { success: false; error: string };

export async function bookAppointment(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createAppointmentSchema.safeParse({
    providerId: formData.get("providerId"),
    patientId: formData.get("patientId"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    title: formData.get("title") || undefined,
    notes: formData.get("notes") || undefined,
    color: formData.get("color") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const { providerId, patientId, startTime, endTime, title, notes, color } = parsed.data;
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    return { success: false, error: "Start time must be before end time" };
  }

  const availability = await checkAvailability(providerId, start, end);
  if (!availability.available) {
    return { success: false, error: availability.reason! };
  }

  const overlapping = await db.appointment.findFirst({
    where: {
      providerId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      OR: [{ startTime: { lt: end }, endTime: { gt: start } }],
    },
  });

  if (overlapping) {
    return { success: false, error: "This time slot overlaps with an existing appointment" };
  }

  const appointment = await db.appointment.create({
    data: {
      providerId,
      patientId,
      startTime: start,
      endTime: end,
      title: title ?? null,
      notes: notes ?? null,
      color: color ?? undefined,
    },
  });

  await triggerN8nWorkflow("appointment-reminder", {
    workflowType: "appointment_reminder",
    appointmentId: appointment.id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    title: title ?? "",
    notes: notes ?? "",
  }).catch(() => {});

  await triggerN8nWorkflow("follow-up", {
    workflowType: "follow_up",
    appointmentId: appointment.id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    title: title ?? "",
    notes: notes ?? "",
  }).catch(() => {});

  return { success: true, id: appointment.id };
}

export async function cancelAppointment(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Appointment not found" };
  }

  if (existing.status === "CANCELLED" || existing.status === "COMPLETED") {
    return { success: false, error: "Appointment cannot be cancelled in its current state" };
  }

  await db.appointment.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return { success: true, id };
}

export async function updateAppointment(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "Appointment ID is required" };

  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Appointment not found" };

  const parsed = createAppointmentSchema.safeParse({
    providerId: formData.get("providerId"),
    patientId: formData.get("patientId"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    title: formData.get("title") || undefined,
    notes: formData.get("notes") || undefined,
    color: formData.get("color") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const { providerId, patientId, startTime, endTime, title, notes, color } = parsed.data;
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    return { success: false, error: "Start time must be before end time" };
  }

  const availability = await checkAvailability(providerId, start, end);
  if (!availability.available) {
    return { success: false, error: availability.reason! };
  }

  const overlapping = await db.appointment.findFirst({
    where: {
      id: { not: id },
      providerId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      OR: [{ startTime: { lt: end }, endTime: { gt: start } }],
    },
  });

  if (overlapping) {
    return { success: false, error: "Updated time slot overlaps with an existing appointment" };
  }

  await db.appointment.update({
    where: { id },
    data: {
      providerId,
      patientId,
      startTime: start,
      endTime: end,
      title: title ?? null,
      notes: notes ?? null,
      color: color ?? null,
    },
  });

  return { success: true, id };
}

export async function deleteAppointment(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Appointment not found" };

  await db.appointment.delete({ where: { id } });
  return { success: true, id };
}

export async function cancelDayForProvider(
  date: string,
): Promise<{ success: true; flagged: number } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") {
    return { success: false, error: "Only providers can request rescheduling" };
  }

  const provider = await db.provider.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!provider) {
    return { success: false, error: "Provider profile not found" };
  }

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const appointments = await db.appointment.findMany({
    where: {
      providerId: provider.id,
      status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED", "NEEDS_RESCHEDULE"] },
      startTime: { gte: dayStart, lte: dayEnd },
    },
  });

  if (appointments.length === 0) {
    return { success: false, error: "No active appointments found for this date" };
  }

  await db.appointment.updateMany({
    where: {
      providerId: provider.id,
      status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED", "NEEDS_RESCHEDULE"] },
      startTime: { gte: dayStart, lte: dayEnd },
    },
    data: { status: "NEEDS_RESCHEDULE" },
  });

  const formattedDate = dayStart.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const message = `Dr. ${provider.user.name} requested rescheduling for ${formattedDate}. Action required.`;

  const staff = await db.user.findMany({
    where: { role: { in: ["RECEPTIONIST", "ADMIN"] } },
    select: { id: true },
  });

  if (staff.length > 0) {
    await db.notification.createMany({
      data: staff.map((s) => ({
        type: "reschedule_request",
        message,
        senderId: provider.userId,
        receiverId: s.id,
        relatedEntityId: provider.id,
        relatedEntityType: `${date}|${provider.id}`,
      })),
    });
  }

  return { success: true, flagged: appointments.length };
}

export async function getRescheduleQueue(providerId: string, date: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const appointments = await db.appointment.findMany({
    where: {
      providerId,
      status: "NEEDS_RESCHEDULE",
      startTime: { gte: dayStart, lte: dayEnd },
    },
    include: {
      patient: { include: { user: { select: { name: true, email: true } } } },
      provider: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { startTime: "asc" },
  });

  return { success: true as const, appointments };
}

export async function getSuggestedSlots(
  providerId: string,
  durationMinutes: number,
  fromDate: string,
) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const searchStart = new Date(fromDate);
  searchStart.setHours(0, 0, 0, 0);
  const searchEnd = new Date(searchStart);
  searchEnd.setDate(searchEnd.getDate() + 14);

  const workingHours = await db.workingHours.findMany({
    where: { providerId, isActive: true },
    orderBy: { dayOfWeek: "asc" },
  });

  if (workingHours.length === 0) {
    return { success: true as const, slots: [] };
  }

  const existingAppointments = await db.appointment.findMany({
    where: {
      providerId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startTime: { gte: searchStart, lte: searchEnd },
    },
    select: { startTime: true, endTime: true },
  });

  const leaveRequests = await db.leaveRequest.findMany({
    where: {
      providerId,
      status: { in: ["PENDING", "APPROVED"] },
      date: { gte: searchStart, lte: searchEnd },
    },
    select: { date: true },
  });

  const leaveDates = new Set(
    leaveRequests.map((l) => {
      const d = new Date(l.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  );

  const whMap = new Map(workingHours.map((wh) => [wh.dayOfWeek, wh]));

  const slots: { start: string; end: string; dayLabel: string }[] = [];
  const cursor = new Date(searchStart);

  while (cursor <= searchEnd && slots.length < 5) {
    const dow = cursor.getDay();
    const wh = whMap.get(dow);
    const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;

    if (wh && !leaveDates.has(dateKey)) {
      const startParts = (wh.startTime ?? "0:0").split(":");
      const endParts = (wh.endTime ?? "0:0").split(":");
      const startH = Number(startParts[0] ?? 0);
      const startM = Number(startParts[1] ?? 0);
      const endH = Number(endParts[0] ?? 0);
      const endM = Number(endParts[1] ?? 0);
      const dayStartMin = startH * 60 + startM;
      const dayEndMin = endH * 60 + endM;

      let slotStart = dayStartMin;
      while (slotStart + durationMinutes <= dayEndMin && slots.length < 5) {
        const sH = Math.floor(slotStart / 60);
        const sM = slotStart % 60;
        const eH = Math.floor((slotStart + durationMinutes) / 60);
        const eM = (slotStart + durationMinutes) % 60;

        const slotStartStr = `${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}`;
        const slotEndStr = `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`;

        const slotStartDT = new Date(cursor);
        slotStartDT.setHours(sH, sM, 0, 0);
        const slotEndDT = new Date(cursor);
        slotEndDT.setHours(eH, eM, 0, 0);

        const overlaps = existingAppointments.some(
          (a) => new Date(a.startTime) < slotEndDT && new Date(a.endTime) > slotStartDT,
        );

        if (!overlaps) {
          const dayLabel = cursor.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          slots.push({
            start: `${dateKey}T${slotStartStr}:00`,
            end: `${dateKey}T${slotEndStr}:00`,
            dayLabel: `${dayLabel}, ${slotStartStr} - ${slotEndStr}`,
          });
        }

        slotStart += 30;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return { success: true as const, slots };
}

export async function rescheduleAppointment(
  appointmentId: string,
  newStartISO: string,
  newEndISO: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const appointment = await db.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) return { success: false, error: "Appointment not found" };

  if (appointment.status !== "NEEDS_RESCHEDULE") {
    return { success: false, error: "This appointment does not need rescheduling" };
  }

  const newStart = new Date(newStartISO);
  const newEnd = new Date(newEndISO);

  if (newStart >= newEnd) {
    return { success: false, error: "Start time must be before end time" };
  }

  const overlapping = await db.appointment.findFirst({
    where: {
      id: { not: appointmentId },
      providerId: appointment.providerId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      OR: [{ startTime: { lt: newEnd }, endTime: { gt: newStart } }],
    },
  });

  if (overlapping) {
    return { success: false, error: "New time slot overlaps with an existing appointment" };
  }

  await db.appointment.update({
    where: { id: appointmentId },
    data: {
      startTime: newStart,
      endTime: newEnd,
      status: "SCHEDULED",
    },
  });

  return { success: true };
}
