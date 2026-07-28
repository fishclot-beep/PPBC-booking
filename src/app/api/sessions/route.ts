import { NextResponse } from "next/server";
import { currentMember } from "@/lib/admin-auth";
import { db } from "@/lib/db";
export async function GET(request: Request) { try { await currentMember(); const date=new URL(request.url).searchParams.get("date"); if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({error:"日期格式錯誤。"},{status:400}); return NextResponse.json(await db()`SELECT s.*, coalesce(sum(r.seats),0)::int AS booked_seats FROM booking_sessions s LEFT JOIN session_reservations r ON r.session_id=s.id WHERE s.starts_at < (${date}::date + interval '1 day') AND s.ends_at > ${date}::date GROUP BY s.id ORDER BY s.starts_at`); } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"無法取得場次"},{status:500}); } }
