import { ensureAdminTables, getSql } from "@/lib/admin";

const allowedEvents = new Set(["product_view", "add_to_cart", "checkout_start", "newsletter_signup", "custom_request"]);

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = String(body.sessionId || "");
  if (!sessionId || sessionId.length > 100) return Response.json({ ok: false }, { status: 400 });

  const eventName = String(body.eventName || "");
  if (eventName && !allowedEvents.has(eventName)) return Response.json({ error: "Unknown event." }, { status: 400 });

  await ensureAdminTables();
  const sql = getSql();
  if (!eventName) {
    await sql`INSERT INTO jd_visits (session_id) VALUES (${sessionId})`;
    return Response.json({ ok: true });
  }

  const productIdValue = Number(body.productId);
  const productId = Number.isInteger(productIdValue) && productIdValue > 0 ? productIdValue : null;
  const amountValue = Number(body.amount);
  const amount = Number.isFinite(amountValue) && amountValue >= 0 ? amountValue : null;
  const path = String(body.path || "/").slice(0, 300);
  await sql`
    INSERT INTO jd_events (session_id, event_name, product_id, path, amount)
    VALUES (${sessionId}, ${eventName}, ${productId}, ${path}, ${amount})
  `;
  return Response.json({ ok: true });
}
