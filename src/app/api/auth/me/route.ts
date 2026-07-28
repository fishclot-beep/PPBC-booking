import { NextResponse } from "next/server";
import { clearAdminCookie, currentMember } from "@/lib/admin-auth";

export async function GET() {
  try { const member = await currentMember(); return NextResponse.json({ displayName: member.display_name, role: member.role }); }
  catch (error) { if (error instanceof Response) return new NextResponse(error.body, { status: error.status }); return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}

export async function DELETE() { await clearAdminCookie(); return new NextResponse(null, { status: 204 }); }
