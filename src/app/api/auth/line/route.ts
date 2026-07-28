import { NextResponse } from "next/server";
import { makeAdminSession, setAdminCookie } from "@/lib/admin-auth";
import { db } from "@/lib/db";

type LineProfile = { sub?: string; name?: string; picture?: string };

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    const channelId = process.env.LINE_CHANNEL_ID;
    if (typeof idToken !== "string" || !channelId) return NextResponse.json({ error: "LINE Login 尚未設定。" }, { status: 503 });
    const form = new URLSearchParams({ id_token: idToken, client_id: channelId });
    const verified = await fetch("https://api.line.me/oauth2/v2.1/verify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store" });
    if (!verified.ok) return NextResponse.json({ error: "LINE 身分驗證失敗，請重新登入。" }, { status: 401 });
    const profile = await verified.json() as LineProfile;
    if (!profile.sub || !profile.name) return NextResponse.json({ error: "LINE 未回傳必要的會員資料。" }, { status: 401 });
    const [member] = await db()<{ id: string; display_name: string; role: "member" | "admin"; is_blacklisted: boolean }[]>`
      INSERT INTO members (line_user_id, display_name, avatar_url)
      VALUES (${profile.sub}, ${profile.name}, ${profile.picture ?? null})
      ON CONFLICT (line_user_id) DO UPDATE SET display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url, updated_at = now()
      RETURNING id, display_name, role, is_blacklisted
    `;
    if (member.is_blacklisted) return NextResponse.json({ error: "此帳號無法使用線上預約。" }, { status: 403 });
    await setAdminCookie(makeAdminSession(member.id));
    return NextResponse.json({ member: { displayName: member.display_name, role: member.role } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "LINE 登入失敗" }, { status: 500 }); }
}
