"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LineLoginGate } from "@/components/line-login-gate";

type Session = { id: string; title: string; note?: string | null; starts_at: string; ends_at: string; capacity: number; price_type: "private" | "per_person"; price_amount: number; booked_seats: number };
const money = (value: number) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);

export default function Page() { return <LineLoginGate><Home /></LineLoginGate>; }

function Home() {
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(date); }), []);
  const [items, setItems] = useState<Session[]>([]);
  const [seats, setSeats] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const load = () => fetch(`/api/sessions?from=${dates[0]}&to=${dates[dates.length - 1]}`).then((response) => response.json()).then(setItems);
  useEffect(() => { void load(); }, []);
  const book = async (id: string) => { const count = seats[id] ?? 1; const response = await fetch(`/api/sessions/${id}/reserve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seats: count }) }); const payload = await response.json(); if (!response.ok) { alert(payload.error); return; } setNotice(`已成功保留 ${count} 個名額。`); void load(); };
  const stamp = (value: string) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  return <>
    <main className="app-shell">
      <header className="topbar"><Link className="brand" href="/">◒ PPBC 籃球俱樂部</Link><nav><Link className="active" href="/">立即預約</Link><Link href="/my-bookings">我的預約</Link><Link href="/admin">管理後台</Link></nav></header>
      <section className="hero"><p className="eyebrow">ONLINE BOOKING</p><h1>選擇場次，<em>立即報名。</em></h1><p>顯示未來 7 天、由管理員開放的預約場次。</p></section>
      <section className="booking-card"><h2>近期可預約場次</h2><div className="session-list">
        {items.length === 0 ? <div className="empty-selection">未來 7 天尚未開放任何預約場次。</div> : items.map((session) => {
          const remaining = session.capacity === 0 ? 5 : Math.max(0, session.capacity - session.booked_seats);
          const count = seats[session.id] ?? 1;
          return <article className="session-card" key={session.id}><div><p className="eyebrow">{stamp(session.starts_at)}</p><h2>{session.title}</h2>{session.note && <p className="session-note">備註：{session.note}</p>}<span>{session.capacity === 0 ? "不限人數" : `剩餘 ${remaining}/${session.capacity} 名`}・{session.price_type === "private" ? "包場" : "單人"}費用 {money(Number(session.price_amount))}</span></div><div className="session-actions"><label>預約人數<select value={count} onChange={(event) => setSeats({ ...seats, [session.id]: Number(event.target.value) })}>{Array.from({ length: Math.min(5, remaining) }, (_, index) => <option key={index} value={index + 1}>{index + 1} 人</option>)}</select></label><button className="confirm" disabled={!remaining} onClick={() => void book(session.id)}>{remaining ? "立即預約" : "名額已滿"}</button></div></article>;
        })}
      </div></section>
    </main>
    {notice && <div className="success-modal"><section><p>預約成功</p><h2>已為您保留名額</h2><span>{notice}</span><button className="confirm" onClick={() => setNotice("")}>知道了</button></section></div>}
  </>;
}
