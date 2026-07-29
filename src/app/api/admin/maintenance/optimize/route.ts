import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function POST() {
  try {
    await requireAdmin();
    const sql = db();
    await sql`CREATE INDEX IF NOT EXISTS booking_sessions_starts_at_idx ON booking_sessions (starts_at)`;
    await sql`CREATE INDEX IF NOT EXISTS booking_sessions_open_starts_at_idx ON booking_sessions (starts_at) WHERE closed_at IS NULL`;
    await sql`CREATE INDEX IF NOT EXISTS session_reservations_session_id_idx ON session_reservations (session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS session_reservation_events_session_created_idx ON session_reservation_events (session_id, created_at)`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return new NextResponse(error.body, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "最佳化失敗" }, { status: 500 });
  }
}
