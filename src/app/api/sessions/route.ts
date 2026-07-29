import { NextResponse } from "next/server";
import { currentMember } from "@/lib/admin-auth";
import { db, ensureSessionSchema } from "@/lib/db";

const dateOk = (value: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export async function GET(request: Request) {
  try {
    await currentMember();
    await ensureSessionSchema();
    const params = new URL(request.url).searchParams;
    const date = params.get("date");
    const from = params.get("from") ?? date;
    const to = params.get("to") ?? date;
    if (!from || !to || !dateOk(from) || !dateOk(to) || from > to) return NextResponse.json({ error: "日期格式錯誤。" }, { status: 400 });
    return NextResponse.json(await db()`SELECT s.*, coalesce(sum(r.seats),0)::int AS booked_seats FROM booking_sessions s LEFT JOIN session_reservations r ON r.session_id=s.id WHERE s.closed_at IS NULL AND s.starts_at < (${to}::date + interval '1 day') AND s.ends_at > ${from}::date GROUP BY s.id ORDER BY s.starts_at`);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "無法取得場次" }, { status: 500 }); }
}
