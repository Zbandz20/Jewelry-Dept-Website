import { ensureAdminTables, getSql } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAdminTables();
  const sql = getSql();
  const assets = await sql`SELECT id, data_url FROM jd_assets WHERE data_url <> ''`;
  const products = await sql`SELECT id, name, price, inventory, active, image_url FROM jd_products WHERE active = TRUE ORDER BY id`;
  return Response.json({ assets: Object.fromEntries(assets.map((item) => [item.id, item.data_url])), products });
}
