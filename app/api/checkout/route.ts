import { ensureAdminTables, getCheckoutEnabled, getSql } from "@/lib/admin";

export async function POST(request: Request) {
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
  products.forEach((product, index) => {
    const quantity = quantities.get(Number(product.id)) || 1;
    if (Number(product.inventory) < quantity) throw new Error(`${product.name} does not have enough inventory.`);
    form.set(`line_items[${index}][price_data][currency]`, "usd");
    form.set(`line_items[${index}][price_data][product_data][name]`, String(product.name));
    if (String(product.image_url || "").startsWith("https://")) form.set(`line_items[${index}][price_data][product_data][images][0]`, String(product.image_url));
    const unitAmount = Math.round(Number(product.price) * 100);
    merchandiseSubtotalCents += unitAmount * quantity;
    form.set(`line_items[${index}][price_data][unit_amount]`, String(unitAmount));
    form.set(`line_items[${index}][quantity]`, String(quantity));
    cartMeta.push({ id: Number(product.id), quantity });
  });
  const origin = new URL(request.url).origin;
  form.set("mode", "payment");
  form.set("success_url", `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${origin}/#pieces`);
  form.set("customer_creation", "always");
  form.set("billing_address_collection", "required");
  form.set("shipping_address_collection[allowed_countries][0]", "US");
  form.set("shipping_address_collection[allowed_countries][1]", "MX");
  form.set("allow_promotion_codes", "true");
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

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const session = await stripeResponse.json();
  if (!stripeResponse.ok || !session.url) return Response.json({ error: session.error?.message || "Checkout could not start." }, { status: 502 });
  return Response.json({ url: session.url });
}
