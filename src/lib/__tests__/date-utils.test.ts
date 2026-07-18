import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  formatAppointmentDate,
  formatAppointmentTime,
  getDayLabel,
  getDurationMinutes,
  getDurationHours,
  getAppointmentTimeRange,
  isWithinNext24Hours,
  isOverlapping,
  generateTimeSlots,
  isUpcoming,
  isPast,
} from "@/lib/date-utils";

describe("formatAppointmentDate", () => {
  it("formats an ISO date string", () => {
    const result = formatAppointmentDate("2026-07-20T10:00:00.000Z");
    expect(result).toMatch(/Jul 20, 2026/);
  });
});

describe("formatAppointmentTime", () => {
  beforeAll(() => {
    vi.stubEnv("TZ", "UTC");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("formats time in 12-hour format", () => {
    const result = formatAppointmentTime("2026-07-20T14:30:00.000Z");
    expect(result).toMatch(/2:30/);
    expect(result).toMatch(/PM/i);
  });

  it("handles midnight", () => {
    const result = formatAppointmentTime("2026-07-20T00:00:00.000Z");
    expect(result).toMatch(/12:00/);
    expect(result).toMatch(/AM/i);
  });
});

describe("getDayLabel", () => {
  beforeAll(() => {
    vi.stubEnv("TZ", "UTC");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('returns "Today" for current date', () => {
    const now = new Date();
    const iso = now.toISOString();
    expect(getDayLabel(iso)).toBe("Today");
  });

  it('returns "Tomorrow" for next day', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getDayLabel(tomorrow.toISOString())).toBe("Tomorrow");
  });

  it("returns weekday for other dates", () => {
    const result = getDayLabel("2026-07-22T10:00:00.000Z");
    expect(result).toBe("Wednesday");
  });
});

describe("getDurationMinutes", () => {
  it("calculates duration in minutes", () => {
    const result = getDurationMinutes("2026-07-20T10:00:00.000Z", "2026-07-20T11:30:00.000Z");
    expect(result).toBe(90);
  });

  it("returns 0 for same start and end", () => {
    const result = getDurationMinutes("2026-07-20T10:00:00.000Z", "2026-07-20T10:00:00.000Z");
    expect(result).toBe(0);
  });
});

describe("getDurationHours", () => {
  it("calculates duration in hours", () => {
    const result = getDurationHours("2026-07-20T10:00:00.000Z", "2026-07-20T14:00:00.000Z");
    expect(result).toBe(4);
  });

  it("rounds down fractional hours", () => {
    const result = getDurationHours("2026-07-20T10:00:00.000Z", "2026-07-20T11:30:00.000Z");
    expect(result).toBe(1);
  });
});

describe("getAppointmentTimeRange", () => {
  beforeAll(() => {
    vi.stubEnv("TZ", "UTC");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("formats time range", () => {
    const result = getAppointmentTimeRange("2026-07-20T09:00:00.000Z", "2026-07-20T10:00:00.000Z");
    expect(result).toMatch(/9:00/);
    expect(result).toMatch(/10:00/);
    expect(result).toContain("-");
  });
});

describe("isWithinNext24Hours", () => {
  it("returns true for time within next 24 hours", () => {
    const soon = new Date();
    soon.setHours(soon.getHours() + 2);
    expect(isWithinNext24Hours(soon.toISOString())).toBe(true);
  });

  it("returns false for time beyond 24 hours", () => {
    const far = new Date();
    far.setDate(far.getDate() + 2);
    expect(isWithinNext24Hours(far.toISOString())).toBe(false);
  });

  it("returns false for past time", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isWithinNext24Hours(past.toISOString())).toBe(false);
  });
});

describe("isOverlapping", () => {
  it("detects overlapping time ranges", () => {
    expect(
      isOverlapping(
        "2026-07-20T10:00:00.000Z",
        "2026-07-20T11:00:00.000Z",
        "2026-07-20T10:30:00.000Z",
        "2026-07-20T11:30:00.000Z",
      ),
    ).toBe(true);
  });

  it("detects non-overlapping time ranges", () => {
    expect(
      isOverlapping(
        "2026-07-20T10:00:00.000Z",
        "2026-07-20T11:00:00.000Z",
        "2026-07-20T11:00:00.000Z",
        "2026-07-20T12:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("detects fully contained ranges", () => {
    expect(
      isOverlapping(
        "2026-07-20T09:00:00.000Z",
        "2026-07-20T12:00:00.000Z",
        "2026-07-20T10:00:00.000Z",
        "2026-07-20T11:00:00.000Z",
      ),
    ).toBe(true);
  });
});

describe("generateTimeSlots", () => {
  it("generates hourly slots for a day", () => {
    const date = new Date("2026-07-20");
    const slots = generateTimeSlots(date, 9, 12, 60);
    expect(slots).toHaveLength(3);
  });

  it("generates 30-minute slots", () => {
    const date = new Date("2026-07-20");
    const slots = generateTimeSlots(date, 9, 11, 30);
    expect(slots).toHaveLength(4);
  });

  it("returns empty array when start equals end", () => {
    const date = new Date("2026-07-20");
    const slots = generateTimeSlots(date, 10, 10, 30);
    expect(slots).toHaveLength(0);
  });
});

describe("isUpcoming / isPast", () => {
  it("detects upcoming dates", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isUpcoming(future.toISOString())).toBe(true);
    expect(isPast(future.toISOString())).toBe(false);
  });

  it("detects past dates", () => {
    const past = new Date("2020-01-01");
    expect(isPast(past.toISOString())).toBe(true);
    expect(isUpcoming(past.toISOString())).toBe(false);
  });
});
