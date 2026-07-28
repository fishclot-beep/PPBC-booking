import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

const resourceKeys: Record<string, string[]> = {
  BB_FULL: ["basketball:left", "basketball:right"], BB_LEFT: ["basketball:left"], BB_RIGHT: ["basketball:right"],
  BADMINTON: ["badminton:main"], MACHINE_A: ["basketball:left"], MACHINE_B: ["basketball:right"],
};

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const date = params.get("date");
    const from = params.get("from");
    const to = params.get("to");
    const validDate = (value: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
    if (!validDate(date) && !(validDate(from) && validDate(to))) return NextResponse.json({ error: "請提供 date，或 from 與 to 日期範圍。" }, { status: 400 });
    const rules = date ? await db()<{
      id: string; rule_kind: string; starts_at: string; ends_at: string; note: string | null; resource_codes: string[];
    }[]>`
      SELECT ar.id, ar.rule_kind, ar.starts_at, ar.ends_at, ar.note,
        coalesce(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS resource_codes
      FROM availability_rules ar
      LEFT JOIN availability_rule_resources arr ON arr.rule_id = ar.id
      LEFT JOIN resources r ON r.id = arr.resource_id
      WHERE ar.starts_at < (${date}::date + interval '1 day') AND ar.ends_at > ${date}::date
      GROUP BY ar.id ORDER BY ar.starts_at
    ` : await db()<{
      id: string; rule_kind: string; starts_at: string; ends_at: string; note: string | null; resource_codes: string[];
    }[]>`
      SELECT ar.id, ar.rule_kind, ar.starts_at, ar.ends_at, ar.note,
        coalesce(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS resource_codes
      FROM availability_rules ar
      LEFT JOIN availability_rule_resources arr ON arr.rule_id = ar.id
      LEFT JOIN resources r ON r.id = arr.resource_id
      WHERE ar.starts_at < ${to}::date AND ar.ends_at > ${from}::date
      GROUP BY ar.id ORDER BY ar.starts_at
    `;
    return NextResponse.json(rules);
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { startsAt, endsAt, resourceCodes, ruleKind = "admin_lock", note } = await request.json();
    if (typeof startsAt !== "string" || typeof endsAt !== "string" || !Array.isArray(resourceCodes) || resourceCodes.length === 0) return NextResponse.json({ error: "開始、結束時間與至少一項資源為必填。" }, { status: 400 });
    if (!["maintenance", "admin_lock", "full_only"].includes(ruleKind) || resourceCodes.some((code: unknown) => typeof code !== "string" || !resourceKeys[code])) return NextResponse.json({ error: "無效的鎖場類型或資源。" }, { status: 400 });
    const start = new Date(startsAt); const end = new Date(endsAt);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start >= end) return NextResponse.json({ error: "時間範圍無效。" }, { status: 400 });

    const result = await db().begin(async (sql) => {
      const [rule] = await sql<{ id: string }[]>`
        INSERT INTO availability_rules (rule_kind, starts_at, ends_at, note, created_by)
        VALUES (${ruleKind}, ${start.toISOString()}, ${end.toISOString()}, ${typeof note === "string" ? note.trim() || null : null}, ${admin.id}) RETURNING id
      `;
      for (const code of resourceCodes as string[]) {
        const [resource] = await sql<{ id: string }[]>`SELECT id FROM resources WHERE code = ${code} AND is_active = true`;
        if (!resource) throw new Error(`Resource ${code} was not found.`);
        await sql`INSERT INTO availability_rule_resources (rule_id, resource_id) VALUES (${rule.id}, ${resource.id})`;
      }
      // full_only is a selection policy rather than an occupancy: it must not block BB_FULL itself.
      if (ruleKind !== "full_only") {
        const keys = [...new Set((resourceCodes as string[]).flatMap((code) => resourceKeys[code]))];
        for (const conflictKey of keys) await sql`
          INSERT INTO resource_occupancies (availability_rule_id, conflict_key, occupied_during)
          VALUES (${rule.id}, ${conflictKey}, tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'))
        `;
      }
      return rule;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    if (typeof id !== "string") return NextResponse.json({ error: "Rule id is required." }, { status: 400 });
    await db()`DELETE FROM availability_rules WHERE id = ${id}`;
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error); }
}

function apiError(error: unknown) { if (error instanceof Response) return new NextResponse(error.body, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 }); }
