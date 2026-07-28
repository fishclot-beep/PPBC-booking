import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const cookieName = "sports_booking_admin";
const maxAge = 60 * 60 * 8;

type SessionPayload = { memberId: string; expiresAt: number };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function makeAdminSession(memberId: string) {
  const payload = Buffer.from(JSON.stringify({ memberId, expiresAt: Date.now() + maxAge * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export async function currentMember() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) throw new Response("Unauthorized", { status: 401 });
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Response("Unauthorized", { status: 401 });
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Response("Unauthorized", { status: 401 });
  }

  let session: SessionPayload;
  try { session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new Response("Unauthorized", { status: 401 }); }
  if (!session.memberId || session.expiresAt < Date.now()) throw new Response("Unauthorized", { status: 401 });

  const sql = db();
  const [member] = await sql<{ id: string; display_name: string; role: "member" | "admin" }[]>`
    SELECT id, display_name, role FROM members
    WHERE id = ${session.memberId} AND is_blacklisted = false
  `;
  if (!member) throw new Response("Unauthorized", { status: 401 });
  return member;
}

export async function requireAdmin() {
  const member = await currentMember();
  if (member.role !== "admin") throw new Response("Forbidden", { status: 403 });
  return member;
}

export async function setAdminCookie(value: string) {
  (await cookies()).set(cookieName, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge, path: "/" });
}

export async function clearAdminCookie() { (await cookies()).delete(cookieName); }
