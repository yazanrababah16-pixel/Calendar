import { describe, it, expect } from "vitest";
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  queryAppointmentsSchema,
} from "@/lib/schemas/appointment";

const validUUID = "123e4567-e89b-12d3-a456-426614174000";
const validDatetime = "2026-07-20T10:00:00.000Z";

describe("createAppointmentSchema", () => {
  it("accepts valid appointment data", () => {
    const result = createAppointmentSchema.safeParse({
      providerId: validUUID,
      patientId: validUUID,
      startTime: validDatetime,
      endTime: "2026-07-20T11:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional title and notes", () => {
    const result = createAppointmentSchema.safeParse({
      providerId: validUUID,
      patientId: validUUID,
      startTime: validDatetime,
      endTime: "2026-07-20T11:00:00.000Z",
      title: "Follow-up visit",
      notes: "Patient requested afternoon slot",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing providerId", () => {
    const result = createAppointmentSchema.safeParse({
      patientId: validUUID,
      startTime: validDatetime,
      endTime: "2026-07-20T11:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID providerId", () => {
    const result = createAppointmentSchema.safeParse({
      providerId: "not-a-uuid",
      patientId: validUUID,
      startTime: validDatetime,
      endTime: "2026-07-20T11:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects datetime without offset", () => {
    const result = createAppointmentSchema.safeParse({
      providerId: validUUID,
      patientId: validUUID,
      startTime: "2026-07-20T10:00:00",
      endTime: "2026-07-20T11:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects title exceeding 200 characters", () => {
    const result = createAppointmentSchema.safeParse({
      providerId: validUUID,
      patientId: validUUID,
      startTime: validDatetime,
      endTime: "2026-07-20T11:00:00.000Z",
      title: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes exceeding 2000 characters", () => {
    const result = createAppointmentSchema.safeParse({
      providerId: validUUID,
      patientId: validUUID,
      startTime: validDatetime,
      endTime: "2026-07-20T11:00:00.000Z",
      notes: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("strips undefined optional fields", () => {
    const result = createAppointmentSchema.safeParse({
      providerId: validUUID,
      patientId: validUUID,
      startTime: validDatetime,
      endTime: "2026-07-20T11:00:00.000Z",
      title: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBeUndefined();
    }
  });
});

describe("updateAppointmentSchema", () => {
  it("accepts partial updates", () => {
    const result = updateAppointmentSchema.safeParse({
      title: "Updated title",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateAppointmentSchema.safeParse({
      status: "INVALID_STATUS",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid status transitions", () => {
    const statuses = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];
    for (const status of statuses) {
      const result = updateAppointmentSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("accepts empty object (no updates)", () => {
    const result = updateAppointmentSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("queryAppointmentsSchema", () => {
  it("accepts empty query (no filters)", () => {
    const result = queryAppointmentsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid filters", () => {
    const result = queryAppointmentsSchema.safeParse({
      providerId: validUUID,
      patientId: validUUID,
      dateFrom: validDatetime,
      dateTo: "2026-07-25T23:59:59.000Z",
      status: "SCHEDULED",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status filter", () => {
    const result = queryAppointmentsSchema.safeParse({
      status: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID patientId", () => {
    const result = queryAppointmentsSchema.safeParse({
      patientId: "bad-id",
    });
    expect(result.success).toBe(false);
  });
});
