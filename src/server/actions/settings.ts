"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ActionResult = { success: true } | { success: false; error: string };

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .optional()
    .or(z.literal("")),
});

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    username: formData.get("username") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const { name, email, username } = parsed.data;

  const existingEmail = await db.user.findFirst({
    where: { email, id: { not: session.user.id } },
  });
  if (existingEmail) return { success: false, error: "Email is already in use" };

  if (username) {
    const existingUsername = await db.user.findFirst({
      where: { username, id: { not: session.user.id } },
    });
    if (existingUsername) return { success: false, error: "Username is already taken" };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { name, email, username: username || null },
  });

  return { success: true };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
});

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { success: false, error: "New passwords do not match" };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) {
    return { success: false, error: "Cannot change password for this account" };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { success: false, error: "Current password is incorrect" };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return { success: true };
}

export async function listUsers() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false as const, error: "Unauthorized" };
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true as const, users };
}
