import { randomUUID } from "crypto";
import { ensureAdminTables, getCheckoutEnabled, getSql } from "@/lib/admin";
import { attachStripeSessionToReservation, releaseCheckoutReservation, reserveCheckoutInventory } from "@/lib/inventory";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, "checkout", 20, 5 * 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  if (!(await getCheckoutEnabled())) return Response.json({ error: "Checkout is not open yet." }, { status: 503 });
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return Response.json({ error: "Checkout is being connected." }, { status: 503 });

  const body = await request.json();
  const requested = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
  const quantities = new Map<number, number>();
  for (const item of requested) {
    const id = Number(item.id);
    const quantity = Math.max(1, Math.min(10, Number(item.quantity) || 1));
    if (Number.isInteger(id)) quantities.set(id, Math.min(10, (quantities.get(id) || 0) + quantity));
  }
  if (!quantities.size) return Response.json({ error: "Your bag is empty." }, { status: 400 });

  await ensureAdminTables();
  const products = await getSql()`SELECT id, name, price, inventory, image_url FROM jd_products WHERE id = ANY(${Array.from(quantities.keys())}) AND active = TRUE`;
  if (products.length !== quantities.size) return Response.json({ error: "One of those pieces is no longer available." }, { status: 400 });

  const form = new URLSearchParams();
  const cartMeta: Array<{ id: number; quantity: number }> = [];
  let merchandiseSubtotalCents = 0;
  for (const [index, product] of products.entries()) {
    const quantity = quantities.get(Number(product.id)) || 1;
    if (Number(product.inventory) < quantity) {
      return Response.json({ error: `${product.name} does not have enough inventory.` }, { status: 409 });
    }
    form.set(`line_items[${index}][price_data][currency]`, "usd");
    form.set(`line_items[${index}][price_data][product_data][name]`, String(product.name));
    if (String(product.image_url || "").startsWith("https://")) form.set(`line_items[${index}][price_data][product_data][images][0]`, String(product.image_url));
    const unitAmount = Math.round(Number(product.price) * 100);
    merchandiseSubtotalCents += unitAmount * quantity;
    form.set(`line_items[${index}][price_data][unit_amount]`, String(unitAmount));
    form.set(`line_items[${index}][quantity]`, String(quantity));
    cartMeta.push({ id: Number(product.id), quantity });
  }
  const reservationKey = randomUUID();
  const expiresAt = new Date(Date.now() + 31 * 60 * 1000);
  const origin = new URL(request.url).origin;
  form.set("mode", "payment");
  form.set("payment_method_types[0]", "card");
  form.set("expires_at", String(Math.floor(expiresAt.getTime() / 1000)));
  form.set("success_url", `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${origin}/#pieces`);
  form.set("customer_creation", "always");
  form.set("phone_number_collection[enabled]", "true");
  form.set("billing_address_collection", "required");
  form.set("shipping_address_collection[allowed_countries][0]", "US");
  form.set("shipping_address_collection[allowed_countries][1]", "MX");
  form.set("allow_promotion_codes", "true");
  if (process.env.STRIPE_AUTOMATIC_TAX === "true") form.set("automatic_tax[enabled]", "true");
  const freeShipping = merchandiseSubtotalCents > 10_000;
  const standardShippingCents = Math.max(0, Number(process.env.STANDARD_SHIPPING_CENTS || 995));
  form.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  form.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(freeShipping ? 0 : standardShippingCents));
  form.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
  form.set("shipping_options[0][shipping_rate_data][display_name]", freeShipping ? "Free standard shipping" : "Standard shipping");
  form.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
  form.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "3");
  form.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
  form.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "7");
  form.set("metadata[shipping_policy]", freeShipping ? "free_over_100" : `standard_${standardShippingCents}`);
  form.set("metadata[cart]", JSON.stringify(cartMeta));
  form.set("metadata[reservation_key]", reservationKey);
  form.set("metadata[fraud_screening]", "stripe_radar_plus_internal_review");
  form.set("payment_intent_data[description]", "Jewelry Dept. online order");
  form.set("payment_intent_data[metadata][store]", "jewelry_dept");
  form.set("payment_intent_data[metadata][item_count]", String(cartMeta.reduce((total, item) => total + item.quantity, 0)));
  form.set("payment_intent_data[metadata][merchandise_subtotal_cents]", String(merchandiseSubtotalCents));

  const reserved = await reserveCheckoutInventory(reservationKey, cartMeta, expiresAt);
  if (!reserved) return Response.json({ error: "One of those pieces was just reserved by another customer. Please refresh your bag." }, { status: 409 });

  let sessionId = "";
  try {
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": reservationKey,
      },
      body: form,
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok || !session.url || !session.id) {
      await releaseCheckoutReservation(reservationKey, "failed");
      return Response.json({ error: session.error?.message || "Checkout could not start." }, { status: 502 });
    }

    sessionId = String(session.id);
    const attached = await attachStripeSessionToReservation(
      reservationKey,
      sessionId,
      session.expires_at ? new Date(Number(session.expires_at) * 1000) : expiresAt,
    );
    if (!attached) throw new Error("Checkout reservation could not be finalized.");
    return Response.json({ url: session.url });
  } catch (error) {
    if (sessionId) {
      await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` },
      }).catch(() => undefined);
    }
    await releaseCheckoutReservation(reservationKey, "failed").catch(() => undefined);
    return Response.json({ error: error instanceof Error ? error.message : "Checkout could not start." }, { status: 502 });
  }
}
