import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db, ensureSessionSchema } from "@/lib/db";

export async function GET() {
  try {
    const admin = await requireAdmin();
    await ensureSessionSchema();
    const [result] = await db()<{ linked: boolean }[]>`SELECT messaging_line_user_id IS NOT NULL AS linked FROM members WHERE id=${admin.id}`;
    return NextResponse.json({ linked: result?.linked ?? false });
  } catch (error) { return fail(error); }
}

export async function POST() {
  try {
    const admin = await requireAdmin();
    await ensureSessionSchema();
    const code = `PPBC-${randomBytes(3).toString("hex").toUpperCase()}`;
    await db().begin(async (sql) => {
      await sql`DELETE FROM line_notification_links WHERE member_id=${admin.id} AND consumed_at IS NULL`;
      await sql`INSERT INTO line_notification_links (code, member_id, expires_at) VALUES (${code}, ${admin.id}, now() + interval '15 minutes')`;
    });
    return NextResponse.json({ code, expiresInMinutes: 15 });
  } catch (error) { return fail(error); }
}

function fail(error: unknown) {
  if (error instanceof Response) return new NextResponse(error.body, { status: error.status });
  return NextResponse.json({ error: error instanceof Error ? error.message : "無法建立綁定碼。" }, { status: 500 });
}
