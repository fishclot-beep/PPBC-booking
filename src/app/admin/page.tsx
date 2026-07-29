"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { LineLoginGate } from "@/components/line-login-gate";
import styles from "./page.module.css";

type Tab = "overview" | "venue" | "admins" | "members";
type Admin = { id: string; display_name: string; line_user_id: string };
type Member = { id: string; display_name: string; line_user_id: string; role: string; is_blacklisted: boolean; created_at: string; booking_count: number };
type Session = { id: string; title: string; starts_at: string; ends_at: string; capacity: number; price_type: "private" | "per_person"; price_amount: number; booked_seats: number; actual_collected: number | null; closed_at: string | null };
type Reservation = { id: string; display_name: string; seats: number; created_at: string };

export default function AdminPage() {
  return <LineLoginGate><AdminDashboard /></LineLoginGate>;
}

function AdminDashboard() {
  const [accessDenied, setAccessDenied] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [venueName, setVenueName] = useState("PPBC 籃球俱樂部");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [rules, setRules] = useState<Session[]>([]);
  const [newAdmin, setNewAdmin] = useState({ name: "", line: "" });
  const today = useMemo(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [monthRules, setMonthRules] = useState<Session[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [collectedAmounts, setCollectedAmounts] = useState<Record<string, string>>({});
  const [collectors, setCollectors] = useState<Record<string, string>>({});
  const [closure, setClosure] = useState({ startHour: "20", endHour: "22", title: "", capacity: "0", priceType: "per_person", priceAmount: "" });
  const monthRange = useMemo(() => {
    const [year, month] = calendarMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    return { start: `${calendarMonth}-01`, end: next, lastDay, firstWeekday: new Date(year, month - 1, 1).getDay() };
  }, [calendarMonth]);
  const calendarDays = useMemo(() => Array.from({ length: monthRange.firstWeekday + monthRange.lastDay }, (_, index) => index < monthRange.firstWeekday ? null : `${calendarMonth}-${String(index - monthRange.firstWeekday + 1).padStart(2, "0")}`), [calendarMonth, monthRange]);

  const request = async <T,>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "操作失敗，請稍後再試。");
    }
    return response.status === 204 ? (undefined as T) : response.json();
  };

  const loadData = async () => {
    const [venue, currentAdmins, currentMembers, currentRules] = await Promise.all([
      request<{ display_name: string }>("/api/admin/venue"), request<Admin[]>("/api/admin/admins"),
      request<Member[]>(`/api/admin/members?q=${encodeURIComponent(memberQuery)}`), request<Session[]>(`/api/admin/sessions?date=${selectedDate}`),
    ]);
    setVenueName(venue.display_name); setAdmins(currentAdmins); setMembers(currentMembers); setRules(currentRules);
  };

  useEffect(() => { void loadData().catch((issue) => { setAccessDenied(true); setError(issue instanceof Error ? issue.message : "無法取得管理權限"); }); }, []);
  useEffect(() => { if (!accessDenied) void request<Member[]>(`/api/admin/members?q=${encodeURIComponent(memberQuery)}`).then(setMembers).catch((issue) => setError(issue.message)); }, [memberQuery, accessDenied]);
  useEffect(() => { if (!accessDenied) void request<Session[]>(`/api/admin/sessions?date=${selectedDate}`).then(setRules).catch((issue) => setError(issue.message)); }, [selectedDate, accessDenied]);
  useEffect(() => { if (!accessDenied) Promise.all(Array.from({ length: monthRange.lastDay }, (_, i) => request<Session[]>(`/api/admin/sessions?date=${calendarMonth}-${String(i + 1).padStart(2, "0")}`))).then((items) => setMonthRules(items.flat())).catch((issue) => setError(issue.message)); }, [calendarMonth, monthRange.lastDay, accessDenied]);
  const saveVenue = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    try { const result = await request<{ display_name: string }>("/api/admin/venue", { method: "PUT", body: JSON.stringify({ displayName: venueName }) }); setVenueName(result.display_name); setNotice("場館名稱已儲存。"); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "儲存失敗"); }
  };
  const addAdmin = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    try { const admin = await request<Admin>("/api/admin/admins", { method: "POST", body: JSON.stringify({ displayName: newAdmin.name, lineUserId: newAdmin.line }) }); setAdmins((current) => [...current, admin]); setNewAdmin({ name: "", line: "" }); setNotice("管理人員已新增並寫入資料庫。"); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "新增失敗"); }
  };
  const formatTime = (value: string) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  const createClosure = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setNotice("");
    if (Number(closure.startHour) >= Number(closure.endHour)) { setError("結束時間必須晚於開始時間。00:00 代表隔日凌晨。 "); return; }
    try {
      const endsAt = closure.endHour === "24"
        ? new Date(new Date(`${selectedDate}T00:00:00+08:00`).getTime() + 24 * 3_600_000).toISOString()
        : `${selectedDate}T${closure.endHour}:00:00+08:00`;
      await request("/api/admin/sessions", { method: "POST", body: JSON.stringify({
        title: closure.title, startsAt: `${selectedDate}T${closure.startHour}:00:00+08:00`, endsAt,
        capacity: Number(closure.capacity), priceType: closure.priceType, priceAmount: Number(closure.priceAmount || 0),
      }) });
      setRules(await request<Session[]>(`/api/admin/sessions?date=${selectedDate}`));
      setNotice("預約場次已建立。");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "時段更新失敗"); }
  };
  const removeRule = async (rule: Session) => {
    setError(""); setNotice("");
    try { await request("/api/admin/sessions", { method: "DELETE", body: JSON.stringify({ id: rule.id }) }); setRules((current) => current.filter((item) => item.id !== rule.id)); setMonthRules((current) => current.filter((item) => item.id !== rule.id)); setNotice("場次已刪除。"); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "時段更新失敗"); }
  };
  const viewReservations = async (session: Session) => { setViewingSession(session); setReservations(await request<Reservation[]>(`/api/admin/sessions/${session.id}/reservations`)); };
  const cancelReservation = async (reservationId: string) => { if (!viewingSession) return; const seatsToRemove = reservations.find((item) => item.id === reservationId)?.seats ?? 0; await request(`/api/admin/sessions/${viewingSession.id}/reservations`, { method: "DELETE", body: JSON.stringify({ reservationId }) }); setReservations((current) => current.filter((item) => item.id !== reservationId)); setRules((current) => current.map((item) => item.id === viewingSession.id ? { ...item, booked_seats: Math.max(0, item.booked_seats - seatsToRemove) } : item)); setNotice("會員預約已取消。"); };
  const closeSession = async (session: Session) => { const value = Number(collectedAmounts[session.id] ?? ""); if (!Number.isFinite(value) || value < 0) { setError("請輸入有效的實收金額。"); return; } const updated = await request<Session>("/api/admin/sessions", { method: "PATCH", body: JSON.stringify({ id: session.id, actualCollected: value, collectorId: collectors[session.id] }) }); setMonthRules((current) => current.map((item) => item.id === session.id ? { ...item, ...updated } : item)); setNotice("此場次已結案。 "); };

  if (accessDenied) return <main className={styles.loginPage}><section className={styles.loginCard}><p>LINE ADMIN</p><h1>尚未取得後台權限</h1><span>您已使用 LINE 登入，但此 LINE 帳號尚未被設定為管理員。請由既有管理員在會員名單中授權。</span>{error && <p className={styles.error}>{error}</p>}</section></main>;

  const closedHours = rules.length;
  const closedDateKeys = new Set(monthRules.map((rule) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date(rule.starts_at))));
  const moveMonth = (offset: number) => { const [year, month] = calendarMonth.split("-").map(Number); const date = new Date(year, month - 1 + offset, 1); setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`); };
  const upcomingSessions = monthRules.filter((rule) => new Date(rule.starts_at) >= new Date(`${today}T00:00:00+08:00`)).slice(0, 20);
  const expectedAmount = (session: Session) => Number(session.price_amount) * (session.price_type === "per_person" ? session.booked_seats : 1);
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>◒ {venueName}</Link><span>管理員後台</span></header>
    <section className={styles.intro}><p>ADMIN DASHBOARD</p><h1>場館管理中心</h1><span>所有後台異動會直接寫入 PostgreSQL 資料庫。</span></section>
    <nav className={styles.tabs} aria-label="管理功能">{([ ["overview", "營運看板"], ["venue", "場館與時段"], ["admins", "管理人員"], ["members", "會員名單"] ] as [Tab, string][]).map(([key, label]) => <button key={key} className={tab === key ? styles.activeTab : ""} onClick={() => { setTab(key); setNotice(""); setError(""); }}>{label}</button>)}</nav>
    {notice && <p className={styles.notice}>{notice}</p>}{error && <p className={styles.error}>{error}</p>}

    {tab === "overview" && <Operations sessions={monthRules} admins={admins} values={collectedAmounts} collectors={collectors} setValues={setCollectedAmounts} setCollectors={setCollectors} closeSession={closeSession} expectedAmount={expectedAmount} />}
    {tab === "venue" && <section className={styles.gridTwo}>
      <div className={styles.venueColumn}><form className={styles.panel} onSubmit={saveVenue}><div className={styles.panelTitle}><div><p>VENUE PROFILE</p><h2>場館名稱</h2></div></div><label className={styles.field}>顯示名稱<input value={venueName} maxLength={40} onChange={(event) => setVenueName(event.target.value)} /></label><p className={styles.help}>名稱會顯示在會員預約頁面與 LINE 通知。儲存後會保留。</p><button className={styles.primaryButton}>儲存名稱</button></form><section className={`${styles.panel} ${styles.calendarPanel}`}><div className={styles.calendarNav}><button type="button" onClick={() => moveMonth(-1)} aria-label="上個月">‹</button><strong>{calendarMonth.replace("-", " 年 ")} 月</strong><button type="button" onClick={() => moveMonth(1)} aria-label="下個月">›</button></div><div className={styles.weekdays}>{["日", "一", "二", "三", "四", "五", "六"].map((day) => <span key={day}>{day}</span>)}</div><div className={styles.calendarGrid}>{calendarDays.map((date, index) => date ? <button type="button" key={date} className={`${styles.calendarDay} ${selectedDate === date ? styles.selectedDay : ""} ${closedDateKeys.has(date) ? styles.hasClosure : ""}`} onClick={() => setSelectedDate(date)}><span>{index - monthRange.firstWeekday + 1}</span>{closedDateKeys.has(date) && <i aria-label="已有暫停時段" />}</button> : <span key={`empty-${index}`} />)}</div><p className={styles.help}><i className={styles.legendDot} /> 有色圓點代表當日已有暫停預約時段。</p></section></div>
      <section className={styles.panel}><div className={styles.panelTitle}><div><p>BOOKING SESSIONS</p><h2>{selectedDate} 預約場次</h2></div><span className={styles.statusPill}>{closedHours} 個場次</span></div><p className={styles.help}>預設沒有可預約時段。請在月曆選日期後，建立會員可報名的場次。</p><form className={styles.closureForm} onSubmit={createClosure}><label className={styles.field}>場次名稱<input required placeholder="例如：週二揪團" value={closure.title} onChange={(event) => setClosure({ ...closure, title: event.target.value })} /></label><div className={styles.timeFields}><label className={styles.field}>開始<select value={closure.startHour} onChange={(event) => setClosure({ ...closure, startHour: event.target.value })}>{Array.from({ length: 15 }, (_, index) => index + 8).map((hour) => <option value={String(hour).padStart(2, "0")} key={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label><label className={styles.field}>結束<select value={closure.endHour} onChange={(event) => setClosure({ ...closure, endHour: event.target.value })}>{[...Array.from({ length: 15 }, (_, index) => index + 9), 24].map((hour) => <option value={String(hour).padStart(2, "0")} key={hour}>{hour === 24 ? "00:00（隔日）" : `${String(hour).padStart(2, "0")}:00`}</option>)}</select></label></div><label className={styles.field}>人數上限（0 代表不限）<input required type="number" min="0" max="30" value={closure.capacity} onChange={(event) => setClosure({ ...closure, capacity: event.target.value })} /></label><div className={styles.timeFields}><label className={styles.field}>收費方式<select value={closure.priceType} onChange={(event) => setClosure({ ...closure, priceType: event.target.value })}><option value="per_person">單人費用</option><option value="private">包場費用</option></select></label><label className={styles.field}>金額（元）<input type="number" min="0" value={closure.priceAmount} onChange={(event) => setClosure({ ...closure, priceAmount: event.target.value })} /></label></div><button className={styles.primaryButton}>新增可預約場次</button></form><div className={styles.ruleList}><h3>{selectedDate} 的已開放場次</h3>{rules.length === 0 ? <p className={styles.help}>尚未建立場次，會員無法預約。</p> : rules.map((rule) => <div className={styles.ruleRow} key={rule.id}><div><strong>{rule.title}・{formatTime(rule.starts_at)}–{formatTime(rule.ends_at)}</strong><small>{rule.capacity === 0 ? "不限人數" : `${rule.booked_seats}/${rule.capacity} 人`}・{rule.price_type === "private" ? "包場" : "單人"} NT$ {rule.price_amount}</small></div><button type="button" onClick={() => void removeRule(rule)}>刪除場次</button></div>)}</div></section>
    </section>}
    {tab === "venue" && <section className={styles.panel}><div className={styles.panelTitle}><div><p>UPCOMING SESSIONS</p><h2>近 7 天開放場次</h2></div></div><div className={styles.ruleList}>{upcomingSessions.length === 0 ? <p className={styles.help}>近 7 天尚未開放場次。</p> : upcomingSessions.map((session) => <div className={styles.ruleRow} key={`upcoming-${session.id}`}><div><strong>{new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", weekday: "short" }).format(new Date(session.starts_at))}・{session.title}</strong><small>{formatTime(session.starts_at)}–{formatTime(session.ends_at)}・{session.capacity === 0 ? "不限人數" : `${session.booked_seats}/${session.capacity} 人`}</small></div><button type="button" onClick={() => void viewReservations(session)}>查看預約</button></div>)}</div></section>}
    {viewingSession && <section className={styles.panel}><div className={styles.panelTitle}><div><p>RESERVATIONS</p><h2>{viewingSession.title} 的會員預約</h2></div><button type="button" onClick={() => setViewingSession(null)}>關閉</button></div><div className={styles.ruleList}>{reservations.length === 0 ? <p className={styles.help}>目前尚無會員預約。</p> : reservations.map((reservation) => <div className={styles.ruleRow} key={reservation.id}><div><strong>{reservation.display_name}</strong><small>預約 {reservation.seats} 人</small></div><button type="button" onClick={() => void cancelReservation(reservation.id)}>取消預約</button></div>)}</div></section>}
    {tab === "admins" && <section className={styles.gridTwo}>
      <form className={styles.panel} onSubmit={addAdmin}><div className={styles.panelTitle}><div><p>ADD ADMIN</p><h2>新增管理人員</h2></div></div><label className={styles.field}>姓名<input placeholder="例如：李小華" value={newAdmin.name} onChange={(event) => setNewAdmin({ ...newAdmin, name: event.target.value })} required /></label><label className={styles.field}>LINE 使用者 ID<input placeholder="例如：Uxxxxxxxx" value={newAdmin.line} onChange={(event) => setNewAdmin({ ...newAdmin, line: event.target.value })} required /></label><button className={styles.primaryButton}>新增管理員</button></form>
      <section className={styles.panel}><div className={styles.panelTitle}><div><p>ACCESS LIST</p><h2>目前管理人員</h2></div></div><div className={styles.list}>{admins.map((admin) => <div className={styles.adminRow} key={admin.id}><span className={styles.avatar}>{admin.display_name.slice(0, 1)}</span><div><strong>{admin.display_name}</strong><small>{admin.line_user_id}</small></div><span className={styles.role}>管理員</span></div>)}</div></section>
    </section>}
    {tab === "members" && <section className={styles.panel}><div className={styles.panelTitle}><div><p>MEMBER DIRECTORY</p><h2>會員名單</h2></div><input className={styles.search} value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="搜尋姓名或 LINE ID" /></div><div className={styles.memberTable}><div className={styles.memberHead}><span>會員</span><span>加入日期</span><span>預約次數</span><span>角色</span><span>狀態</span></div>{members.map((member) => <div className={styles.memberRow} key={member.id}><div><strong>{member.display_name}</strong><small>{member.line_user_id}</small></div><span>{new Intl.DateTimeFormat("zh-TW").format(new Date(member.created_at))}</span><span>{member.booking_count} 次</span><span>{member.role === "admin" ? "管理員" : "一般會員"}</span><span className={member.is_blacklisted ? styles.blacklisted : styles.normal}>{member.is_blacklisted ? "黑名單" : "正常"}</span></div>)}{members.length === 0 && <p className={styles.noResult}>沒有符合條件的會員。</p>}</div></section>}
  </main>;
}

function Operations({ sessions, admins, values, collectors, setValues, setCollectors, closeSession, expectedAmount }: { sessions: Session[]; admins: Admin[]; values: Record<string, string>; collectors: Record<string, string>; setValues: (value: Record<string, string>) => void; setCollectors: (value: Record<string, string>) => void; closeSession: (session: Session) => void; expectedAmount: (session: Session) => number }) {
  const open = sessions.filter((session) => !session.closed_at); const closed = sessions.filter((session) => session.closed_at); const expected = sessions.reduce((sum, session) => sum + expectedAmount(session), 0); const received = closed.reduce((sum, session) => sum + Number(session.actual_collected ?? 0), 0); const stamp = (v: string) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));
  return <><section className={styles.metrics}><article><span>未結案場次</span><strong>{open.length}</strong><small>等待收款或結案</small></article><article><span>累積應收</span><strong>NT$ {expected}</strong><small>單人費用依已預約人數計算</small></article><article><span>已收金額</span><strong>NT$ {received}</strong><small>{closed.length} 個已結案場次</small></article></section><section className={styles.panel}><div className={styles.panelTitle}><div><p>SETTLEMENT</p><h2>待結案場次</h2></div></div><div className={styles.ruleList}>{open.length === 0 ? <p className={styles.help}>目前沒有待結案場次。</p> : open.map((session) => <div className={styles.settlementRow} key={session.id}><div><strong>{stamp(session.starts_at)}・{session.title}</strong><small>{session.booked_seats} 人預約・應收 NT$ {expectedAmount(session)}</small></div><label>收款人<select value={collectors[session.id] ?? ""} onChange={(event) => setCollectors({ ...collectors, [session.id]: event.target.value })}><option value="">目前登入管理員</option>{admins.map((admin) => <option value={admin.id} key={admin.id}>{admin.display_name}</option>)}</select></label><label>實收<input type="number" min="0" placeholder="金額" value={values[session.id] ?? ""} onChange={(event) => setValues({ ...values, [session.id]: event.target.value })} /></label><button className={styles.primaryButton} type="button" onClick={() => closeSession(session)}>結案</button></div>)}</div></section><section className={styles.panel}><div className={styles.panelTitle}><div><p>COMPLETED</p><h2>已結案紀錄</h2></div></div><div className={styles.ruleList}>{closed.length === 0 ? <p className={styles.help}>尚無已結案場次。</p> : closed.map((session) => <div className={styles.ruleRow} key={session.id}><div><strong>{stamp(session.starts_at)}・{session.title}</strong><small>應收 NT$ {expectedAmount(session)}・實收 NT$ {session.actual_collected}</small></div><span className={styles.statusPill}>已結案</span></div>)}</div></section></>;
}
