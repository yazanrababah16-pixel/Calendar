"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

const medicalRecordSchema = z.object({
  appointmentId: z.string().uuid(),
  diagnosis: z.string().max(2000).optional().or(z.literal("")),
  prescription: z.string().max(2000).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export async function addMedicalRecord(
  formData: FormData,
): Promise<ActionResult<{ recordId: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "PROVIDER" && session.user.role !== "ADMIN") {
    return { success: false, error: "Only providers can add medical records" };
  }

  const provider = await db.provider.findUnique({ where: { userId: session.user.id } });
  if (!provider) return { success: false, error: "Provider profile not found" };

  const parsed = medicalRecordSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    diagnosis: formData.get("diagnosis") || undefined,
    prescription: formData.get("prescription") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { appointmentId, diagnosis, prescription, notes } = parsed.data;

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { medicalRecord: true },
  });
  if (!appointment) return { success: false, error: "Appointment not found" };

  if (appointment.medicalRecord) {
    // Update existing record
    const record = await db.medicalRecord.update({
      where: { appointmentId },
      data: {
        diagnosis: diagnosis || null,
        prescription: prescription || null,
        notes: notes || null,
      },
    });
    return { success: true, data: { recordId: record.id } };
  }

  const record = await db.medicalRecord.create({
    data: {
      appointmentId,
      patientId: appointment.patientId,
      providerId: provider.id,
      diagnosis: diagnosis || null,
      prescription: prescription || null,
      notes: notes || null,
    },
  });

  return { success: true, data: { recordId: record.id } };
}

export type MedicalRecordData = {
  id: string;
  diagnosis: string | null;
  prescription: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  patientId: string;
  providerId: string;
  appointmentId: string;
  provider: { user: { name: string } };
};

export async function getMedicalRecord(
  appointmentId: string,
): Promise<ActionResult<MedicalRecordData | null>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const record = await db.medicalRecord.findUnique({
    where: { appointmentId },
    include: { provider: { include: { user: { select: { name: true } } } } },
  });
  if (!record) return { success: true, data: null };

  return { success: true, data: record };
}

export async function getPatientMedicalRecords(
  patientId: string,
): Promise<ActionResult<MedicalRecordData[]>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const records = await db.medicalRecord.findMany({
    where: { patientId },
    include: { provider: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, data: records };
}
