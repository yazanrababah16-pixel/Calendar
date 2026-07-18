import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      appointments: {
        include: {
          provider: { include: { user: { select: { name: true } } } },
        },
        orderBy: { startTime: "desc" },
        take: 20,
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(patient);
}
