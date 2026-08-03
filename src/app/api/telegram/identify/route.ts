import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/telegram/identify
 * Public endpoint for n8n AI Agent to identify a patient by their Telegram Chat ID.
 *
 * Body: { telegramChatId: string }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { telegramChatId } = body as { telegramChatId?: string };

  if (!telegramChatId) {
    return NextResponse.json({ error: "telegramChatId is required" }, { status: 400 });
  }

  const patient = await db.patient.findUnique({
    where: { telegramChatId },
    include: { user: { select: { name: true } } },
  });

  if (!patient) {
    return NextResponse.json({ linked: false });
  }

  return NextResponse.json({
    linked: true,
    patientId: patient.id,
    name: patient.user.name,
    phone: patient.phone,
  });
}
