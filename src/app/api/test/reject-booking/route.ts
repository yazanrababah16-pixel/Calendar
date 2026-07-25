import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/test/reject-booking
 * Rejects a booking request.
 * FOR TESTING ONLY — no auth check.
 */
export async function POST(req: NextRequest) {
  if (process.env.MOCK_WEBHOOK_MODE !== "true") {
    return NextResponse.json({ error: "Not in mock mode" }, { status: 403 });
  }

  const { id, reason } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const request = await db.bookingRequest.findUnique({ where: { id } });

  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (request.status !== "PENDING") {
    return NextResponse.json(
      { error: `Status is ${request.status}, not PENDING` },
      { status: 400 },
    );
  }

  await db.bookingRequest.update({
    where: { id },
    data: { status: "REJECTED", rejectionReason: reason ?? null },
  });

  console.log(`[MOCK] Rejected booking ${id}. Reason: ${reason || "none"}`);

  return NextResponse.json({
    success: true,
    message: "Booking request rejected",
  });
}
