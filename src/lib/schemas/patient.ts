import { z } from "zod";

export const updatePatientSchema = z.object({
  dateOfBirth: z.string().datetime({ offset: true }).optional(),
  phone: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  username: z.string().min(3).max(30).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).max(30).optional(),
  role: z.enum(["ADMIN", "PROVIDER", "RECEPTIONIST", "PATIENT"]).optional(),
});
