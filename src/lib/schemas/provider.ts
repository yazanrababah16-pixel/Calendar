import { z } from "zod";

export const updateProviderSchema = z.object({
  specialty: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  bio: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export const queryProvidersSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  specialty: z.string().optional(),
});
