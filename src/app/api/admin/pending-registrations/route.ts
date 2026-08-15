import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await sql`
    SELECT 
      id,
      name,
      phone,
      email,
      whatsapp_chat_id,
      status,
      requested_at,
      reviewed_at,
      reviewed_by
    FROM registration_requests
    WHERE status = 'pending'
    ORDER BY requested_at DESC
  `;

  return NextResponse.json(requests);
}
