import { createHmac, timingSafeEqual } from "crypto";
import { ensureAdminTables, getSql } from "@/lib/admin";

function validSignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map(part => part.split("=")));
  const timestamp = Number(parts.t), signature = parts.v1 || "";
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "", payload = await request.text();
  if (!secret || !validSignature(payload, request.headers.get("stripe-signature") || "", secret)) return new Response("Invalid signature", { status: 400 });
  const event = JSON.parse(payload);
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return Response.json({ received: true });
  const session = event.data.object;
  if (!["paid", "no_payment_required"].includes(session.payment_status)) return Response.json({ received: true });
  await ensureAdminTables();
  const sql = getSql(), cart = JSON.parse(session.metadata?.cart || "[]") as Array<{ id: number; quantity: number }>, customer = session.customer_details || {};
  const inserted = await sql`INSERT INTO jd_orders (customer_name, customer_email, total, status, stripe_session_id) VALUES (${customer.name || "Online customer"}, ${customer.email || ""}, ${Number(session.amount_total || 0) / 100}, 'paid', ${session.id}) ON CONFLICT (stripe_session_id) DO NOTHING RETURNING id`;
  if (inserted.length) for (const item of cart) await sql`UPDATE jd_products SET inventory = GREATEST(0, inventory - ${Number(item.quantity)}), updated_at = NOW() WHERE id = ${Number(item.id)}`;
  return Response.json({ received: true });
}
