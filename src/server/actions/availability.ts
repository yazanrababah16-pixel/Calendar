"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const upsertWorkingHoursSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  isActive: z.boolean(),
});

const leaveRequestSchema = z.object({
  date: z.string().min(1, "Date is required"),
  reason: z.string().max(500).optional().or(z.literal("")),
});

type ActionResult = { success: true } | { success: false; error: string };

async function getProviderId(userId: string): Promise<string | null> {
  const provider = await db.provider.findUnique({
    where: { userId },
    select: { id: true },
  });
  return provider?.id ?? null;
}

export async function getWorkingHours() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const providerId = await getProviderId(session.user.id);
  if (!providerId) return { success: false as const, error: "Provider profile not found" };

  const hours = await db.workingHours.findMany({
    where: { providerId },
    orderBy: { dayOfWeek: "asc" },
  });

  return { success: true as const, hours };
}

export async function upsertWorkingHours(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const providerId = await getProviderId(session.user.id);
  if (!providerId) return { success: false, error: "Provider profile not found" };

  const raw = formData.get("hours");
  if (!raw) return { success: false, error: "No hours data provided" };

  let hoursArray: unknown[];
  try {
    hoursArray = JSON.parse(raw as string);
  } catch {
    return { success: false, error: "Invalid hours data format" };
  }

  for (const entry of hoursArray) {
    const parsed = upsertWorkingHoursSchema.safeParse(entry);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid entry for ${DAY_NAMES[(entry as Record<string, unknown>).dayOfWeek as number] ?? "unknown day"}`,
      };
    }
  }

  await db.$transaction(
    (hoursArray as z.infer<typeof upsertWorkingHoursSchema>[]).map((entry) =>
      db.workingHours.upsert({
        where: {
          providerId_dayOfWeek: { providerId, dayOfWeek: entry.dayOfWeek },
        },
        update: { startTime: entry.startTime, endTime: entry.endTime, isActive: entry.isActive },
        create: {
          providerId,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          isActive: entry.isActive,
        },
      }),
    ),
  );

  return { success: true };
}

export async function createLeaveRequest(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const providerId = await getProviderId(session.user.id);
  if (!providerId) return { success: false, error: "Provider profile not found" };

  const parsed = leaveRequestSchema.safeParse({
    date: formData.get("date"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  const { date, reason } = parsed.data;
  const leaveDate = new Date(date);

  const existing = await db.leaveRequest.findFirst({
    where: { providerId, date: { gte: startOfDay(leaveDate), lte: endOfDay(leaveDate) } },
  });

  if (existing) {
    return { success: false, error: "A leave request already exists for this date" };
  }

  const leave = await db.leaveRequest.create({
    data: { providerId, date: leaveDate, reason: reason || null, status: "PENDING" },
  });

  const provider = await db.provider.findUnique({
    where: { id: providerId },
    include: { user: { select: { id: true, name: true } } },
  });

  if (provider) {
    const assignments = await db.providerAssignment.findMany({
      where: { providerId },
      include: { user: { select: { id: true } } },
    });

    const receptionistIds = assignments.map((a) => a.user.id);

    if (receptionistIds.length > 0) {
      const dateStr = leaveDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      await db.notification.createMany({
        data: receptionistIds.map((receiverId) => ({
          type: "leave_notification",
          message: `Dr. ${provider.user.name} requested a leave on ${dateStr}. Please reschedule their appointments.`,
          relatedEntityId: leave.id,
          relatedEntityType: "leave_request",
          senderId: session.user.id,
          receiverId,
        })),
      });
    }
  }

  return { success: true };
}

export async function getLeaveRequests() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const providerId = await getProviderId(session.user.id);
  if (!providerId) return { success: false as const, error: "Provider profile not found" };

  const leaves = await db.leaveRequest.findMany({
    where: { providerId },
    orderBy: { date: "desc" },
  });

  return { success: true as const, leaves };
}

export async function checkAvailability(providerId: string, startTime: Date, endTime: Date) {
  const dayOfWeek = startTime.getDay();
  const timeStr = `${String(startTime.getHours()).padStart(2, "0")}:${String(startTime.getMinutes()).padStart(2, "0")}`;
  const endTimeStr = `${String(endTime.getHours()).padStart(2, "0")}:${String(endTime.getMinutes()).padStart(2, "0")}`;

  const workingHour = await db.workingHours.findUnique({
    where: { providerId_dayOfWeek: { providerId, dayOfWeek } },
  });

  if (!workingHour || !workingHour.isActive) {
    return { available: false, reason: "The provider is not available on this day" };
  }

  if (timeStr < workingHour.startTime || endTimeStr > workingHour.endTime) {
    return {
      available: false,
      reason: `The appointment time must be between ${workingHour.startTime} and ${workingHour.endTime}`,
    };
  }

  const leave = await db.leaveRequest.findFirst({
    where: {
      providerId,
      status: { in: ["PENDING", "APPROVED"] },
      date: { gte: startOfDay(startTime), lte: endOfDay(startTime) },
    },
  });

  if (leave) {
    return { available: false, reason: "The provider has a leave request on this date" };
  }

  return { available: true, reason: null };
}
