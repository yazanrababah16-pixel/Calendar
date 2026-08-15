import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { requestId, name, phone, email, notes } = body;

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "A valid name is required" }, { status: 400 });
    }

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "A valid phone number is required" }, { status: 400 });
    }

    const requestRecord = await db.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        phone: string;
        email: string | null;
        whatsapp_chat_id: string;
        status: string;
      }>
    >(
      `SELECT id, name, phone, email, whatsapp_chat_id, status 
       FROM registration_requests 
       WHERE id = $1`,
      requestId,
    );

    if (!requestRecord || requestRecord.length === 0) {
      return NextResponse.json({ error: "Registration request not found" }, { status: 404 });
    }

    const regRequest = requestRecord[0];

    if (!regRequest) {
      return NextResponse.json({ error: "Registration request not found" }, { status: 404 });
    }

    if (regRequest.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been processed" },
        { status: 400 },
      );
    }

    const existingPatient = await db.patient.findUnique({
      where: { phone },
    });

    if (existingPatient) {
      return NextResponse.json(
        { error: "A patient with this phone number already exists" },
        { status: 409 },
      );
    }

    const finalEmail =
      email && typeof email === "string" && email.trim().length > 0
        ? email.trim()
        : `whatsapp-${phone.replace(/[^a-zA-Z0-9]/g, "")}@clinic.local`;

    const existingUser = await db.user.findUnique({
      where: { email: finalEmail },
    });

    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const bcrypt = await import("bcryptjs");
    const defaultPassword = "Clinic@123";
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: finalEmail,
          passwordHash,
          role: Role.PATIENT,
        },
      });

      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          phone,
          notes: notes || null,
        },
      });

      await tx.$executeRawUnsafe(
        `UPDATE registration_requests 
         SET status = 'approved', 
             reviewed_at = NOW(), 
             reviewed_by = $1
         WHERE id = $2`,
        session.user.id,
        requestId,
      );

      return { userId: user.id, patientId: patient.id };
    });

    return NextResponse.json({
      success: true,
      message: "Patient account created successfully",
      userId: result.userId,
      patientId: result.patientId,
    });
  } catch (error) {
    console.error("[approve-registration] Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 },
    );
  }
}
