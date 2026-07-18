import { z } from "zod";

export const appointmentStatuses = [
  "SCHEDULED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const createAppointmentSchema = z.object({
  providerId: z.string().uuid(),
  patientId: z.string().uuid(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  title: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateAppointmentSchema = z.object({
  title: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(appointmentStatuses).optional(),
  startTime: z.string().datetime({ offset: true }).optional(),
  endTime: z.string().datetime({ offset: true }).optional(),
});

export const queryAppointmentsSchema = z.object({
  providerId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  status: z.enum(appointmentStatuses).optional(),
});
