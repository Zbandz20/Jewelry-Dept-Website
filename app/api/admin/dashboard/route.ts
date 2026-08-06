import { ensureAdminTables, getCheckoutEnabled, getSql, isAdmin, setCheckoutEnabled, verifyAdminPassword } from "@/lib/admin";

const shopifyStorefrontProducts = [
  ["6mm Moissanite Cuban Bracelet",250,"AAD37993-02AD-4948-BF25-D7A330AC1D91.jpg?v=1772470224",true],
  ["Cuban Ring",125,"878E33F7-5310-4153-B399-A4BBC9A760CF.jpg?v=1772519103",true],
  ["5mm Halo Stud Earrings",70,"5D89A1FB-2A7F-4D88-BE36-1881F1EC3DE8.jpg?v=1782328260",true],
  ["Santos Style Watch",400,"0CD32BBE-FE8F-468D-9E5A-D380CFD8E8B9.jpg?v=1778008152",false],
  ["10mm Cuban Bracelet",400,"66A7CE8C-3127-4F72-B450-0568C6F24A4F.jpg?v=1778005842",true],
  ["2mm Tennis Bracelet",125,"C748E1A0-8475-4425-AC41-95136E0AA3EA.jpg?v=1778006127",true],
  ["4mm Tennis Bracelet",225,"B1FEEFB5-E5DF-4D33-9267-9A9F19E32366.jpg?v=1772518355",true],
  ["6.5mm Tennis Bracelet",250,"F680002E-49C8-4A41-9A89-9E90DC29273B.jpg?v=1772852100",false],
  ["9.2mm Cluster Earrings",85,"38245F71-E3EA-487F-9438-E7640597DC50.jpg?v=1778007108",true],
  ["11mm Circle Earrings",120,"700C4DBE-A776-4711-9529-3742B95010CC.jpg?v=1782332338",true],
  ["10.5mm Circle Cluster Earrings",100,"7FF6A9A0-F77C-437F-B560-0125773FAB7F.jpg?v=1782332813",true],
  ["11mm Square Earrings",120,"7550E04B-DA20-40C5-861F-AE63866B798B.jpg?v=1782331916",true],
  ["2mm 22-inch Tennis Chain",280,"A647135C-83BE-4C05-9C80-4E631ACE886A.jpg?v=1782330356",true],
  ["2mm Tennis Chain + Jesus Pendant",400,"B4078552-F69A-41CE-861E-0860FDB9BF1A.jpg?v=1778007546",false],
  ["3mm Clover Tennis Bracelet",250,"229584F1-FB50-4BF3-ACB4-12B80BAE4083.jpg?v=1782331114",true],
  ["7mm 1.2ct Stud Earrings",65,"47C82025-62C5-471D-A29D-A38D003278F7.jpg?v=1783300824",true],
  ["8mm 22-inch Cuban Chain",700,"1F8F17E2-2D07-4CBC-9578-AD3A6040B111.jpg?v=1782328950",true],
  ["8mm Cuban Bracelet",280,"D40D1229-7AC8-4D04-B8C7-8D0A82DF44DB.jpg?v=1783055477",true],
  ["Baguette Cross Pendant",280,"A0F7D2B6-63C4-4F91-9A31-37E142EC99A8.jpg?v=1783299388",true],
  ["Cross Earrings",55,"560D1FA1-0221-4808-AE53-096DB390804B.jpg?v=1783299900",true],
].map(([title,price,file,available]) => ({ title, body_html:`Authentic ${title} from Jewelry Dept.`, images:[{src:`https://jewelrydeptaz.myshopify.com/cdn/shop/files/${file}&width=1200`}], variants:[{price,available,sku:""}] }));

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
  const customRequests = await sql`SELECT * FROM jd_custom_requests ORDER BY created_at DESC LIMIT 100`;
  return Response.json({ summary, products, orders, assets, customRequests, checkoutEnabled: await getCheckoutEnabled(), stripeReady: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) });
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
    const items = shopifyStorefrontProducts;
    await sql`
      UPDATE jd_products
      SET active = FALSE, updated_at = NOW()
      WHERE sku IN ('JD-LC-12', 'JD-CD-10', 'JD-SOL-2', 'JD-CRUZ-14')
         OR name IN ('La Corona', 'La Cadena', 'Solitario', 'La Cruz', '12mm Cuban Chain', '10mm Cuban Chain', '2ct Solitaire Ring', 'Pavé Cross Pendant')
    `;
    let imported = 0;
    for (const item of items) {
      const variant = Array.isArray(item.variants) ? item.variants[0] : null;
      const image = Array.isArray(item.images) ? item.images[0]?.src : "";
      const description = String(item.body_html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
      const imageFile = String(image || "").split("/").pop()?.split("?")[0] || "";
      if (imageFile) await sql`UPDATE jd_products SET name = ${String(item.title)} WHERE image_url LIKE ${`%${imageFile}%`} AND name <> ${String(item.title)}`;
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
  if (body.type === "custom-request-decision") {
    const id = Number(body.id);
    const decision = String(body.decision || "");
    const confirmation = String(body.confirmation || "").trim().toUpperCase();
    if (!Number.isInteger(id) || !["approved", "declined"].includes(decision)) return Response.json({ error: "Invalid request decision." }, { status: 400 });
    if (!(await verifyAdminPassword(String(body.password || "")))) return Response.json({ error: "Dashboard password is incorrect." }, { status: 401 });
    const required = `${decision === "approved" ? "APPROVE" : "DECLINE"} ${id}`;
    if (confirmation !== required) return Response.json({ error: `Type ${required} to complete the second verification.` }, { status: 400 });
    const approvedTotal = decision === "approved" ? Number(body.approvedTotal) : null;
    if (decision === "approved" && (!Number.isFinite(approvedTotal) || approvedTotal <= 0)) return Response.json({ error: "Enter a valid approved total." }, { status: 400 });
    const [customRequest] = await sql`
      UPDATE jd_custom_requests SET
        status = ${decision},
        approved_total = ${approvedTotal},
        approved_at = ${decision === "approved" ? new Date().toISOString() : null}
      WHERE id = ${id} AND status = 'pending'
      RETURNING *
    `;
    if (!customRequest) return Response.json({ error: "This request was already reviewed or could not be found." }, { status: 409 });
    return Response.json({ customRequest });
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
