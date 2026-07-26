import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/providers/active
 * Public endpoint for n8n AI Agent to list active providers.
 */
export async function GET() {
  const providers = await db.provider.findMany({
    where: { isActive: true },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json({
    providers: providers.map((p) => ({
      id: p.id,
      name: p.user.name,
      specialty: p.specialty,
    })),
  });
}
