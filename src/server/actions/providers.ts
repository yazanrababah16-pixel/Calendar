"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ActionResult = { success: true; id: string } | { success: false; error: string };

const createProviderSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .optional()
    .or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  specialty: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
});

export async function createProvider(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Only admins can create providers" };
  }

  const parsed = createProviderSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    username: formData.get("username") || undefined,
    password: formData.get("password"),
    specialty: formData.get("specialty") || undefined,
    phone: formData.get("phone") || undefined,
    bio: formData.get("bio") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const { name, email, username, password, specialty, phone, bio } = parsed.data;

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingProvider = await db.provider.findUnique({ where: { userId: existingUser.id } });
    if (existingProvider) {
      return { success: false, error: "This user is already a provider" };
    }
    await db.provider.create({
      data: {
        userId: existingUser.id,
        specialty: specialty || null,
        phone: phone || null,
        bio: bio || null,
      },
    });
    if (existingUser.role !== "PROVIDER") {
      await db.user.update({
        where: { id: existingUser.id },
        data: { role: "PROVIDER" },
      });
    }
    return { success: true, id: existingUser.id };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (username) {
    const existingUsername = await db.user.findUnique({ where: { username } });
    if (existingUsername) {
      return { success: false, error: "This username is already taken" };
    }
  }

  const user = await db.user.create({
    data: { name, email, username: username || null, passwordHash, role: "PROVIDER" },
  });

  await db.provider.create({
    data: {
      userId: user.id,
      specialty: specialty || null,
      phone: phone || null,
      bio: bio || null,
    },
  });

  return { success: true, id: user.id };
}

export async function updateProviderStatus(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const existing = await db.provider.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Provider not found" };
  }

  await db.provider.update({ where: { id }, data: { isActive } });
  return { success: true, id };
}
