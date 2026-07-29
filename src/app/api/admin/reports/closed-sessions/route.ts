import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db, ensureSessionSchema } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    await ensureSessionSchema();
    const rows = await db()<{
      starts_at: string; ends_at: string; title: string; price_type: "private" | "per_person";
      price_amount: number | string; booked_seats: number; actual_collected: number | string | null; closed_by_name: string | null;
    }[]>`
      SELECT s.starts_at, s.ends_at, s.title, s.price_type, s.price_amount,
        coalesce(sum(r.seats), 0)::int AS booked_seats, s.actual_collected, closer.display_name AS closed_by_name
      FROM booking_sessions s
      LEFT JOIN session_reservations r ON r.session_id = s.id
      LEFT JOIN members closer ON closer.id = s.closed_by
      WHERE s.closed_at IS NOT NULL
      GROUP BY s.id, closer.display_name
      ORDER BY s.starts_at DESC
    `;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PPBC 籃球俱樂部";
    const sheet = workbook.addWorksheet("已結案收款紀錄", { views: [{ state: "frozen", ySplit: 2 }] });
    sheet.mergeCells("A1:J1");
    const title = sheet.getCell("A1");
    title.value = "PPBC 籃球俱樂部｜已結案場次收款統計";
    title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF216C55" } };
    title.alignment = { horizontal: "center" };
    sheet.columns = [
      { header: "日期", key: "date", width: 14 }, { header: "開始", key: "start", width: 10 }, { header: "結束", key: "end", width: 10 }, { header: "場次名稱", key: "title", width: 30 }, { header: "收費方式", key: "priceType", width: 12 }, { header: "單價", key: "unit", width: 13 }, { header: "預約人數", key: "seats", width: 12 }, { header: "應收金額", key: "expected", width: 15 }, { header: "實收金額", key: "actual", width: 15 }, { header: "收款管理員", key: "collector", width: 18 },
    ];
    const header = sheet.getRow(2);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B7D68" } };
    const formatter = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" });
    const time = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false });
    rows.forEach((row) => { const unit = Number(row.price_amount); const seats = Number(row.booked_seats); sheet.addRow({ date: formatter.format(new Date(row.starts_at)), start: time.format(new Date(row.starts_at)), end: time.format(new Date(row.ends_at)), title: row.title, priceType: row.price_type === "private" ? "包場" : "單人費用", unit, seats, expected: row.price_type === "private" ? unit : unit * seats, actual: Number(row.actual_collected ?? 0), collector: row.closed_by_name ?? "未指定" }); });
    const total = sheet.addRow({ title: "合計", expected: { formula: `SUM(H3:H${rows.length + 2})` }, actual: { formula: `SUM(I3:I${rows.length + 2})` } });
    total.font = { bold: true }; total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCEFE6" } };
    for (const key of ["unit", "expected", "actual"]) sheet.getColumn(key).numFmt = 'NT$ #,##0';
    const bytes = await workbook.xlsx.writeBuffer();
    const filename = `PPBC-已結案收款統計-${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date())}.xlsx`;
    return new NextResponse(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "no-store" } });
  } catch (error) { if (error instanceof Response) return new NextResponse(error.body, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : "匯出失敗" }, { status: 500 }); }
}
