import { describe, it, expect } from "vitest";
import {
  hasMinRole,
  isStaffRole,
  canManageAppointments,
  canManagePatients,
  canManageProviders,
  canAccessRoute,
  type Role,
} from "@/lib/role-utils";

describe("hasMinRole", () => {
  it("returns true when user has exact role", () => {
    expect(hasMinRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("returns true when user has higher role (lower level)", () => {
    expect(hasMinRole("ADMIN", "PROVIDER")).toBe(true);
    expect(hasMinRole("ADMIN", "PATIENT")).toBe(true);
  });

  it("returns false when user has lower role (higher level)", () => {
    expect(hasMinRole("PATIENT", "ADMIN")).toBe(false);
    expect(hasMinRole("PROVIDER", "ADMIN")).toBe(false);
  });
});

describe("isStaffRole", () => {
  it("returns true for staff roles", () => {
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("RECEPTIONIST")).toBe(true);
    expect(isStaffRole("PROVIDER")).toBe(true);
  });

  it("returns false for patient role", () => {
    expect(isStaffRole("PATIENT")).toBe(false);
  });
});

describe("canManageAppointments", () => {
  it("allows staff to manage appointments", () => {
    expect(canManageAppointments("ADMIN")).toBe(true);
    expect(canManageAppointments("RECEPTIONIST")).toBe(true);
    expect(canManageAppointments("PROVIDER")).toBe(true);
  });

  it("denies patients from managing appointments", () => {
    expect(canManageAppointments("PATIENT")).toBe(false);
  });
});

describe("canManagePatients", () => {
  it("allows staff to manage patients", () => {
    expect(canManagePatients("ADMIN")).toBe(true);
    expect(canManagePatients("RECEPTIONIST")).toBe(true);
    expect(canManagePatients("PROVIDER")).toBe(true);
  });

  it("denies patients from managing patients", () => {
    expect(canManagePatients("PATIENT")).toBe(false);
  });
});

describe("canManageProviders", () => {
  it("allows only admin to manage providers", () => {
    expect(canManageProviders("ADMIN")).toBe(true);
    expect(canManageProviders("RECEPTIONIST")).toBe(false);
    expect(canManageProviders("PROVIDER")).toBe(false);
    expect(canManageProviders("PATIENT")).toBe(false);
  });
});

describe("canAccessRoute", () => {
  const roleRoutes: Record<string, Role[]> = {
    "/dashboard/calendar": ["ADMIN", "PROVIDER", "RECEPTIONIST"],
    "/dashboard/admin": ["ADMIN"],
    "/dashboard/patients": ["ADMIN", "PROVIDER", "RECEPTIONIST"],
    "/dashboard/providers": ["ADMIN"],
    "/dashboard": ["ADMIN", "PROVIDER", "RECEPTIONIST", "PATIENT"],
  };

  it("allows access to matched route", () => {
    expect(canAccessRoute("/dashboard/calendar", "ADMIN", roleRoutes)).toBe(true);
    expect(canAccessRoute("/dashboard/calendar", "PROVIDER", roleRoutes)).toBe(true);
  });

  it("denies access when role not in route list", () => {
    expect(canAccessRoute("/dashboard/calendar", "PATIENT", roleRoutes)).toBe(false);
    expect(canAccessRoute("/dashboard/admin", "PROVIDER", roleRoutes)).toBe(false);
  });

  it("uses longest prefix match for nested routes", () => {
    expect(canAccessRoute("/dashboard/admin/settings", "ADMIN", roleRoutes)).toBe(true);
    expect(canAccessRoute("/dashboard/admin/settings", "PROVIDER", roleRoutes)).toBe(false);
  });

  it("falls through to parent route when no specific match", () => {
    expect(canAccessRoute("/dashboard/settings", "PATIENT", roleRoutes)).toBe(true);
    expect(canAccessRoute("/dashboard/settings", "ADMIN", roleRoutes)).toBe(true);
  });

  it("returns true when no routes match", () => {
    expect(canAccessRoute("/public", "PATIENT", roleRoutes)).toBe(true);
  });
});
