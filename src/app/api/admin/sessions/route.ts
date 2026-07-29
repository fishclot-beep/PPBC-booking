import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db, ensureSessionSchema } from "@/lib/db";

const dateOk = (value: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
export async function GET(request: Request) {
  try {
    await requireAdmin(); const date = new URL(request.url).searchParams.get("date");
    if (!dateOk(date)) return NextResponse.json({ error: "日期格式錯誤。" }, { status: 400 });
    return NextResponse.json(await db()`SELECT s.*, coalesce(sum(r.seats),0)::int AS booked_seats FROM booking_sessions s LEFT JOIN session_reservations r ON r.session_id=s.id WHERE s.starts_at < (${date}::date + interval '1 day') AND s.ends_at > ${date}::date GROUP BY s.id ORDER BY s.starts_at`);
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(); const body = await request.json();
    const { title, startsAt, endsAt, capacity, priceType, priceAmount } = body;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 80 || typeof startsAt !== "string" || typeof endsAt !== "string" || !Number.isInteger(capacity) || capacity < 0 || capacity > 30 || !["private", "per_person"].includes(priceType) || typeof priceAmount !== "number" || priceAmount < 0) return NextResponse.json({ error: "請完整填寫場次資料。" }, { status: 400 });
    const start = new Date(startsAt); const end = new Date(endsAt); if (Number.isNaN(+start) || Number.isNaN(+end) || start >= end) return NextResponse.json({ error: "時間範圍無效。" }, { status: 400 });
    const [session] = await db()`INSERT INTO booking_sessions (title, starts_at, ends_at, capacity, price_type, price_amount, created_by) VALUES (${title.trim()}, ${start.toISOString()}, ${end.toISOString()}, ${capacity}, ${priceType}, ${priceAmount}, ${admin.id}) RETURNING *`;
    return NextResponse.json(session, { status: 201 });
  } catch (error) { return fail(error); }
}
export async function PATCH(request: Request) {
  try { const admin = await requireAdmin(); await ensureSessionSchema(); const { id, actualCollected } = await request.json(); if (typeof id !== "string" || typeof actualCollected !== "number" || actualCollected < 0) return NextResponse.json({ error: "實收金額無效。" }, { status: 400 }); const [session] = await db()`UPDATE booking_sessions SET actual_collected=${actualCollected}, closed_at=now(), closed_by=${admin.id} WHERE id=${id} RETURNING *`; if (!session) return NextResponse.json({ error: "找不到場次。" }, { status: 404 }); return NextResponse.json(session); } catch (error) { return fail(error); }
}
export async function DELETE(request: Request) { try { await requireAdmin(); const { id } = await request.json(); if (typeof id !== "string") return NextResponse.json({ error: "場次 ID 無效。" }, { status: 400 }); await db()`DELETE FROM booking_sessions WHERE id=${id}`; return new NextResponse(null, { status: 204 }); } catch (error) { return fail(error); } }
function fail(error: unknown) { if (error instanceof Response) return new NextResponse(error.body, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : "資料庫錯誤" }, { status: 500 }); }
