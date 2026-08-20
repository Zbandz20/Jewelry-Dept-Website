import { createHmac, timingSafeEqual } from "crypto";
import { ensureAdminTables, getSql } from "@/lib/admin";
import { escapeHtml, ownerEmail, sendTransactionalEmail } from "@/lib/email";
import { assessOrderFraud } from "@/lib/fraud";

function validSignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map(part => part.split("=")));
  const timestamp = Number(parts.t);
  const signature = parts.v1 || "";
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function stripeObjectId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) return String((value as { id?: string }).id || "");
  return "";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const payload = await request.text();
  if (!secret || !validSignature(payload, request.headers.get("stripe-signature") || "", secret)) {
    return new Response("Invalid signature", { status: 400 });
  }
  const event = JSON.parse(payload);

  if (["radar.early_fraud_warning.created", "charge.dispute.created"].includes(event.type)) {
    await ensureAdminTables();
    const sql = getSql();
    const chargeId = stripeObjectId(event.data?.object?.charge);
    if (!chargeId) return Response.json({ received: true });

    const isDispute = event.type === "charge.dispute.created";
    const signal = isDispute
      ? "Stripe reported a payment dispute."
      : "Stripe issued an early fraud warning after payment.";
    const [order] = await sql`
      UPDATE jd_orders SET
        fraud_risk_level = 'highest',
        fraud_risk_score = 100,
        fraud_signals = COALESCE(fraud_signals, '[]'::jsonb) || jsonb_build_array(${signal}),
        fraud_review_status = ${isDispute ? "disputed" : "pending"},
        fulfillment_hold = TRUE,
        status = ${isDispute ? "disputed" : "review_required"}
      WHERE stripe_charge_id = ${chargeId}
      RETURNING id, customer_name, customer_email, total
    `;
    if (!order) return Response.json({ error: "Order is not recorded yet; retry this event." }, { status: 409 });

    const admin = ownerEmail();
    if (admin) {
      const total = Number(order.total || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
      await sendTransactionalEmail({
        to: admin,
        subject: `URGENT: fraud alert for Jewelry Dept. order #${order.id}`,
        html: `<div style="font-family:Arial,sans-serif;color:#111"><h1>Do not ship order #${order.id}</h1><p><strong>${escapeHtml(signal)}</strong></p><p>Customer: ${escapeHtml(order.customer_name)} · ${escapeHtml(order.customer_email)}</p><p>Total: ${escapeHtml(total)}</p><p>The order is locked from shipping. Review the payment in Stripe and the Jewelry Dept. management dashboard before taking action.</p></div>`,
      });
    }
    return Response.json({ received: true });
  }

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
  const fraud = await assessOrderFraud(session, shipping);
  const orderStatus = fraud.fulfillmentHold ? "review_required" : "paid";
  const inserted = await sql`
    INSERT INTO jd_orders (
      customer_name, customer_email, total, status, stripe_session_id, shipping_address,
      stripe_payment_intent_id, stripe_charge_id, fraud_risk_level, fraud_risk_score,
      fraud_signals, fraud_review_status, fulfillment_hold
    )
    VALUES (
      ${shipping.name || customer.name || "Online customer"}, ${customer.email || ""},
      ${Number(session.amount_total || 0) / 100}, ${orderStatus}, ${session.id}, ${JSON.stringify(shipping)},
      ${fraud.paymentIntentId}, ${fraud.chargeId}, ${fraud.riskLevel}, ${fraud.riskScore},
      ${JSON.stringify(fraud.signals)}, ${fraud.reviewStatus}, ${fraud.fulfillmentHold}
    )
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
      const reviewMessage = fraud.fulfillmentHold
        ? "As part of our security process, your order is awaiting a routine verification review before fulfillment."
        : "We will email tracking after your shipping label is created.";
      notifications.push(sendTransactionalEmail({
        to: customerEmail,
        subject: `Jewelry Dept. order #${orderId} confirmed`,
        html: `<div style="font-family:Arial,sans-serif;color:#111"><p style="letter-spacing:.12em">JEWELRY DEPT.</p><h1>Order confirmed.</h1><p>Thank you, ${escapeHtml(shipping.name || customer.name || "customer")}. We received your payment of <strong>${escapeHtml(total)}</strong>.</p><p>Your order number is <strong>#${orderId}</strong>. ${escapeHtml(reviewMessage)}</p><p>Questions? Contact hello@jewelrydept.co.</p></div>`,
      }));
    }

    const admin = ownerEmail();
    if (admin) {
      const signalRows = fraud.signals.map(signal => `<li>${escapeHtml(signal)}</li>`).join("");
      notifications.push(sendTransactionalEmail({
        to: admin,
        subject: fraud.fulfillmentHold
          ? `REVIEW REQUIRED: Jewelry Dept. order #${orderId}`
          : `New Jewelry Dept. order #${orderId}`,
        html: `<div style="font-family:Arial,sans-serif;color:#111"><h1>${fraud.fulfillmentHold ? "Order held for fraud review" : "New paid order"} #${orderId}</h1><p>Total: <strong>${escapeHtml(total)}</strong></p><p>Customer: ${escapeHtml(shipping.name || customer.name || "Online customer")}</p><p>Risk: <strong>${escapeHtml(fraud.riskLevel)}</strong>${fraud.riskScore === null ? "" : ` · score ${fraud.riskScore}/100`}</p><ul>${signalRows}</ul><p>${fraud.fulfillmentHold ? "Do not ship until the order is approved in the management dashboard." : "Open the management dashboard to review and create the shipping label."}</p></div>`,
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
