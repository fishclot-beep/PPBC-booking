import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db, ensureSessionSchema } from "@/lib/db";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { try { await requireAdmin(); await ensureSessionSchema(); const { id } = await params; return NextResponse.json(await db()`SELECT e.id, e.seats, e.event_type, e.created_at, m.display_name FROM session_reservation_events e JOIN members m ON m.id=e.member_id WHERE e.session_id=${id} ORDER BY e.created_at`); } catch (error) { return NextResponse.json({error:error instanceof Error?error.message:"無法取得紀錄"},{status:500}); } }
