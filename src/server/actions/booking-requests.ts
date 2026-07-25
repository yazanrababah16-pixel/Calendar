"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { triggerN8nWorkflow } from "@/server/actions/n8n";

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string };

const approveSchema = z.object({
  id: z.string().uuid(),
});

const rejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const modifySchema = z.object({
  id: z.string().uuid(),
  newStart: z.coerce.date(),
  newEnd: z.coerce.date(),
});

export async function getBookingRequests(status?: string): Promise<
  ActionResult<
    {
      id: string;
      patientPhone: string;
      patientName: string | null;
      requestedDate: Date;
      requestedTime: string;
      durationMinutes: number;
      message: string | null;
      status: string;
      rejectionReason: string | null;
      modifiedStart: Date | null;
      modifiedEnd: Date | null;
      createdAt: Date;
      provider: { id: string; user: { name: string } };
      patient: { id: string; user: { name: string } } | null;
    }[]
  >
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const where: Record<string, unknown> = {};
  if (status && ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
    where.status = status;
  } else {
    where.status = "PENDING";
  }

  const requests = await db.bookingRequest.findMany({
    where,
    include: {
      provider: { include: { user: { select: { id: true, name: true } } } },
      patient: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, data: requests };
}

export async function approveBookingRequest(
  id: string,
): Promise<ActionResult<{ appointmentId: string }>> {
  const session = await auth();
  if (!session?.user || !["RECEPTIONIST", "ADMIN"].includes(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = approveSchema.safeParse({ id });
  if (!parsed.success) {
    return { success: false, error: "Invalid request ID" };
  }

  const request = await db.bookingRequest.findUnique({
    where: { id },
    include: { provider: { include: { user: { select: { name: true } } } } },
  });

  if (!request) return { success: false, error: "Booking request not found" };
  if (request.status !== "PENDING") return { success: false, error: "Request is not pending" };

  let patientId = request.patientId;

  if (!patientId) {
    const existing = await db.patient.findFirst({
      where: { phone: request.patientPhone },
    });

    if (existing) {
      patientId = existing.id;
    } else {
      const slug = request.patientPhone.replace(/[^a-zA-Z0-9]/g, "");
      const patient = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: request.patientName || `Patient ${request.patientPhone}`,
            email: `whatsapp-${slug}@clinic.local`,
            passwordHash: "",
            role: "PATIENT",
          },
        });
        return tx.patient.create({
          data: { userId: user.id, phone: request.patientPhone },
        });
      });
      patientId = patient.id;
    }

    await db.bookingRequest.update({
      where: { id },
      data: { patientId },
    });
  }

  const startTime = request.modifiedStart ?? request.requestedDate;
  const endTime =
    request.modifiedEnd ??
    new Date(new Date(request.requestedDate).getTime() + request.durationMinutes * 60000);

  const overlap = await db.appointment.findFirst({
    where: {
      providerId: request.providerId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });

  if (overlap) {
    return {
      success: false,
      error: "This time slot is already booked. Please suggest a new time.",
    };
  }

  const appointment = await db.appointment.create({
    data: {
      providerId: request.providerId,
      patientId,
      startTime,
      endTime,
      title: `WhatsApp booking — ${request.patientPhone}`,
      status: "SCHEDULED",
    },
  });

  await db.bookingRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      appointmentId: appointment.id,
    },
  });

  const dateStr = startTime.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = startTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  triggerN8nWorkflow("whatsapp-booking-confirmed", {
    patientPhone: request.patientPhone,
    date: dateStr,
    time: timeStr,
    providerName: request.provider.user.name,
    appointmentId: appointment.id,
  }).catch(() => {});

  revalidatePath("/dashboard/receptionist/requests");

  return { success: true, data: { appointmentId: appointment.id } };
}

export async function rejectBookingRequest(id: string, reason?: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["RECEPTIONIST", "ADMIN"].includes(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = rejectSchema.safeParse({ id, reason });
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const request = await db.bookingRequest.findUnique({ where: { id } });
  if (!request) return { success: false, error: "Booking request not found" };
  if (request.status !== "PENDING") return { success: false, error: "Request is not pending" };

  await db.bookingRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectionReason: reason ?? null,
    },
  });

  const dateStr = request.requestedDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  triggerN8nWorkflow("whatsapp-booking-rejected", {
    patientPhone: request.patientPhone,
    date: dateStr,
    reason: reason ?? "",
  }).catch(() => {});

  revalidatePath("/dashboard/receptionist/requests");

  return { success: true };
}

export async function modifyBookingRequest(
  id: string,
  newStart: string,
  newEnd: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["RECEPTIONIST", "ADMIN"].includes(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = modifySchema.safeParse({ id, newStart, newEnd });
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const request = await db.bookingRequest.findUnique({
    where: { id },
    include: { provider: { include: { user: { select: { name: true } } } } },
  });
  if (!request) return { success: false, error: "Booking request not found" };
  if (request.status !== "PENDING") return { success: false, error: "Request is not pending" };

  const startDT = parsed.data.newStart;
  const endDT = parsed.data.newEnd;

  if (startDT >= endDT) {
    return { success: false, error: "Start time must be before end time" };
  }

  const overlap = await db.appointment.findFirst({
    where: {
      providerId: request.providerId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startTime: { lt: endDT },
      endTime: { gt: startDT },
    },
  });

  if (overlap) {
    return { success: false, error: "That time slot is already booked. Please choose another." };
  }

  await db.bookingRequest.update({
    where: { id },
    data: {
      modifiedStart: startDT,
      modifiedEnd: endDT,
    },
  });

  const originalDateStr = request.requestedDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const newDateStr = startDT.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const newTimeStr = startDT.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  triggerN8nWorkflow("whatsapp-booking-modified", {
    patientPhone: request.patientPhone,
    originalDate: originalDateStr,
    newDate: newDateStr,
    newTime: newTimeStr,
    providerName: request.provider.user.name,
  }).catch(() => {});

  revalidatePath("/dashboard/receptionist/requests");

  return { success: true };
}
