import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { adminToken, ensureAdminTables, getSql, setAdminPassword } from "@/lib/admin";
import { ownerEmail, sendTransactionalEmail } from "@/lib/email";

const genericMessage = "If recovery email is configured, a secure reset link has been sent.";

export async function GET() {
  return Response.json({ mode: "email", configured: Boolean(process.env.RESEND_API_KEY && ownerEmail()) });
}

export async function POST(request: Request) {
  await ensureAdminTables();
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS jd_recovery_attempts (id BIGSERIAL PRIMARY KEY, client_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS jd_password_resets (
    id BIGSERIAL PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  const clientId = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 80);
  const body = await request.json();
  const action = String(body.action || "request");

  if (action === "request") {
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM jd_recovery_attempts WHERE client_id = ${clientId} AND created_at > NOW() - INTERVAL '30 minutes'`;
    if (Number(count) >= 3) return NextResponse.json({ error: "Too many requests. Try again in 30 minutes." }, { status: 429 });
    await sql`INSERT INTO jd_recovery_attempts (client_id) VALUES (${clientId})`;
    const email = ownerEmail();
    if (!process.env.RESEND_API_KEY || !email) return NextResponse.json({ error: "Email recovery needs to be connected in website settings." }, { status: 503 });
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await sql`DELETE FROM jd_password_resets WHERE expires_at < NOW() OR used_at IS NOT NULL`;
    await sql`INSERT INTO jd_password_resets (token_hash, expires_at) VALUES (${tokenHash}, NOW() + INTERVAL '30 minutes')`;
    const origin = new URL(request.url).origin;
    await sendTransactionalEmail({
      to: email,
      subject: "Jewelry Dept. management password reset",
      html: `<div style="font-family:Arial,sans-serif;color:#111"><h1>Reset management access</h1><p>This link expires in 30 minutes and can be used once.</p><p><a href="${origin}/admin/reset?token=${token}" style="display:inline-block;padding:14px 20px;background:#111;color:#fff;text-decoration:none">Reset password</a></p><p>If you did not request this, ignore this email.</p></div>`,
    });
    return Response.json({ ok: true, message: genericMessage });
  }

  if (action === "reset") {
    const token = String(body.token || "");
    const newPassword = String(body.newPassword || "");
    if (token.length !== 64) return NextResponse.json({ error: "That reset link is invalid." }, { status: 400 });
    if (newPassword.length < 12) return NextResponse.json({ error: "Use at least 12 characters." }, { status: 400 });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const rows = await sql`SELECT id FROM jd_password_resets WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > NOW() LIMIT 1`;
    if (!rows[0]) return NextResponse.json({ error: "That reset link is invalid or expired." }, { status: 400 });
    await setAdminPassword(newPassword);
    await sql`UPDATE jd_password_resets SET used_at = NOW() WHERE id = ${Number(rows[0].id)}`;
    const response = NextResponse.json({ ok: true });
    response.cookies.set("jd_admin", await adminToken(), { httpOnly: true, secure: true, sameSite: "strict", maxAge: 60 * 60 * 12, path: "/" });
    return response;
  }

  return NextResponse.json({ error: "Invalid recovery action." }, { status: 400 });
}
