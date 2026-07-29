import { NextResponse } from "next/server";
import { currentMember } from "@/lib/admin-auth";
import { db, ensureSessionSchema } from "@/lib/db";
export async function GET() { try { const member = await currentMember(); await ensureSessionSchema(); return NextResponse.json(await db()`SELECT r.id, r.seats, r.created_at, s.title, s.starts_at, s.ends_at, s.closed_at FROM session_reservations r JOIN booking_sessions s ON s.id=r.session_id WHERE r.member_id=${member.id} ORDER BY s.starts_at DESC`); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "無法取得預約" }, { status: 500 }); } }
