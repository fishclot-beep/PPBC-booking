import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db, ensureSessionSchema } from "@/lib/db";

type LineEvent = { type: string; replyToken?: string; source?: { type?: string; userId?: string }; message?: { type?: string; text?: string } };

export async function POST(request: Request) {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (!secret) return NextResponse.json({ error: "LINE_MESSAGING_CHANNEL_SECRET 尚未設定。" }, { status: 500 });
  const body = await request.text();
  const received = request.headers.get("x-line-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return new NextResponse("Invalid signature", { status: 401 });

  await ensureSessionSchema();
  const events = (JSON.parse(body) as { events?: LineEvent[] }).events ?? [];
  await Promise.all(events.map(handleEvent));
  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineEvent) {
  const code = event.type === "message" && event.message?.type === "text" && event.message.text ? event.message.text.trim().toUpperCase() : "";
  const userId = event.source?.type === "user" ? event.source.userId : undefined;
  if (!code.startsWith("PPBC-") || !userId) return;

  const linked = await db().begin(async (sql) => {
    const [link] = await sql<{ member_id: string }[]>`SELECT member_id FROM line_notification_links WHERE code=${code} AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`;
    if (!link) return false;
    await sql`UPDATE members SET messaging_line_user_id=${userId}, updated_at=now() WHERE id=${link.member_id}`;
    await sql`UPDATE line_notification_links SET consumed_at=now() WHERE code=${code}`;
    return true;
  });
  if (linked && event.replyToken && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
      body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: "text", text: "PPBC 管理通知已綁定完成。之後有預約異動會通知您。" }] }),
      cache: "no-store",
    });
  }
}
