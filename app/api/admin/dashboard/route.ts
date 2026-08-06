import { ensureAdminTables, getCheckoutEnabled, getSql, isAdmin, setCheckoutEnabled } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureAdminTables();
  const sql = getSql();

  const [summary] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM jd_orders) AS total_orders,
      (SELECT COALESCE(SUM(total), 0)::float FROM jd_orders WHERE status <> 'cancelled') AS gross,
      (SELECT COUNT(*)::int FROM jd_visits WHERE created_at > NOW() - INTERVAL '5 minutes') AS live_visitors,
      (SELECT COUNT(DISTINCT session_id)::int FROM jd_visits WHERE created_at > NOW() - INTERVAL '24 hours') AS visitors_today,
      (SELECT COALESCE(AVG(total), 0)::float FROM jd_orders WHERE status <> 'cancelled') AS average_order
  `;
  const products = await sql`SELECT * FROM jd_products ORDER BY id`;
  const orders = await sql`SELECT * FROM jd_orders ORDER BY created_at DESC LIMIT 25`;
  const assets = await sql`SELECT id, label, data_url, updated_at FROM jd_assets ORDER BY id`;
  return Response.json({ summary, products, orders, assets, checkoutEnabled: await getCheckoutEnabled(), stripeReady: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureAdminTables();
  const sql = getSql();
  const body = await request.json();

  if (body.type === "product") {
    const [product] = await sql`
      UPDATE jd_products SET
        name = ${String(body.name)},
        sku = ${String(body.sku || "")},
        price = ${Number(body.price || 0)},
        inventory = ${Number(body.inventory || 0)},
        active = ${Boolean(body.active)},
        image_url = ${String(body.image_url || "")},
        description = ${String(body.description || "")},
        updated_at = NOW()
      WHERE id = ${Number(body.id)}
      RETURNING *
    `;
    return Response.json({ product });
  }

  if (body.type === "product-create") {
    const [product] = await sql`
      INSERT INTO jd_products (name, sku, price, inventory, active, image_url, description)
      VALUES (${String(body.name || "New product")}, ${String(body.sku || "")}, ${Number(body.price || 0)}, ${Number(body.inventory || 0)}, FALSE, '', '')
      RETURNING *
    `;
    return Response.json({ product });
  }

  if (body.type === "shopify-import") {
    const store = String(body.store || "").trim().replace(/\/$/, "");
    let storeUrl: URL;
    try { storeUrl = new URL(store); } catch { return Response.json({ error: "Enter a valid Shopify store URL." }, { status: 400 }); }
    if (storeUrl.protocol !== "https:" || !storeUrl.hostname.endsWith(".myshopify.com")) return Response.json({ error: "Only a secure myshopify.com store can be imported." }, { status: 400 });
    const response = await fetch(`${storeUrl.origin}/products.json?limit=250`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return Response.json({ error: "Shopify did not return the product catalog." }, { status: 502 });
    const catalog = await response.json();
    const items = Array.isArray(catalog.products) ? catalog.products.slice(0, 250) : [];
    let imported = 0;
    for (const item of items) {
      const variant = Array.isArray(item.variants) ? item.variants[0] : null;
      const image = Array.isArray(item.images) ? item.images[0]?.src : item.image?.src;
      const description = String(item.body_html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
      await sql`
        INSERT INTO jd_products (name, sku, price, inventory, active, image_url, description, updated_at)
        VALUES (${String(item.title || "Shopify product")}, ${String(variant?.sku || "")}, ${Number(variant?.price || 0)}, ${variant?.available === false ? 0 : 1}, TRUE, ${String(image || "")}, ${description}, NOW())
        ON CONFLICT (name) DO UPDATE SET sku = EXCLUDED.sku, price = EXCLUDED.price, image_url = EXCLUDED.image_url, description = EXCLUDED.description, active = TRUE, updated_at = NOW()
      `;
      imported++;
    }
    return Response.json({ imported });
  }

  if (body.type === "asset") {
    const value = String(body.dataUrl || "");
    if (value.length > 4_000_000) return Response.json({ error: "Image is too large" }, { status: 413 });
    const [asset] = await sql`
      UPDATE jd_assets SET data_url = ${value}, updated_at = NOW()
      WHERE id = ${String(body.id)}
      RETURNING id, label, updated_at
    `;
    return Response.json({ asset });
  }

  if (body.type === "order-status") {
    await sql`UPDATE jd_orders SET status = ${String(body.status)} WHERE id = ${Number(body.id)}`;
    return Response.json({ ok: true });
  }
  if (body.type === "checkout-toggle") {
    if (Boolean(body.enabled) && (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)) {
      return Response.json({ error: "Connect Stripe before activating checkout." }, { status: 400 });
    }
    await setCheckoutEnabled(Boolean(body.enabled));
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
