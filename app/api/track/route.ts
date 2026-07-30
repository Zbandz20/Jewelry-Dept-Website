import { ensureAdminTables, getSql } from "@/lib/admin";

export async function POST(request: Request) {
  const { sessionId } = await request.json();
  if (!sessionId || String(sessionId).length > 100) return Response.json({ ok: false }, { status: 400 });
  await ensureAdminTables();
  const sql = getSql();
  await sql`INSERT INTO jd_visits (session_id) VALUES (${String(sessionId)})`;
  return Response.json({ ok: true });
}
