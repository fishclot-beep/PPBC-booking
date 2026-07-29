"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LineLoginGate } from "@/components/line-login-gate";

export default function NotificationPage() {
  return <LineLoginGate><NotificationSetup /></LineLoginGate>;
}

function NotificationSetup() {
  const [code, setCode] = useState("");
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState("");
  const check = () => fetch("/api/admin/notification-link").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setLinked(data.linked); }).catch((issue) => setError(issue.message));
  useEffect(() => { check(); }, []);
  const create = async () => { setError(""); const response = await fetch("/api/admin/notification-link", { method: "POST" }); const data = await response.json(); if (!response.ok) { setError(data.error); return; } setCode(data.code); };
  return <main className="app-shell"><header className="topbar"><Link className="brand" href="/admin">← PPBC 籃球俱樂部</Link></header><section className="hero"><p className="eyebrow">LINE NOTIFICATIONS</p><h1>綁定<em>管理通知。</em></h1><p>此綁定只決定誰會收到預約異動通知，不會改變您的系統登入帳號。</p></section><section className="booking-card"><h2>{linked ? "已完成通知綁定" : "尚未綁定通知 LINE"}</h2>{linked ? <p className="notice">此管理員帳號已可接收 PPBC 的預約異動通知。</p> : <><p>按下按鈕產生 15 分鐘有效的綁定碼，再將該碼傳送給「PPBC 爸爸籃球俱樂部」官方帳號。</p><button className="confirm" onClick={create}>產生綁定碼</button>{code && <section className="checkout"><p className="eyebrow">請傳送以下文字給官方帳號</p><strong className="price">{code}</strong><p className="payment-hint">傳送成功後，官方帳號會回覆「已綁定完成」。</p></section>}</>}</section></main>;
}
