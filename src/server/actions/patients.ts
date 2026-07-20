"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";
import { canManagePatients } from "@/lib/role-utils";

const createPatientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .optional()
    .or(z.literal("")),
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
    username: formData.get("username") || undefined,
    phone: formData.get("phone") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const { name, email, username, phone, dateOfBirth, notes } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "A user with this email already exists" };
  }

  if (username) {
    const existingUsername = await db.user.findUnique({ where: { username } });
    if (existingUsername) {
      return { success: false, error: "This username is already taken" };
    }
  }

  const defaultPassword = "Clinic@123";
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  const patient = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        username: username || null,
        passwordHash,
        role: Role.PATIENT,
      },
    });

    return tx.patient.create({
      data: {
        userId: user.id,
        phone: phone || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        notes: notes || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, username: true, image: true } },
      },
    });
  });

  return { success: true, id: patient.id };
}

export async function updateUserPassword(
  userId: string,
  newPassword: string,
): Promise<CreatePatientResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Only admins can update passwords" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { success: true, id: userId };
}
