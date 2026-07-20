"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ActionResult = { success: true } | { success: false; error: string };

export async function linkPatientToProvider(
  patientId: string,
  providerId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) return { success: false, error: "Patient not found" };

  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) return { success: false, error: "Provider not found" };

  const existing = await db.patientProvider.findUnique({
    where: { patientId_providerId: { patientId, providerId } },
  });
  if (existing) return { success: false, error: "This patient is already linked to this provider" };

  await db.patientProvider.create({ data: { patientId, providerId } });

  return { success: true };
}

export async function unlinkPatientProvider(
  patientId: string,
  providerId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await db.patientProvider.delete({
    where: { patientId_providerId: { patientId, providerId } },
  });

  return { success: true };
}

export async function getPatientLinkedProviders(patientId: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const links = await db.patientProvider.findMany({
    where: { patientId },
    include: {
      provider: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  const providers = links.map((l) => l.provider);
  return { success: true as const, providers };
}

/** For PATIENT role: derive patient from session, link by username */
export async function linkPatientToProviderByUsername(username: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (session.user.role !== "PATIENT")
    return { success: false as const, error: "Only patients can link to providers" };

  const patient = await db.patient.findUnique({ where: { userId: session.user.id } });
  if (!patient) return { success: false as const, error: "Patient profile not found" };

  const targetUser = await db.user.findUnique({ where: { username } });
  if (!targetUser) return { success: false as const, error: "No user found with that username" };
  if (targetUser.role !== "PROVIDER")
    return { success: false as const, error: "That user is not a provider" };

  const provider = await db.provider.findUnique({ where: { userId: targetUser.id } });
  if (!provider) return { success: false as const, error: "Provider profile not found" };

  const existing = await db.patientProvider.findUnique({
    where: { patientId_providerId: { patientId: patient.id, providerId: provider.id } },
  });
  if (existing)
    return { success: false as const, error: "You are already linked to this provider" };

  await db.patientProvider.create({ data: { patientId: patient.id, providerId: provider.id } });

  return { success: true as const, provider: { ...provider, user: targetUser } };
}

/** For PATIENT role: derive patient from session, unlink by provider id */
export async function unlinkMyProvider(providerId: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (session.user.role !== "PATIENT")
    return { success: false as const, error: "Only patients can unlink" };

  const patient = await db.patient.findUnique({ where: { userId: session.user.id } });
  if (!patient) return { success: false as const, error: "Patient profile not found" };

  await db.patientProvider.delete({
    where: { patientId_providerId: { patientId: patient.id, providerId } },
  });

  return { success: true as const };
}

/** For PATIENT role: derive patient from session, return linked providers with usernames */
export async function getMyLinkedProviders() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const patient = await db.patient.findUnique({ where: { userId: session.user.id } });
  if (!patient) return { success: false as const, error: "Patient profile not found" };

  const links = await db.patientProvider.findMany({
    where: { patientId: patient.id },
    include: {
      provider: {
        include: {
          user: { select: { id: true, name: true, email: true, username: true, image: true } },
        },
      },
    },
  });

  const docs = links.map((l) => ({ ...l.provider, linkedAt: l.createdAt }));
  return { success: true as const, doctors: docs };
}
