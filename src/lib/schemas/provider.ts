import { z } from "zod";

export const updateProviderSchema = z.object({
  specialty: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  bio: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  username: z.string().min(3).max(30).optional(),
});

export const queryProvidersSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  specialty: z.string().optional(),
});

export const createWorkingHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm format"),
  isActive: z.boolean().optional(),
});

export const createLeaveRequestSchema = z.object({
  date: z.string().datetime({ offset: true }),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export const createNotificationSchema = z.object({
  type: z.string().min(1),
  message: z.string().max(1000).optional().or(z.literal("")),
  receiverId: z.string().uuid(),
  relatedEntityId: z.string().optional(),
  relatedEntityType: z.string().optional(),
});
