"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getMyDoctors() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const patient = await db.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!patient) return { success: false as const, error: "Patient profile not found" };

  const links = await db.patientProvider.findMany({
    where: { patientId: patient.id },
    include: {
      provider: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  const doctors = links.map((l) => l.provider);
  return { success: true as const, doctors };
}

export async function getMyUpcomingAppointments() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const patient = await db.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!patient) return { success: false as const, error: "Patient profile not found" };

  const now = new Date();

  const appointments = await db.appointment.findMany({
    where: {
      patientId: patient.id,
      startTime: { gte: now },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    include: {
      provider: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return { success: true as const, appointments };
}

export async function getMyPastAppointments() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const patient = await db.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!patient) return { success: false as const, error: "Patient profile not found" };

  const now = new Date();

  const appointments = await db.appointment.findMany({
    where: {
      patientId: patient.id,
      OR: [{ startTime: { lt: now } }, { status: { in: ["CANCELLED", "NO_SHOW", "COMPLETED"] } }],
    },
    include: {
      provider: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
    },
    orderBy: { startTime: "desc" },
    take: 50,
  });

  return { success: true as const, appointments };
}
