import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/telegram/link-account
 * Public endpoint for n8n AI Agent to link a Telegram Chat ID to a patient account.
 *
 * Body: { phone: string, telegramChatId: string }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { phone, telegramChatId } = body as { phone?: string; telegramChatId?: string };

  if (!phone || !telegramChatId) {
    return NextResponse.json({ error: "phone and telegramChatId are required" }, { status: 400 });
  }

  const normalizedPhone = phone.replace(/[\s\-()]/g, "");

  const patient = await db.patient.findUnique({
    where: { phone: normalizedPhone },
    include: { user: { select: { name: true } } },
  });

  if (!patient) {
    return NextResponse.json({ error: "No patient found with that phone number" }, { status: 404 });
  }

  if (patient.telegramChatId === telegramChatId) {
    return NextResponse.json({
      success: true,
      patientId: patient.id,
      name: patient.user.name,
      message: "Already linked",
    });
  }

  if (patient.telegramChatId && patient.telegramChatId !== telegramChatId) {
    return NextResponse.json(
      { error: "This Telegram account is already linked to a different patient" },
      { status: 409 },
    );
  }

  const existingWithChatId = await db.patient.findUnique({
    where: { telegramChatId },
    select: { id: true },
  });

  if (existingWithChatId) {
    return NextResponse.json(
      { error: "This Telegram account is already linked to a different patient" },
      { status: 409 },
    );
  }

  await db.patient.update({
    where: { id: patient.id },
    data: { telegramChatId },
  });

  return NextResponse.json({
    success: true,
    patientId: patient.id,
    name: patient.user.name,
  });
}
