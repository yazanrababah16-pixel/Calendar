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
