export type Role = "ADMIN" | "PROVIDER" | "RECEPTIONIST" | "PATIENT";

export const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  PROVIDER: "Provider",
  RECEPTIONIST: "Receptionist",
  PATIENT: "Patient",
};

export const roleHierarchy: Record<Role, number> = {
  ADMIN: 0,
  RECEPTIONIST: 1,
  PROVIDER: 2,
  PATIENT: 3,
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  const userLevel = roleHierarchy[userRole];
  const minLevel = roleHierarchy[minRole];
  return userLevel <= minLevel;
}

export function isStaffRole(role: Role): boolean {
  return role === "ADMIN" || role === "RECEPTIONIST" || role === "PROVIDER";
}

export function canManageAppointments(role: Role): boolean {
  return role === "ADMIN" || role === "RECEPTIONIST" || role === "PROVIDER";
}

export function canManagePatients(role: Role): boolean {
  return role === "ADMIN" || role === "RECEPTIONIST" || role === "PROVIDER";
}

export function canManageProviders(role: Role): boolean {
  return role === "ADMIN" || role === "RECEPTIONIST";
}

export function canAccessRoute(
  pathname: string,
  role: Role,
  roleRoutes: Record<string, Role[]>,
): boolean {
  const matched = Object.entries(roleRoutes)
    .filter(([route]) => pathname.startsWith(route))
    .sort(([a], [b]) => b.length - a.length)[0];
  if (!matched) return true;
  return matched[1].includes(role);
}
