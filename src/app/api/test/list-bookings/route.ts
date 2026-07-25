import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/test/list-bookings
 * Lists all booking requests.
 * FOR TESTING ONLY — no auth check.
 */
export async function GET(_req: NextRequest) {
  if (process.env.MOCK_WEBHOOK_MODE !== "true") {
    return NextResponse.json({ error: "Not in mock mode" }, { status: 403 });
  }

  const requests = await db.bookingRequest.findMany({
    include: {
      provider: { include: { user: { select: { name: true } } } },
      patient: { include: { user: { select: { name: true } } } },
      appointment: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ requests, count: requests.length });
}
