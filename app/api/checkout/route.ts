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
  products.forEach((product, index) => {
    const quantity = quantities.get(Number(product.id)) || 1;
    if (Number(product.inventory) < quantity) throw new Error(`${product.name} does not have enough inventory.`);
    form.set(`line_items[${index}][price_data][currency]`, "usd");
    form.set(`line_items[${index}][price_data][product_data][name]`, String(product.name));
    if (String(product.image_url || "").startsWith("https://")) form.set(`line_items[${index}][price_data][product_data][images][0]`, String(product.image_url));
    form.set(`line_items[${index}][price_data][unit_amount]`, String(Math.round(Number(product.price) * 100)));
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
