import { db } from "@/lib/db";

type BookingNotice = {
  action: "首次預約" | "更改預約人數" | "取消預約";
  memberName: string;
  title: string;
  startsAt: string | Date;
  seats: number;
  previousSeats?: number;
};

function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export async function notifyAdminsOfBookingChange(notice: BookingNotice) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;

  const admins = await db()<{ line_user_id: string }[]>`
    SELECT line_user_id FROM members
    WHERE role = 'admin' AND line_user_id <> ''
  `;
  if (admins.length === 0) return;

  const count = notice.previousSeats === undefined
    ? `${notice.seats} 人`
    : `${notice.previousSeats} 人 → ${notice.seats} 人`;
  const text = [
    "【PPBC 預約異動通知】",
    `類型：${notice.action}`,
    `會員：${notice.memberName}`,
    `場次：${notice.title}`,
    `時間：${formatTime(notice.startsAt)}`,
    `人數：${count}`,
  ].join("\n");

  await Promise.allSettled(admins.map(({ line_user_id }) => fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: line_user_id, messages: [{ type: "text", text }] }),
    cache: "no-store",
  })));
}
