import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const [venue] = await db()<{ display_name: string; updated_at: string }[]>`SELECT display_name, updated_at FROM venue_settings WHERE singleton = true`;
    return NextResponse.json(venue ?? { display_name: "PPBC 籃球俱樂部" });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin();
    const { displayName } = await request.json();
    if (typeof displayName !== "string" || displayName.trim().length < 1 || displayName.trim().length > 40) return NextResponse.json({ error: "場館名稱須為 1 至 40 個字元。" }, { status: 400 });
    const [venue] = await db()<{ display_name: string }[]>`
      INSERT INTO venue_settings (singleton, display_name, updated_by) VALUES (true, ${displayName.trim()}, ${admin.id})
      ON CONFLICT (singleton) DO UPDATE SET display_name = EXCLUDED.display_name, updated_by = EXCLUDED.updated_by, updated_at = now()
      RETURNING display_name
    `;
    return NextResponse.json(venue);
  } catch (error) { return apiError(error); }
}

function apiError(error: unknown) { if (error instanceof Response) return new NextResponse(error.body, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 }); }
