import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { normalizePhone } from "@/lib/phone";

const sql = neon(process.env.DATABASE_URL!);

/**
 * POST /api/whatsapp/register-request
 *
 * Accepts a new patient registration request from the WhatsApp AI agent.
 * Saves the request to the database and returns success.
 *
 * Body: {
 *   name: string (required),
 *   phone: string (required, E.164 format),
 *   email?: string,
 *   whatsappChatId: string (required)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, whatsappChatId } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "A valid name is required (minimum 2 characters)." },
        { status: 400 },
      );
    }

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 });
    }

    if (!whatsappChatId || typeof whatsappChatId !== "string") {
      return NextResponse.json({ error: "WhatsApp chat ID is required." }, { status: 400 });
    }

    if (email && typeof email === "string" && email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
      }
    }

    const normalizedPhone = normalizePhone(phone);

    const existingRequests = await sql`
      SELECT id, status
      FROM registration_requests
      WHERE phone = ${normalizedPhone}
        AND status = 'pending'
      LIMIT 1
    `;

    if (existingRequests.length > 0) {
      const existingRequest = existingRequests[0];
      return NextResponse.json(
        {
          success: true,
          message: "A registration request for this phone number is already pending review.",
          requestId: existingRequest?.id,
          alreadyPending: true,
        },
        { status: 200 },
      );
    }

    const existingPatients = await sql`
      SELECT id
      FROM patients
      WHERE phone = ${normalizedPhone}
      LIMIT 1
    `;

    if (existingPatients.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A patient account with this phone number already exists. Please use the login flow instead.",
        },
        { status: 409 },
      );
    }

    const result = await sql`
      INSERT INTO registration_requests (name, phone, email, whatsapp_chat_id, status)
      VALUES (
        ${name.trim()},
        ${normalizedPhone},
        ${email?.trim() || null},
        ${whatsappChatId},
        'pending'
      )
      RETURNING id, requested_at
    `;

    const newRequest = result[0];

    if (!newRequest) {
      return NextResponse.json(
        { error: "Failed to create registration request." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Registration request submitted successfully. The clinic secretary will review and create your account.",
        requestId: newRequest.id,
        requestedAt: newRequest.requested_at,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[register-request] Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 },
    );
  }
}
