import { ensureAdminTables, getSql } from "@/lib/admin";
import { escapeHtml, ownerEmail, sendTransactionalEmail } from "@/lib/email";

export async function POST(request: Request) {
  await ensureAdminTables();
  const email = String((await request.json()).email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS jd_subscribers (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const inserted = await sql`
    INSERT INTO jd_subscribers (email, active)
    VALUES (${email}, TRUE)
    ON CONFLICT (email) DO UPDATE SET active = TRUE
    RETURNING id
  `;

  const notifications: Array<Promise<unknown>> = [];
  notifications.push(sendTransactionalEmail({
    to: email,
    subject: "Welcome to the Jewelry Dept. private client list",
    html: `<div style="font-family:Arial,sans-serif;color:#111"><p style="letter-spacing:.12em">JEWELRY DEPT.</p><h1>You’re on the list.</h1><p>You’ll receive early access to new pieces, custom openings, and limited inventory.</p><p><a href="https://jewelrydept.co" style="color:#287fad">Visit Jewelry Dept.</a></p></div>`,
  }));
  const admin = ownerEmail();
  if (admin) notifications.push(sendTransactionalEmail({
    to: admin,
    subject: "New Jewelry Dept. subscriber",
    html: `<div style="font-family:Arial,sans-serif;color:#111"><h1>New private-client signup</h1><p>${escapeHtml(email)}</p><p>Subscriber record #${Number(inserted[0]?.id || 0)}</p></div>`,
  }));
  await Promise.allSettled(notifications);

  return Response.json({ ok: true, message: "You’re on the private client list." });
}
