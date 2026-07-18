import { z } from "zod";

export const createAvailabilitySchema = z.object({
  providerId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm format"),
  isActive: z.boolean().optional(),
});

export const updateAvailabilitySchema = z.object({
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:mm format")
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:mm format")
    .optional(),
  isActive: z.boolean().optional(),
});

export const queryAvailabilitySchema = z.object({
  providerId: z.string().uuid().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
});
