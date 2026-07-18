import { describe, it, expect } from "vitest";
import {
  createAvailabilitySchema,
  updateAvailabilitySchema,
  queryAvailabilitySchema,
} from "@/lib/schemas/availability";

describe("createAvailabilitySchema", () => {
  it("accepts valid availability data", () => {
    const result = createAvailabilitySchema.safeParse({
      providerId: "123e4567-e89b-12d3-a456-426614174000",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional isActive", () => {
    const result = createAvailabilitySchema.safeParse({
      providerId: "123e4567-e89b-12d3-a456-426614174000",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
      isActive: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid dayOfWeek (negative)", () => {
    const result = createAvailabilitySchema.safeParse({
      providerId: "123e4567-e89b-12d3-a456-426614174000",
      dayOfWeek: -1,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid dayOfWeek (> 6)", () => {
    const result = createAvailabilitySchema.safeParse({
      providerId: "123e4567-e89b-12d3-a456-426614174000",
      dayOfWeek: 7,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format", () => {
    const result = createAvailabilitySchema.safeParse({
      providerId: "123e4567-e89b-12d3-a456-426614174000",
      dayOfWeek: 1,
      startTime: "9:00",
      endTime: "17:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing providerId", () => {
    const result = createAvailabilitySchema.safeParse({
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateAvailabilitySchema", () => {
  it("accepts partial updates", () => {
    const result = updateAvailabilitySchema.safeParse({
      isActive: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty update", () => {
    const result = updateAvailabilitySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates time format on update", () => {
    const result = updateAvailabilitySchema.safeParse({
      startTime: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAvailabilitySchema", () => {
  it("accepts empty query", () => {
    const result = queryAvailabilitySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("coerces string dayOfWeek to number", () => {
    const result = queryAvailabilitySchema.safeParse({
      dayOfWeek: "3",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dayOfWeek).toBe(3);
    }
  });

  it("rejects out-of-range dayOfWeek", () => {
    const result = queryAvailabilitySchema.safeParse({
      dayOfWeek: 10,
    });
    expect(result.success).toBe(false);
  });
});
