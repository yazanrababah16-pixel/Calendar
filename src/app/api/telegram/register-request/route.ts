import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/telegram/register-request
 * Public endpoint for n8n AI Agent to submit a patient registration request.
 *
 * Body: { name: string, phone: string, whatsappChatId: string, email?: string }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { name, phone, whatsappChatId, email } = body as {
    name?: string;
    phone?: string;
    whatsappChatId?: string;
    email?: string;
  };

  if (!name || !phone || !whatsappChatId) {
    return NextResponse.json(
      { error: "name, phone, and whatsappChatId are required" },
      { status: 400 },
    );
  }

  const normalizedPhone = phone.replace(/[\s\-()]/g, "");

  const existingPatient = await db.patient.findUnique({
    where: { phone: normalizedPhone },
    select: { id: true },
  });

  if (existingPatient) {
    return NextResponse.json(
      { error: "A patient with this phone number already exists" },
      { status: 409 },
    );
  }

  const pendingRequest = await db.registrationRequest.findFirst({
    where: {
      whatsappChatId,
      status: "pending",
    },
    select: { id: true },
  });

  if (pendingRequest) {
    return NextResponse.json({
      success: true,
      requestId: pendingRequest.id,
      message: "Registration request already pending",
    });
  }

  const duplicatePhone = await db.registrationRequest.findFirst({
    where: {
      phone: normalizedPhone,
      status: "pending",
    },
    select: { id: true },
  });

  if (duplicatePhone) {
    return NextResponse.json({
      success: true,
      requestId: duplicatePhone.id,
      message: "Registration request already pending for this phone number",
    });
  }

  const registrationRequest = await db.registrationRequest.create({
    data: {
      name,
      phone: normalizedPhone,
      whatsappChatId,
      email: email ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    requestId: registrationRequest.id,
    message: "Registration request submitted",
  });
}
