import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "PATIENT") {
    const patient = await db.patient.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { id: true, name: true, email: true, username: true, image: true } },
      },
    });
    return NextResponse.json(patient ? [patient] : []);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const patients = await db.patient.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, username: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(patients);
}
