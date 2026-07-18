import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

function verifySignature(req: NextRequest, body: string): boolean {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers.get("x-n8n-signature");
  if (!signature) return true;

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  if (!verifySignature(req, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workflowType = (payload.workflowType as string) ?? "unknown";
  const idempotencyKey = payload.idempotencyKey as string | undefined;
  const status = payload.status as string | undefined;
  const appointmentId = payload.appointmentId as string | undefined;
  const lastError = payload.lastError as string | undefined;

  if (!idempotencyKey) {
    return NextResponse.json({ error: "Missing idempotencyKey" }, { status: 400 });
  }

  const existing = await db.workflowEvent.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    await db.workflowEvent.update({
      where: { idempotencyKey },
      data: {
        status: (status as "DELIVERED" | "FAILED" | undefined) ?? "DELIVERED",
        lastError: lastError ?? null,
        result: payload as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ message: "Updated" }, { status: 200 });
  }

  await db.workflowEvent.create({
    data: {
      workflowType,
      status: (status as "DELIVERED" | "FAILED") ?? "DELIVERED",
      idempotencyKey,
      payload: payload as Prisma.InputJsonValue,
      appointmentId: appointmentId ?? null,
    },
  });

  return NextResponse.json({ message: "Created" }, { status: 201 });
}
