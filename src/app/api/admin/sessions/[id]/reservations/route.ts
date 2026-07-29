import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db, ensureSessionSchema } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); await ensureSessionSchema(); const { id } = await params; return NextResponse.json(await db()`SELECT r.id, r.seats, r.created_at, m.display_name FROM session_reservations r JOIN members m ON m.id=r.member_id WHERE r.session_id=${id} ORDER BY r.created_at`); }
  catch (error) { return fail(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); await ensureSessionSchema(); const { id } = await params; const { reservationId } = await request.json(); if (typeof reservationId !== "string") return NextResponse.json({ error: "預約資料無效。" }, { status: 400 }); await db()`DELETE FROM session_reservations WHERE id=${reservationId} AND session_id=${id}`; return new NextResponse(null, { status: 204 }); }
  catch (error) { return fail(error); }
}
function fail(error: unknown) { if (error instanceof Response) return new NextResponse(error.body,{status:error.status}); return NextResponse.json({error:error instanceof Error?error.message:"操作失敗"},{status:500}); }
