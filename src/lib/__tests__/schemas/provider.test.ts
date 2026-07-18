import { describe, it, expect } from "vitest";
import { updateProviderSchema, queryProvidersSchema } from "@/lib/schemas/provider";

describe("updateProviderSchema", () => {
  it("accepts valid provider update", () => {
    const result = updateProviderSchema.safeParse({
      specialty: "Cardiology",
      phone: "+1-555-0101",
      bio: "Board certified cardiologist",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts partial update", () => {
    const result = updateProviderSchema.safeParse({
      isActive: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects specialty over 200 chars", () => {
    const result = updateProviderSchema.safeParse({
      specialty: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("queryProvidersSchema", () => {
  it("accepts empty query", () => {
    const result = queryProvidersSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("coerces isActive string to boolean", () => {
    const result = queryProvidersSchema.safeParse({
      isActive: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });
});
