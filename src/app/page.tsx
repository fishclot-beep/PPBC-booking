"use client";

import { useMemo, useState } from "react";
import { LineLoginGate } from "@/components/line-login-gate";

type ResourceCode =
  | "BB_FULL"
  | "BB_LEFT"
  | "BB_RIGHT"
  | "BADMINTON"
  | "MACHINE_A"
  | "MACHINE_B";

type Resource = { code: ResourceCode; name: string; shortName: string; hourly: number };
type Occupancy = { keys: string[]; start: number; end: number; label: string; kind: "booked" | "course" | "locked" };

const resources: Resource[] = [
  { code: "BB_FULL", name: "籃球全場", shortName: "全場", hourly: 1800 },
  { code: "BB_LEFT", name: "籃球左半場", shortName: "左半場", hourly: 1000 },
  { code: "BB_RIGHT", name: "籃球右半場", shortName: "右半場", hourly: 1000 },
  { code: "BADMINTON", name: "羽球場", shortName: "羽球", hourly: 650 },
  { code: "MACHINE_A", name: "發球機 A（左半場）", shortName: "發球 A", hourly: 1200 },
  { code: "MACHINE_B", name: "發球機 B（右半場）", shortName: "發球 B", hourly: 1200 },
];

const seededOccupancies: Occupancy[] = [
  { keys: ["basketball:left"], start: 10, end: 12, label: "發球機 A 已預約", kind: "booked" },
  { keys: ["badminton:main"], start: 13, end: 15, label: "羽球場已預約", kind: "booked" },
  { keys: ["basketball:left", "basketball:right"], start: 16, end: 18, label: "籃球訓練課程", kind: "course" },
  { keys: ["basketball:right"], start: 20, end: 22, label: "右半場維護", kind: "locked" },
];

const hours = Array.from({ length: 16 }, (_, index) => index + 8);
const conflictKeys: Record<ResourceCode, string[]> = {
  BB_FULL: ["basketball:left", "basketball:right"],
  BB_LEFT: ["basketball:left"],
  BB_RIGHT: ["basketball:right"],
  BADMINTON: ["badminton:main"],
  MACHINE_A: ["basketball:left"],
  MACHINE_B: ["basketball:right"],
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(amount);
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", weekday: "short" }).format(date);
}

export default function BookingPage() {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + index);
    return day;
  }), []);
  const [activeDate, setActiveDate] = useState(0);
  const [occupancies, setOccupancies] = useState(seededOccupancies);
  const [selectedResource, setSelectedResource] = useState<ResourceCode | null>(null);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [duration, setDuration] = useState(2);
  const [people, setPeople] = useState(2);
  const [notice, setNotice] = useState("");

  const isBlocked = (code: ResourceCode, hour: number) => {
    const matchesOccupancy = occupancies.some((occupancy) =>
      occupancy.keys.some((key) => conflictKeys[code].includes(key)) && hour >= occupancy.start && hour < occupancy.end,
    );
    const fullOnly = hour >= 22 && code !== "BB_FULL" && code !== "BADMINTON";
    return matchesOccupancy || fullOnly;
  };

  const isRangeAvailable = (code: ResourceCode, start: number, hoursToBook: number) =>
    start + hoursToBook <= 24 && Array.from({ length: hoursToBook }, (_, index) => !isBlocked(code, start + index)).every(Boolean);

  const selectCell = (code: ResourceCode, hour: number) => {
    setNotice("");
    if (isBlocked(code, hour)) return;
    setSelectedResource(code);
    setStartHour(hour);
    setDuration(2);
  };

  const selected = resources.find((resource) => resource.code === selectedResource);
  const quoteAvailable = selectedResource !== null && startHour !== null && isRangeAvailable(selectedResource, startHour, duration);
  const price = selected ? selected.hourly * duration : 0;

  const confirmBooking = () => {
    if (!selected || startHour === null || !quoteAvailable) {
      setNotice("請選擇一段連續至少 2 小時的可預約時段。");
      return;
    }
    setOccupancies((current) => [...current, {
      keys: conflictKeys[selected.code], start: startHour, end: startHour + duration,
      label: "您剛完成的預約", kind: "booked",
    }]);
    setNotice(people >= 3 ? "已送出預約，因預約人數達 3 人，訂單目前為待核款。" : "預約已送出，系統將以 LINE 通知您。" );
    setSelectedResource(null);
    setStartHour(null);
  };

  return (
    <LineLoginGate><main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="動力運動館首頁"><span>◒</span> 動力運動館</a>
        <nav><a className="active" href="/">立即預約</a><a href="#my-bookings">我的預約</a><a href="/admin">管理後台</a></nav>
      </header>

      <section className="hero">
        <p className="eyebrow">ONLINE BOOKING</p>
        <h1>選擇一段時間，<em>開始運動。</em></h1>
        <p>每日 08:00–24:00 開放；最少預約 2 小時。預約開放至未來 7 天。</p>
      </section>

      <section className="booking-card" aria-label="預約課表">
        <div className="section-heading"><div><p className="eyebrow">STEP 1</p><h2>選擇日期與場地</h2></div><span className="availability-dot">即時空位</span></div>
        <div className="date-strip" role="tablist" aria-label="選擇日期">
          {days.map((date, index) => <button key={date.toISOString()} className={index === activeDate ? "date active-date" : "date"} onClick={() => { setActiveDate(index); setNotice(""); }} role="tab" aria-selected={index === activeDate}>{index === 0 ? "今天" : dateLabel(date)}</button>)}
        </div>

        <div className="timeline-wrap">
          <div className="timeline-grid" role="grid" aria-label="場地時間軸">
            <div className="grid-head time-head">時間</div>
            {resources.map((resource) => <div className="grid-head" key={resource.code}><span className="desktop-name">{resource.name}</span><span className="mobile-name">{resource.shortName}</span></div>)}
            {hours.map((hour) => <div className="grid-row" key={hour}>
              <div className="time-cell">{String(hour).padStart(2, "0")}:00</div>
              {resources.map((resource) => {
                const blocked = isBlocked(resource.code, hour);
                const isSelected = selectedResource === resource.code && startHour !== null && hour >= startHour && hour < startHour + duration;
                const occupancy = occupancies.find((item) => item.keys.some((key) => conflictKeys[resource.code].includes(key)) && hour >= item.start && hour < item.end);
                const fullOnly = !occupancy && hour >= 22 && resource.code !== "BB_FULL" && resource.code !== "BADMINTON";
                return <button key={resource.code} className={`slot ${blocked ? "blocked" : ""} ${isSelected ? "selected" : ""} ${occupancy?.kind ?? ""}`} onClick={() => selectCell(resource.code, hour)} disabled={blocked} title={occupancy?.label ?? (fullOnly ? "此時段僅開放籃球全場" : "可預約")}>{occupancy && <span>{occupancy.kind === "course" ? "課程" : occupancy.kind === "locked" ? "維護" : "已訂"}</span>}{fullOnly && <span>全場限定</span>}</button>;
              })}
            </div>)}
          </div>
        </div>
        <div className="legend"><span><i className="swatch available" /> 可預約</span><span><i className="swatch selected-swatch" /> 已選取</span><span><i className="swatch booked-swatch" /> 已占用／維護</span><span><i className="swatch course-swatch" /> 訓練課程</span></div>
      </section>

      <section className="checkout" aria-live="polite">
        <div className="section-heading"><div><p className="eyebrow">STEP 2</p><h2>確認預約內容</h2></div>{selected && <span className="price">{formatCurrency(price)}</span>}</div>
        {!selected || startHour === null ? <div className="empty-selection">請從上方課表選擇一個可預約時段。</div> : <div className="checkout-content">
          <div className="summary"><strong>{selected.name}</strong><span>{dateLabel(days[activeDate])}・{String(startHour).padStart(2, "0")}:00–{String(startHour + duration).padStart(2, "0")}:00</span></div>
          <label>預約時數<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((value) => <option value={value} key={value} disabled={!isRangeAvailable(selected.code, startHour, value)}>{value} 小時{!isRangeAvailable(selected.code, startHour, value) ? "（時段不足）" : ""}</option>)}</select></label>
          <label>預約人數<select value={people} onChange={(event) => setPeople(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} 人</option>)}</select></label>
          {people >= 3 && <p className="payment-hint">3 人以上須先轉帳，送出後將顯示為「待核款」。</p>}
          <button className="confirm" onClick={confirmBooking} disabled={!quoteAvailable}>確認預約・{formatCurrency(price)}</button>
        </div>}
        {notice && <p className="notice">{notice}</p>}
      </section>
    </main></LineLoginGate>
  );
}
