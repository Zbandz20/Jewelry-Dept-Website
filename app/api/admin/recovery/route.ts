import { NextResponse } from "next/server";
import { adminToken, ensureAdminTables, getRecoveryQuestion, getSql, setAdminPassword, verifyRecoveryAnswer } from "@/lib/admin";

export async function GET() {
  const question = await getRecoveryQuestion();
  if (!question) return Response.json({ error: "Password recovery has not been configured." }, { status: 404 });
  return Response.json({ question });
}

export async function POST(request: Request) {
  await ensureAdminTables();
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS jd_recovery_attempts (id BIGSERIAL PRIMARY KEY, client_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const clientId = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 80);
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM jd_recovery_attempts WHERE client_id = ${clientId} AND created_at > NOW() - INTERVAL '15 minutes'`;
  if (Number(count) >= 5) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const { answer, newPassword } = await request.json();
  if (!(await verifyRecoveryAnswer(String(answer || "")))) {
    await sql`INSERT INTO jd_recovery_attempts (client_id) VALUES (${clientId})`;
    return NextResponse.json({ error: "That security answer is incorrect." }, { status: 400 });
  }
  if (String(newPassword || "").length < 10) return NextResponse.json({ error: "Use at least 10 characters." }, { status: 400 });
  await setAdminPassword(String(newPassword));
  await sql`DELETE FROM jd_recovery_attempts WHERE client_id = ${clientId}`;
  const response = NextResponse.json({ ok: true });
  response.cookies.set("jd_admin", await adminToken(), { httpOnly: true, secure: true, sameSite: "strict", maxAge: 60 * 60 * 12, path: "/" });
  return response;
}
