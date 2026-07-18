"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAvailabilitySchema } from "@/lib/schemas/availability";

type ActionResult = { success: true; id: string } | { success: false; error: string };

export async function createAvailabilitySlot(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createAvailabilitySchema.safeParse({
    providerId: formData.get("providerId"),
    dayOfWeek: formData.get("dayOfWeek") ? Number(formData.get("dayOfWeek")) : undefined,
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    isActive: formData.get("isActive") === "true" || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const existing = await db.availability.findUnique({
    where: {
      providerId_dayOfWeek: {
        providerId: parsed.data.providerId,
        dayOfWeek: parsed.data.dayOfWeek,
      },
    },
  });

  if (existing) {
    return { success: false, error: "Availability for this day already exists" };
  }

  const availability = await db.availability.create({
    data: {
      providerId: parsed.data.providerId,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      isActive: parsed.data.isActive ?? true,
    },
  });

  return { success: true, id: availability.id };
}

export async function toggleAvailabilitySlot(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const existing = await db.availability.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Availability slot not found" };
  }

  await db.availability.update({
    where: { id },
    data: { isActive },
  });

  return { success: true, id };
}
