import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const admins = await db()<{ id: string; display_name: string; line_user_id: string; created_at: string }[]>`SELECT id, display_name, line_user_id, created_at FROM members WHERE role = 'admin' ORDER BY created_at`;
    return NextResponse.json(admins);
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { displayName, lineUserId } = await request.json();
    if (typeof displayName !== "string" || typeof lineUserId !== "string" || !displayName.trim() || !lineUserId.trim()) return NextResponse.json({ error: "姓名與 LINE 使用者 ID 為必填。" }, { status: 400 });
    const [admin] = await db()<{ id: string; display_name: string; line_user_id: string }[]>`
      INSERT INTO members (display_name, line_user_id, role) VALUES (${displayName.trim()}, ${lineUserId.trim()}, 'admin')
      ON CONFLICT (line_user_id) DO UPDATE SET display_name = EXCLUDED.display_name, role = 'admin', updated_at = now()
      RETURNING id, display_name, line_user_id
    `;
    return NextResponse.json(admin, { status: 201 });
  } catch (error) { return apiError(error); }
}

function apiError(error: unknown) { if (error instanceof Response) return new NextResponse(error.body, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 }); }
