"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";
import { canManagePatients } from "@/lib/role-utils";

const createPatientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(20).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type CreatePatientResult = { success: true; id: string } | { success: false; error: string };

export async function createPatient(
  _prevState: CreatePatientResult | null,
  formData: FormData,
): Promise<CreatePatientResult> {
  const session = await auth();
  if (!session?.user || !canManagePatients(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createPatientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const { name, email, phone, dateOfBirth, notes } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "A user with this email already exists" };
  }

  const patient = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, role: Role.PATIENT },
    });

    return tx.patient.create({
      data: {
        userId: user.id,
        phone: phone || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        notes: notes || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  });

  return { success: true, id: patient.id };
}
