"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAppointmentSchema } from "@/lib/schemas/appointment";
import { triggerN8nWorkflow } from "@/server/actions/n8n";

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
