import { ensureAdminTables, getCheckoutEnabled, getSql } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAdminTables();
  const sql = getSql();
  const assetRows = await sql`SELECT id, data_url, updated_at FROM jd_assets WHERE data_url <> ''`;
  const rows = await sql`SELECT id, name, price, inventory, image_url, description, updated_at FROM jd_products WHERE active = TRUE ORDER BY id`;
  const products = rows.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    inventory: product.inventory,
    description: product.description,
    image_url: String(product.image_url || "").startsWith("data:image/")
      ? `/api/product-image/${product.id}?v=${new Date(product.updated_at).getTime()}`
      : product.image_url,
  }));
  const assets = Object.fromEntries(assetRows.map((asset) => [
    asset.id,
    String(asset.data_url || "").startsWith("data:image/")
      ? `/api/asset-image/${encodeURIComponent(String(asset.id))}?v=${new Date(asset.updated_at).getTime()}`
      : asset.data_url,
  ]));
  return Response.json(
    { assets, products, checkoutEnabled: await getCheckoutEnabled() },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" } },
  );
}
