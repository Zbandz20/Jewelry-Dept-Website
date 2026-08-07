import { createHmac, timingSafeEqual } from "crypto";
import { ensureAdminTables, getSql } from "@/lib/admin";
import { escapeHtml, ownerEmail, sendTransactionalEmail } from "@/lib/email";

function validSignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map(part => part.split("=")));
  const timestamp = Number(parts.t);
  const signature = parts.v1 || "";
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const payload = await request.text();
  if (!secret || !validSignature(payload, request.headers.get("stripe-signature") || "", secret)) {
    return new Response("Invalid signature", { status: 400 });
  }
  const event = JSON.parse(payload);
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return Response.json({ received: true });
  }
  const session = event.data.object;
  if (!["paid", "no_payment_required"].includes(session.payment_status)) return Response.json({ received: true });

  await ensureAdminTables();
  const sql = getSql();
  const cart = JSON.parse(session.metadata?.cart || "[]") as Array<{ id: number; quantity: number }>;
  const customer = session.customer_details || {};
  const shipping = session.collected_information?.shipping_details || session.shipping_details || {};
  const inserted = await sql`
    INSERT INTO jd_orders (customer_name, customer_email, total, status, stripe_session_id, shipping_address)
    VALUES (${shipping.name || customer.name || "Online customer"}, ${customer.email || ""}, ${Number(session.amount_total || 0) / 100}, 'paid', ${session.id}, ${JSON.stringify(shipping)})
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING id
  `;
  if (inserted.length) {
    for (const item of cart) {
      await sql`UPDATE jd_products SET inventory = GREATEST(0, inventory - ${Number(item.quantity)}), updated_at = NOW() WHERE id = ${Number(item.id)}`;
    }

    const orderId = Number(inserted[0].id);
    const total = (Number(session.amount_total || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const customerEmail = String(customer.email || "");
    const lowStock = await sql`SELECT name, sku, inventory FROM jd_products WHERE active = TRUE AND inventory <= 5 ORDER BY inventory, name`;
    const notifications: Array<Promise<unknown>> = [];

    if (customerEmail) {
      notifications.push(sendTransactionalEmail({
        to: customerEmail,
        subject: `Jewelry Dept. order #${orderId} confirmed`,
        html: `<div style="font-family:Arial,sans-serif;color:#111"><p style="letter-spacing:.12em">JEWELRY DEPT.</p><h1>Order confirmed.</h1><p>Thank you, ${escapeHtml(shipping.name || customer.name || "customer")}. We received your payment of <strong>${escapeHtml(total)}</strong>.</p><p>Your order number is <strong>#${orderId}</strong>. We will email tracking after your shipping label is created.</p><p>Questions? Reply to this email or contact hello@jewelrydept.co.</p></div>`,
      }));
    }

    const admin = ownerEmail();
    if (admin) {
      notifications.push(sendTransactionalEmail({
        to: admin,
        subject: `New Jewelry Dept. order #${orderId}`,
        html: `<div style="font-family:Arial,sans-serif;color:#111"><h1>New paid order #${orderId}</h1><p>Total: <strong>${escapeHtml(total)}</strong></p><p>Customer: ${escapeHtml(shipping.name || customer.name || "Online customer")}</p><p>Open the management dashboard to review and create the shipping label.</p></div>`,
      }));
      if (lowStock.length) {
        const rows = lowStock.map(item => `<li>${escapeHtml(item.name)} — ${Number(item.inventory)} left${item.sku ? ` (${escapeHtml(item.sku)})` : ""}</li>`).join("");
        notifications.push(sendTransactionalEmail({
          to: admin,
          subject: "Jewelry Dept. low-stock alert",
          html: `<div style="font-family:Arial,sans-serif;color:#111"><h1>Inventory needs attention</h1><ul>${rows}</ul><p>Update inventory in the management dashboard.</p></div>`,
        }));
      }
    }
    await Promise.allSettled(notifications);
  }
  return Response.json({ received: true });
}
