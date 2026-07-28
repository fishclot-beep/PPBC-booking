"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { LineLoginGate } from "@/components/line-login-gate";
import styles from "./page.module.css";

type Tab = "overview" | "venue" | "admins" | "members";
type Admin = { id: string; display_name: string; line_user_id: string };
type Member = { id: string; display_name: string; line_user_id: string; role: string; is_blacklisted: boolean; created_at: string; booking_count: number };
type AvailabilityRule = { id: string; rule_kind: string; starts_at: string; ends_at: string; note: string | null; resource_codes: string[] };
const resourceCodes = ["BB_FULL", "BADMINTON"];

export default function AdminPage() {
  return <LineLoginGate><AdminDashboard /></LineLoginGate>;
}

function AdminDashboard() {
  const [accessDenied, setAccessDenied] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [venueName, setVenueName] = useState("動力運動館");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [newAdmin, setNewAdmin] = useState({ name: "", line: "" });
  const today = useMemo(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [closure, setClosure] = useState({ startHour: "09", endHour: "10", ruleKind: "admin_lock", note: "" });

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
      request<Member[]>(`/api/admin/members?q=${encodeURIComponent(memberQuery)}`), request<AvailabilityRule[]>(`/api/admin/availability?date=${selectedDate}`),
    ]);
    setVenueName(venue.display_name); setAdmins(currentAdmins); setMembers(currentMembers); setRules(currentRules);
  };

  useEffect(() => { void loadData().catch((issue) => { setAccessDenied(true); setError(issue instanceof Error ? issue.message : "無法取得管理權限"); }); }, []);
  useEffect(() => { if (!accessDenied) void request<Member[]>(`/api/admin/members?q=${encodeURIComponent(memberQuery)}`).then(setMembers).catch((issue) => setError(issue.message)); }, [memberQuery, accessDenied]);
  useEffect(() => { if (!accessDenied) void request<AvailabilityRule[]>(`/api/admin/availability?date=${selectedDate}`).then(setRules).catch((issue) => setError(issue.message)); }, [selectedDate, accessDenied]);
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
    if (Number(closure.startHour) >= Number(closure.endHour)) { setError("結束時間必須晚於開始時間。"); return; }
    try {
      await request("/api/admin/availability", { method: "POST", body: JSON.stringify({
        startsAt: `${selectedDate}T${closure.startHour}:00:00+08:00`, endsAt: `${selectedDate}T${closure.endHour}:00:00+08:00`,
        resourceCodes, ruleKind: closure.ruleKind, note: closure.note || "管理員設定暫停預約",
      }) });
      setRules(await request<AvailabilityRule[]>(`/api/admin/availability?date=${selectedDate}`));
      setNotice(`${selectedDate} ${closure.startHour}:00–${closure.endHour}:00 已暫停預約。`);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "時段更新失敗"); }
  };
  const removeRule = async (rule: AvailabilityRule) => {
    setError(""); setNotice("");
    try { await request("/api/admin/availability", { method: "DELETE", body: JSON.stringify({ id: rule.id }) }); setRules((current) => current.filter((item) => item.id !== rule.id)); setNotice("此暫停時段已恢復開放。"); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "時段更新失敗"); }
  };

  if (accessDenied) return <main className={styles.loginPage}><section className={styles.loginCard}><p>LINE ADMIN</p><h1>尚未取得後台權限</h1><span>您已使用 LINE 登入，但此 LINE 帳號尚未被設定為管理員。請由既有管理員在會員名單中授權。</span>{error && <p className={styles.error}>{error}</p>}</section></main>;

  const closedHours = rules.reduce((sum, rule) => sum + Math.max(0, new Date(rule.ends_at).getTime() - new Date(rule.starts_at).getTime()) / 3_600_000, 0);
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>◒ {venueName}</Link><span>管理員後台</span></header>
    <section className={styles.intro}><p>ADMIN DASHBOARD</p><h1>場館管理中心</h1><span>所有後台異動會直接寫入 PostgreSQL 資料庫。</span></section>
    <nav className={styles.tabs} aria-label="管理功能">{([ ["overview", "營運看板"], ["venue", "場館與時段"], ["admins", "管理人員"], ["members", "會員名單"] ] as [Tab, string][]).map(([key, label]) => <button key={key} className={tab === key ? styles.activeTab : ""} onClick={() => { setTab(key); setNotice(""); setError(""); }}>{label}</button>)}</nav>
    {notice && <p className={styles.notice}>{notice}</p>}{error && <p className={styles.error}>{error}</p>}

    {tab === "overview" && <Overview venueName={venueName} closedCount={closedHours} memberCount={members.length} />}
    {tab === "venue" && <section className={styles.gridTwo}>
      <form className={styles.panel} onSubmit={saveVenue}><div className={styles.panelTitle}><div><p>VENUE PROFILE</p><h2>場館名稱</h2></div></div><label className={styles.field}>顯示名稱<input value={venueName} maxLength={40} onChange={(event) => setVenueName(event.target.value)} /></label><p className={styles.help}>名稱會顯示在會員預約頁面與 LINE 通知。儲存後會保留。</p><button className={styles.primaryButton}>儲存名稱</button></form>
      <section className={styles.panel}><div className={styles.panelTitle}><div><p>BOOKING HOURS</p><h2>暫停預約時段</h2></div><span className={styles.statusPill}>{closedHours} 小時暫停</span></div><p className={styles.help}>選擇日期與起訖時間後儲存，即可一次暫停一整段時間的全場館預約。</p><form className={styles.closureForm} onSubmit={createClosure}><label className={styles.field}>日期<input type="date" min={today} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} required /></label><div className={styles.timeFields}><label className={styles.field}>開始<select value={closure.startHour} onChange={(event) => setClosure({ ...closure, startHour: event.target.value })}>{Array.from({ length: 15 }, (_, index) => index + 8).map((hour) => <option value={String(hour).padStart(2, "0")} key={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label><label className={styles.field}>結束<select value={closure.endHour} onChange={(event) => setClosure({ ...closure, endHour: event.target.value })}>{Array.from({ length: 15 }, (_, index) => index + 9).map((hour) => <option value={String(hour).padStart(2, "0")} key={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label></div><label className={styles.field}>原因（可不填）<input placeholder="例如：活動包場、場地維護" value={closure.note} onChange={(event) => setClosure({ ...closure, note: event.target.value })} /></label><button className={styles.primaryButton}>暫停這段時間的預約</button></form><div className={styles.ruleList}><h3>{selectedDate} 已暫停的時段</h3>{rules.length === 0 ? <p className={styles.help}>這一天目前全部開放。</p> : rules.map((rule) => <div className={styles.ruleRow} key={rule.id}><div><strong>{formatTime(rule.starts_at)}–{formatTime(rule.ends_at)}</strong><small>{rule.note || "暫停預約"}</small></div><button type="button" onClick={() => void removeRule(rule)}>恢復開放</button></div>)}</div></section>
    </section>}
    {tab === "admins" && <section className={styles.gridTwo}>
      <form className={styles.panel} onSubmit={addAdmin}><div className={styles.panelTitle}><div><p>ADD ADMIN</p><h2>新增管理人員</h2></div></div><label className={styles.field}>姓名<input placeholder="例如：李小華" value={newAdmin.name} onChange={(event) => setNewAdmin({ ...newAdmin, name: event.target.value })} required /></label><label className={styles.field}>LINE 使用者 ID<input placeholder="例如：Uxxxxxxxx" value={newAdmin.line} onChange={(event) => setNewAdmin({ ...newAdmin, line: event.target.value })} required /></label><button className={styles.primaryButton}>新增管理員</button></form>
      <section className={styles.panel}><div className={styles.panelTitle}><div><p>ACCESS LIST</p><h2>目前管理人員</h2></div></div><div className={styles.list}>{admins.map((admin) => <div className={styles.adminRow} key={admin.id}><span className={styles.avatar}>{admin.display_name.slice(0, 1)}</span><div><strong>{admin.display_name}</strong><small>{admin.line_user_id}</small></div><span className={styles.role}>管理員</span></div>)}</div></section>
    </section>}
    {tab === "members" && <section className={styles.panel}><div className={styles.panelTitle}><div><p>MEMBER DIRECTORY</p><h2>會員名單</h2></div><input className={styles.search} value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="搜尋姓名或 LINE ID" /></div><div className={styles.memberTable}><div className={styles.memberHead}><span>會員</span><span>加入日期</span><span>預約次數</span><span>角色</span><span>狀態</span></div>{members.map((member) => <div className={styles.memberRow} key={member.id}><div><strong>{member.display_name}</strong><small>{member.line_user_id}</small></div><span>{new Intl.DateTimeFormat("zh-TW").format(new Date(member.created_at))}</span><span>{member.booking_count} 次</span><span>{member.role === "admin" ? "管理員" : "一般會員"}</span><span className={member.is_blacklisted ? styles.blacklisted : styles.normal}>{member.is_blacklisted ? "黑名單" : "正常"}</span></div>)}{members.length === 0 && <p className={styles.noResult}>沒有符合條件的會員。</p>}</div></section>}
  </main>;
}

function Overview({ venueName, closedCount, memberCount }: { venueName: string; closedCount: number; memberCount: number }) {
  return <section className={styles.metrics}><article><span>會員人數</span><strong>{memberCount}</strong><small>{venueName}</small></article><article><span>今日暫停時段</span><strong>{closedCount}</strong><small>可在場館與時段管理</small></article><article><span>系統狀態</span><strong>ON</strong><small>已連線 PostgreSQL</small></article></section>;
}
