import { z } from "zod";

export const updatePatientSchema = z.object({
  dateOfBirth: z.string().datetime({ offset: true }).optional(),
  phone: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});
