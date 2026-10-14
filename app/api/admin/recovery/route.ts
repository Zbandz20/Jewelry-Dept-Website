import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { adminToken, ensureAdminTables, getRecoveryQuestion, getSql, setAdminPassword, verifyRecoveryAnswer } from "@/lib/admin";
import { ownerEmail, sendTransactionalEmail } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const genericMessage = "If recovery email is configured, a secure reset link has been sent.";
export const dynamic = "force-dynamic";

async function issueResetToken() {
  const sql = getSql();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`DELETE FROM jd_password_resets WHERE expires_at < NOW() OR used_at IS NOT NULL`;
  await sql`INSERT INTO jd_password_resets (token_hash, expires_at) VALUES (${tokenHash}, NOW() + INTERVAL '30 minutes')`;
  return token;
}

export async function GET() {
  const emailReady = Boolean(process.env.RESEND_API_KEY && ownerEmail());
  if (emailReady) return Response.json({ mode: "email", configured: true }, { headers: { "Cache-Control": "no-store" } });
  const questionReady = Boolean(await getRecoveryQuestion());
  return Response.json({ mode: questionReady ? "question" : "unavailable", configured: questionReady }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await ensureAdminTables();
  const sql = getSql();

  const body = await request.json();
  const action = String(body.action || "request");

  if (action === "request") {
    const limit = await checkRateLimit(request, "admin-recovery-request", 3, 30 * 60);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
    const email = ownerEmail();
    if (process.env.RESEND_API_KEY && email) {
      const token = await issueResetToken();
      const origin = new URL(request.url).origin;
      await sendTransactionalEmail({
        to: email,
        subject: "Jewelry Dept. management password reset",
        html: `<div style="font-family:Arial,sans-serif;color:#111"><h1>Reset management access</h1><p>This link expires in 30 minutes and can be used once.</p><p><a href="${origin}/admin/reset?token=${token}" style="display:inline-block;padding:14px 20px;background:#111;color:#fff;text-decoration:none">Reset password</a></p><p>If you did not request this, ignore this email.</p></div>`,
      });
      return Response.json({ ok: true, mode: "email", message: genericMessage });
    }
    const question = await getRecoveryQuestion();
    if (!question) return NextResponse.json({ error: "Password recovery is not configured. Sign in and save a security question in the Security tab." }, { status: 503 });
    return Response.json({ ok: true, mode: "question", question });
  }

  if (action === "verify-answer") {
    const limit = await checkRateLimit(request, "admin-recovery-answer", 5, 30 * 60);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
    if (process.env.RESEND_API_KEY && ownerEmail()) {
      return NextResponse.json({ error: "Use the secure reset link sent to the management email." }, { status: 400 });
    }
    const answer = String(body.answer || "");
    if (answer.trim().length < 3 || answer.length > 200 || !(await verifyRecoveryAnswer(answer))) {
      return NextResponse.json({ error: "That answer did not match." }, { status: 401 });
    }
    return Response.json({ ok: true, token: await issueResetToken() });
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
