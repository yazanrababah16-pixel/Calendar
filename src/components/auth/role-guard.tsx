"use client";

import { useSession } from "next-auth/react";

export function RoleGuard({
  allowedRoles,
  fallback,
  children,
}: {
  allowedRoles: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (!role || !allowedRoles.includes(role)) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
