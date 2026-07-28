import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const members = await db()<{ id: string; display_name: string; line_user_id: string; role: string; is_blacklisted: boolean; created_at: string; booking_count: number }[]>`
      SELECT m.id, m.display_name, m.line_user_id, m.role, m.is_blacklisted, m.created_at, count(b.id)::int AS booking_count
      FROM members m LEFT JOIN bookings b ON b.member_id = m.id AND b.status IN ('pending_payment', 'confirmed')
      WHERE (${query} = '' OR m.display_name ILIKE ${`%${query}%`} OR m.line_user_id ILIKE ${`%${query}%`})
      GROUP BY m.id ORDER BY m.created_at DESC LIMIT 200
    `;
    return NextResponse.json(members);
  } catch (error) { if (error instanceof Response) return new NextResponse(error.body, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 }); }
}
